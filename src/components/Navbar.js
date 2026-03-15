import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../lib/supabase';

const ADMIN_EMAIL = 'faddistpej.gg@gmail.com';

const Navbar = () => {
  const { user, profile } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
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
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Admin
            </NavLink>
          )}
        </div>

        <div className="nav-right">
          {profile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              background: 'var(--bg-3)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'var(--text-2)',
              fontFamily: 'var(--font-mono)',
            }}>
              <span style={{ color: 'var(--accent)', fontSize: '11px' }}>@</span>
              {profile.username}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
