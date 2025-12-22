import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, X, User, MessageSquare, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { getNotifications, getNotificationCount, markNotificationsRead } from '../../api/authService';
import { useSocket } from '../../context/SocketContext';
import './NotificationCenter.css';

const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const socket = useSocket();

  // Fetch notification count on mount and set up socket listener
  useEffect(() => {
    fetchNotificationCount();

    // Fallback polling (less frequent when socket is connected)
    const interval = setInterval(fetchNotificationCount, socket ? 300000 : 60000); // 5 min with socket, 1 min without
    return () => clearInterval(interval);
  }, [socket]);

  // Listen for real-time notifications via Socket.IO
  useEffect(() => {
    if (socket) {
      const handleNotification = (notification) => {
        console.log('[NotificationCenter] Received real-time notification:', notification);

        // Add to notifications list if dropdown is open
        setNotifications(prev => [notification, ...prev]);

        // Increment unread count
        setUnreadCount(prev => prev + 1);

        // Show toast notification
        toast.info(
          <div>
            <strong>{notification.title}</strong>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>{notification.content}</p>
          </div>,
          {
            position: 'top-right',
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
          }
        );
      };

      const handleCountUpdate = (data) => {
        setUnreadCount(data.unread_count);
      };

      socket.on('notification', handleNotification);
      socket.on('notification_count', handleCountUpdate);

      return () => {
        socket.off('notification', handleNotification);
        socket.off('notification_count', handleCountUpdate);
      };
    }
  }, [socket]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotificationCount = async () => {
    try {
      const response = await getNotificationCount();
      if (response.success) {
        setUnreadCount(response.body.unread_count);
      }
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getNotifications(false, 20);
      if (response.success) {
        setNotifications(response.body.notifications || []);
        setUnreadCount(response.body.unread_count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationsRead([notificationId]);
      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markNotificationsRead(null, true);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'signup':
      case 'approval':
      case 'rejection':
        return <User size={16} className="icon-blue" />;
      case 'comment':
      case 'mention':
        return <MessageSquare size={16} className="icon-green" />;
      case 'deal_update':
        return <FileText size={16} className="icon-purple" />;
      default:
        return <AlertCircle size={16} className="icon-gray" />;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notification-wrapper" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="notification-bell"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="notification-dropdown">
          {/* Header */}
          <div className="notification-header">
            <h3>Notifications</h3>
            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="mark-all-read-btn"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="close-dropdown-btn"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">
                <div className="notification-spinner"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <Bell size={32} />
                <p>No notifications yet</p>
              </div>
            ) : (
              <>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                    onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
                  >
                    <div className="notification-avatar">
                      {notification.fromUser?.profile_url ? (
                        <img
                          src={notification.fromUser.profile_url}
                          alt=""
                        />
                      ) : (
                        getNotificationIcon(notification.notification_type)
                      )}
                    </div>
                    <div className="notification-content">
                      <p className="notification-title">
                        {notification.title}
                      </p>
                      <p className="notification-body">
                        {notification.content}
                      </p>
                      <span className="notification-time">
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    {!notification.is_read && (
                      <div className="notification-unread-dot"></div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="notification-footer">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to notifications page if you have one
                }}
                className="view-all-btn"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
