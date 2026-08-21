import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { fetchMe, login as loginRequest, logout as logoutRequest } from '../api/auth.api';
import { clearAuthHeader, setAuthHeader, setSessionExpiredHandler } from '../api/client';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../api/tokenStore';

const AuthContext = createContext(null);

// status: 'booting' | 'signedOut' | 'signedIn'
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('booting');
  const [user, setUser] = useState(null);
  const [permVersion, setPermVersion] = useState(null);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setPermVersion(null);
      setStatus('signedOut');
    });
  }, []);

  useEffect(() => {
    (async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setStatus('signedOut');
        return;
      }

      setAuthHeader(accessToken);
      try {
        const me = await fetchMe();
        setUser(me.user);
        setPermVersion(me.permVersion);
        setStatus('signedIn');
      } catch {
        // Expired/invalid tokens are handled by the client's 401 refresh flow;
        // if we land here, refresh itself failed and already cleared storage.
        setStatus('signedOut');
      }
    })();
  }, []);

  const signIn = async ({ username, password }) => {
    const result = await loginRequest({ username, password });
    await setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    setAuthHeader(result.accessToken);

    const me = await fetchMe();
    setUser(me.user);
    setPermVersion(me.permVersion);
    setStatus('signedIn');
  };

  const signOut = async () => {
    const refreshToken = await getRefreshToken();
    await logoutRequest({ refreshToken });
    await clearTokens();
    clearAuthHeader();
    setUser(null);
    setPermVersion(null);
    setStatus('signedOut');
  };

  const value = useMemo(
    () => ({ status, user, permVersion, signIn, signOut }),
    [status, user, permVersion]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
