import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('restoring'); // restoring | authed | anon

  // Restore on mount. The httpOnly cookie is authoritative, so this succeeds
  // after a hard refresh even when localStorage was cleared.
  useEffect(() => {
    let cancelled = false;
    api.request('/auth/me')
      .then((data) => { if (!cancelled) { setUser(data.user); setStatus('authed'); } })
      .catch(() => { if (!cancelled) { setUser(null); setStatus('anon'); } });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    api.setToken(data.token);
    setUser(data.user);
    setStatus('authed');
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    api.setToken(null);
    setUser(null);
    setStatus('anon');
  }, []);

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
