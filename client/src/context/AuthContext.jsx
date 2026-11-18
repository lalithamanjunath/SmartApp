import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, dataOf } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/auth/csrf')
      .then(() => api.get('/auth/me'))
      .then((response) => { if (active) setUser(dataOf(response)?.user || null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async login(credentials) {
      await api.get('/auth/csrf');
      const response = await api.post('/auth/login', credentials);
      const nextUser = dataOf(response).user;
      setUser(nextUser);
      return nextUser;
    },
    async register(details) {
      await api.get('/auth/csrf');
      const response = await api.post('/auth/register', details);
      const nextUser = dataOf(response).user;
      setUser(nextUser);
      return nextUser;
    },
    async logout() {
      try { await api.post('/auth/logout'); } finally { setUser(null); }
    },
    updateUser(nextUser) { setUser(nextUser); },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
