import React from 'react';
import { Menu, User, LogOut } from 'lucide-react';
import { useAuth } from "../../context/UserContext";
import { useNavigate } from 'react-router-dom';
import NotificationCenter from '../NotificationCenter';

const Navbar = ({toggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="menu-toggle" onClick={toggleSidebar}>
          <Menu size={20} />
        </button>
        <div className="navbar-brand">
          <h1>SNFalyze.ai</h1>
          <span>M&A Deal Analysis Platform</span>
        </div>
      </div>

      <div className="navbar-right">
        <NotificationCenter />
        <button
          className="nav-btn"
          onClick={() => navigate('/profile')}
          title="My Profile"
        >
          <User size={16} />
          {user.first_name} {user.last_name}
        </button>
        <button className="nav-btn" onClick={handleLogout}>
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
