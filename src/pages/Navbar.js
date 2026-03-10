import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../lib/supabase';

const Navbar = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <span className="nav-logo">IPL·BETS</span>

        <div className="nav-links">
          <NavLink to="/matches" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Matches
          </NavLink>
          <NavLink to="/leaderboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Leaderboard
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            My Profile
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Admin
          </NavLink>
        </div>

        <div className="nav-right">
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
