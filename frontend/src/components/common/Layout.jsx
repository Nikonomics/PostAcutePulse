import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import AppHelpPanel from '../AppHelpPanel';

const Layout = ({ children, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="app-layout">
      <Navbar onLogout={onLogout} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="layout-content">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className={`main-content ${!sidebarOpen ? 'sidebar-closed' : ''}`}>
          {children}
        </main>
      </div>

      {/* Floating Help Button */}
      <button
        className="floating-help-btn"
        onClick={() => setHelpPanelOpen(true)}
        title="Need help?"
      >
        <HelpCircle size={24} />
        <span>Help</span>
      </button>

      {/* Help Panel */}
      <AppHelpPanel
        isOpen={helpPanelOpen}
        onClose={() => setHelpPanelOpen(false)}
        currentPage={location.pathname}
      />
    </div>
  );
};

export default Layout;