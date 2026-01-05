import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  User,
  MapPin,
  Building2,
  Bookmark,
  ClipboardList,
  BookOpen,
  ArrowLeftRight,
  LayoutDashboard,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Flag,
} from 'lucide-react';
import { useAuth } from "../../context/UserContext";

const Sidebar = ({ isOpen, onToggle }) => {
  const { user } = useAuth();

  // Define all menu items
  const allMenuItems = [
    { path: '/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/provider-search', icon: Search, label: 'Provider Lookup' },
    { path: '/market-analysis', icon: MapPin, label: 'Market Analysis' },
    { path: '/market-grading', icon: TrendingUp, label: 'Market Grading' },
    { path: '/ownership-research', icon: Building2, label: 'Ownership Research' },
    { path: '/ma-intelligence', icon: ArrowLeftRight, label: 'M&A Intelligence' },
    { path: '/pennant-intelligence', icon: Flag, label: 'Pennant Intelligence' },
    { path: '/survey-analytics', icon: ClipboardList, label: 'Survey Analytics' },
    { path: '/reports', icon: LayoutDashboard, label: 'Report Builder' },
    { path: '/data-dictionary', icon: BookOpen, label: 'Data Dictionary' },
    { path: '/saved-items', icon: Bookmark, label: 'My Saved Items' },
    { path: '/user-management', icon: User, label: 'User Management' },
    { path: '/ai-assistant', icon: Bot, label: 'AI Assistant' },
  ];

  // If admin, show all menu items. If not admin, filter out admin-only items.
  let menuItems = [];
  if (user?.role === 'admin') {
    menuItems = allMenuItems;
  } else {
    // Show all items except user management for non-admins
    menuItems = allMenuItems.filter(item =>
      ['/dashboard', '/provider-search', '/market-analysis', '/market-grading', '/ownership-research', '/ma-intelligence', '/pennant-intelligence', '/survey-analytics', '/reports', '/data-dictionary', '/saved-items', '/ai-assistant'].includes(item.path)
    );
  }

  return (
    <aside className={`sidebar ${!isOpen ? 'sidebar-collapsed' : ''}`}>
      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `menu-item ${isActive ? 'active' : ''} ${item.special ? 'special' : ''}`
                  }
                  title={!isOpen ? item.label : undefined}
                >
                  <IconComponent size={18} />
                  {isOpen && <span>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle button at bottom of sidebar */}
      <button
        className="sidebar-toggle-btn"
        onClick={onToggle}
        title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>
    </aside>
  );
};

export default Sidebar;