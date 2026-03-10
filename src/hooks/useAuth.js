import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getProfile } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId) => {
    try {
      const { data } = await getProfile(userId);
      if (data) setProfile(data);
    } catch (e) {}
  };

  useEffect(() => {
    let settled = false;

    const finish = async (sessionUser) => {
      if (settled) return;
      settled = true;
      setUser(sessionUser ?? null);
      if (sessionUser) {
        await loadProfile(sessionUser.id);
      }
      setLoading(false);
    };

    // 1. First try reading from localStorage directly — zero network, instant
    const storageKey = 'ipl-bets-auth';
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const sessionUser = parsed?.user ?? parsed?.session?.user ?? null;
        const expiresAt = parsed?.expires_at ?? parsed?.session?.expires_at ?? 0;
        const isExpired = expiresAt && (expiresAt * 1000) < Date.now();

        if (sessionUser && !isExpired) {
          // Valid session in localStorage — use it immediately, skip network
          finish(sessionUser);
          // Still refresh token in background silently
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user && !settled) finish(session.user);
          }).catch(() => {});
          return;
        }
      }
    } catch (e) {}

    // 2. No local session found — do a real getSession with timeout
    const timeout = setTimeout(() => {
      console.warn('Session restore timed out');
      finish(null);
    }, 4000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      finish(session?.user ?? null);
    }).catch(() => {
      clearTimeout(timeout);
      finish(null);
    });

    // 3. Listen for auth changes (sign in / sign out / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            setUser(session.user);
            await loadProfile(session.user.id);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = () => {
    if (user) loadProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
