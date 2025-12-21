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
      const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
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
        console.error('[Socket] Connection error:', error);
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
