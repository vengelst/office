'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginResponse } from '@office/types';
import { apiClient, TOKEN_STORAGE_KEY } from './api-client';

const USER_STORAGE_KEY = 'office_user';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistUser = useCallback((next: AuthUser) => {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await apiClient.get<AuthUser>('/auth/me');
    persistUser(me);
  }, [persistUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
        const storedUser = window.localStorage.getItem(USER_STORAGE_KEY);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser) as AuthUser);
          try {
            const me = await apiClient.get<AuthUser>('/auth/me');
            if (!cancelled) {
              window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me));
              setUser(me);
            }
          } catch {
            // Session abgelaufen – lokal belassen bis Logout
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiClient.post<LoginResponse>(
        '/auth/login',
        { email, password },
        { skipAuth: true },
      );
      window.localStorage.setItem(TOKEN_STORAGE_KEY, res.accessToken);
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
      setToken(res.accessToken);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    }
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isLoading,
      login,
      logout,
      refreshMe,
    }),
    [user, token, isLoading, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  }
  return ctx;
}
