import React, { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout = ({ children, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="app-layout">
      <Navbar onLogout={onLogout} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="layout-content">
        <Sidebar isOpen={sidebarOpen} />
        <main className={`main-content ${!sidebarOpen ? 'sidebar-closed' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;