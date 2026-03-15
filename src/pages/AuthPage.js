import React, { useState } from 'react';
import { signIn, signUp } from '../lib/supabase';

// Change this to whatever secret code you want your group to use
const INVITE_CODE = 'ipl2026';

const AuthPage = () => {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '', inviteCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(form.email, form.password);
      if (error) setError(error.message);
    } else {
      // Check invite code first
      if (form.inviteCode.trim().toLowerCase() !== INVITE_CODE.toLowerCase()) {
        setError('Invalid invite code. Ask the group admin for access.');
        setLoading(false);
        return;
      }
      if (!form.username.match(/^[a-z0-9_]{3,20}$/i)) {
        setError('Username must be 3–20 chars, letters/numbers/underscore only');
        setLoading(false);
        return;
      }
      const { error } = await signUp(form.email, form.password, form.username, form.displayName || form.username);
      if (error) setError(error.message);
      else setSuccess('Account created! You can now sign in.');
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '18px',
            color: 'var(--accent)',
            letterSpacing: '0.1em',
            marginBottom: '8px',
          }}>
            IPL·BETS
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>
            IPL 2026 Private Betting Group
          </div>
        </div>

        <div className="card" style={{ padding: '28px' }}>
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '24px',
            background: 'var(--bg-3)',
            padding: '4px',
            borderRadius: 'var(--radius)',
          }}>
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  fontSize: '13px',
                  fontWeight: mode === m ? 500 : 400,
                  color: mode === m ? 'var(--text)' : 'var(--text-3)',
                  background: mode === m ? 'var(--bg-2)' : 'transparent',
                  border: mode === m ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textTransform: 'capitalize',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input
                    className="form-input"
                    placeholder="Your name"
                    value={form.displayName}
                    onChange={set('displayName')}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    className="form-input"
                    placeholder="e.g. rahul_93"
                    value={form.username}
                    onChange={set('username')}
                    required
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                required
                minLength={6}
              />
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Invite Code</label>
                <input
                  className="form-input"
                  placeholder="Ask your group admin"
                  value={form.inviteCode}
                  onChange={set('inviteCode')}
                  required
                />
              </div>
            )}

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <button
              type="submit"
              className="btn btn-primary btn-full"
              style={{ marginTop: '4px', padding: '11px' }}
              disabled={loading}
            >
              {loading
                ? <><span className="spinner" style={{ borderTopColor: 'var(--bg)' }} /> Loading...</>
                : (mode === 'login' ? 'Sign in' : 'Create account')
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
