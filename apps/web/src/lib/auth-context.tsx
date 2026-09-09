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
  /** Meldet an und liefert den angemeldeten Benutzer (für rollenabhängige Weiterleitung). */
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Frische Rollen/Permissions von GET /auth/me. */
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Prüft, ob der Benutzer eine Permission besitzt.
 * SUPERADMIN gilt als Vollzugriff.
 */
export function hasPermission(
  user: AuthUser | null | undefined,
  code: string,
): boolean {
  if (!user) return false;
  if (user.roles?.includes('SUPERADMIN')) return true;
  return Boolean(user.permissions?.includes(code));
}

/**
 * True, wenn mindestens eine der Permissions vorhanden ist.
 */
export function hasAnyPermission(
  user: AuthUser | null | undefined,
  codes: string[],
): boolean {
  return codes.some((c) => hasPermission(user, c));
}

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistUser = useCallback((next: AuthUser, accessToken?: string) => {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next));
    setUser(next);
    if (accessToken) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      setToken(accessToken);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await apiClient.get<AuthUser>('/auth/me');
    persistUser(me);
  }, [persistUser]);

  // Token/User aus localStorage wiederherstellen, dann Permissions frisch laden.
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
            // /me fehlgeschlagen – gespeicherten User behalten
          }
        }
      } catch {
        // Ungültiger Storage-Inhalt – ignorieren.
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
      persistUser(res.user, res.accessToken);
      return res.user;
    },
    [persistUser],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Logout serverseitig fehlgeschlagen – lokal trotzdem bereinigen.
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
