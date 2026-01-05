import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Get user from localStorage
    const authUser = localStorage.getItem('authUser');
    const user = authUser ? JSON.parse(authUser) : null;

    if (user?.id) {
      // Connect to the socket server
      // Extract base URL from API_BASE_URL (remove /api/v1 path)
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002/api/v1';
      const socketUrl = apiBaseUrl.replace(/\/api\/v1\/?$/, '');
      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
        timeout: 10000
      });

      newSocket.on('connect', () => {
        console.log('[Socket] Connected:', newSocket.id);
        // Join user-specific room
        newSocket.emit('join', user.id);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
      });

      newSocket.on('connect_error', (error) => {
        // Only log first connection error, not every retry
        if (!newSocket._errorLogged) {
          console.warn('[Socket] Connection unavailable - real-time features disabled');
          newSocket._errorLogged = true;
        }
      });

      setSocket(newSocket);

      // Cleanup on unmount
      return () => {
        console.log('[Socket] Cleaning up...');
        newSocket.close();
      };
    }
  }, []);

  // Re-initialize socket when user changes (login/logout)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'authUser') {
        // User changed, need to reconnect
        if (socket) {
          socket.close();
          setSocket(null);
        }
        // The main effect will handle reconnection
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
