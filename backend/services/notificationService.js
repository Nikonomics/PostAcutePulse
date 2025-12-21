/**
 * Notification Service
 * Handles creating notifications and emitting them via Socket.IO for real-time updates
 */

const db = require('../models/init-models');

/**
 * Create a notification and emit it via Socket.IO
 * @param {Object} notificationData - The notification data
 * @param {number} notificationData.from_id - ID of the user sending the notification (optional)
 * @param {number} notificationData.to_id - ID of the user receiving the notification
 * @param {string} notificationData.notification_type - Type: 'signup', 'approval', 'rejection', 'comment', 'mention', 'deal_update', 'reply'
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.content - Notification content/message
 * @param {number} notificationData.ref_id - Reference ID (deal ID, comment ID, etc.)
 * @param {string} notificationData.ref_type - Reference type: 'user', 'deal', 'comment', 'ownership_profile'
 * @returns {Promise<Object>} The created notification
 */
async function createNotification(notificationData) {
  try {
    const { to_id } = notificationData;

    if (!to_id) {
      console.warn('[NotificationService] No recipient specified for notification');
      return null;
    }

    // Create notification in database
    const notification = await db.user_notifications.create({
      ...notificationData,
      is_read: false,
      status: 'active'
    });

    // Fetch the full notification with associations for the socket emit
    const fullNotification = await db.user_notifications.findByPk(notification.id, {
      include: [
        {
          model: db.users,
          as: 'fromUser',
          attributes: ['id', 'first_name', 'last_name', 'profile_url']
        }
      ]
    });

    // Emit via Socket.IO if available
    if (global.io) {
      const room = `user_${to_id}`;
      global.io.to(room).emit('notification', {
        id: fullNotification.id,
        notification_type: fullNotification.notification_type,
        title: fullNotification.title,
        content: fullNotification.content,
        ref_id: fullNotification.ref_id,
        ref_type: fullNotification.ref_type,
        is_read: false,
        createdAt: fullNotification.createdAt,
        fromUser: fullNotification.fromUser ? {
          id: fullNotification.fromUser.id,
          first_name: fullNotification.fromUser.first_name,
          last_name: fullNotification.fromUser.last_name,
          profile_url: fullNotification.fromUser.profile_url
        } : null
      });
      console.log(`[NotificationService] Emitted notification to room: ${room}`);
    }

    return notification;
  } catch (error) {
    console.error('[NotificationService] Failed to create notification:', error);
    throw error;
  }
}

/**
 * Create notifications for multiple users
 * @param {Array<Object>} notificationsData - Array of notification data objects
 * @returns {Promise<Array<Object>>} Array of created notifications
 */
async function createNotifications(notificationsData) {
  const results = [];
  for (const data of notificationsData) {
    try {
      const notification = await createNotification(data);
      if (notification) {
        results.push(notification);
      }
    } catch (error) {
      console.error('[NotificationService] Failed to create one notification:', error);
    }
  }
  return results;
}

/**
 * Emit a notification count update to a user
 * Useful after marking notifications as read
 * @param {number} userId - The user ID
 * @param {number} unreadCount - The new unread count
 */
function emitNotificationCount(userId, unreadCount) {
  if (global.io) {
    const room = `user_${userId}`;
    global.io.to(room).emit('notification_count', { unread_count: unreadCount });
  }
}

module.exports = {
  createNotification,
  createNotifications,
  emitNotificationCount
};
