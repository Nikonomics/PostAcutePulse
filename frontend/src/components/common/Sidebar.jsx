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
} from 'lucide-react';
import { useAuth } from "../../context/UserContext";

const Sidebar = ({ isOpen }) => {
  const { user } = useAuth();

  // Define all menu items
  const allMenuItems = [
    { path: '/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/provider-search', icon: Search, label: 'Provider Lookup' },
    { path: '/market-analysis', icon: MapPin, label: 'Market Analysis' },
    { path: '/ownership-research', icon: Building2, label: 'Ownership Research' },
    { path: '/ma-intelligence', icon: ArrowLeftRight, label: 'M&A Intelligence' },
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
      ['/dashboard', '/provider-search', '/market-analysis', '/ownership-research', '/ma-intelligence', '/survey-analytics', '/reports', '/data-dictionary', '/saved-items', '/ai-assistant'].includes(item.path)
    );
  }

  return (
    <aside className={`sidebar ${!isOpen ? 'sidebar-hidden' : ''}`}>
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
                >
                  <IconComponent size={18} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;