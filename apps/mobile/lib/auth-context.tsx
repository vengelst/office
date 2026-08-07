import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { router } from 'expo-router';
import {
  workerApi,
  getToken,
  setToken,
  setWorkerSession,
  clearSession,
  type WorkerMe,
} from './api';

interface AuthState {
  worker: WorkerMe | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [worker, setWorker] = useState<WorkerMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const me = await workerApi.me();
          setWorker(me);
        } catch {
          await clearSession();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (pin: string) => {
    const res = await workerApi.pinLogin(pin);
    // Token zuerst ablegen, damit der anschließende /me-Call authentifiziert ist.
    await setToken(res.accessToken);
    const me = await workerApi.me();
    await setWorkerSession(res.accessToken, me);
    setWorker(me);
    router.replace('/(app)');
  }, []);

  const logout = useCallback(async () => {
    try {
      await workerApi.logout();
    } catch {
      /* ignore logout errors */
    }
    await clearSession();
    setWorker(null);
    router.replace('/(auth)/login');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await workerApi.me();
      setWorker(me);
    } catch {
      await clearSession();
      setWorker(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        worker,
        isLoading,
        isAuthenticated: !!worker,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
