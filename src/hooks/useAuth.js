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

    const finish = (sessionUser) => {
      if (settled) return;
      settled = true;
      setUser(sessionUser ?? null);
      if (sessionUser) {
        loadProfile(sessionUser.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    };

    // Hard timeout — if getSession takes more than 3s, just proceed as logged out
    const timeout = setTimeout(() => {
      console.warn('Session restore timed out');
      finish(null);
    }, 3000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      finish(session?.user);
    }).catch(() => {
      clearTimeout(timeout);
      finish(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // TOKEN_REFRESHED or SIGNED_IN after initial load
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id);
          setLoading(false);
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
