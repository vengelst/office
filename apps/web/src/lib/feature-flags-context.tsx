/**
 * React-Context für Feature-Flags (Nav ausblenden, Settings-UI).
 */

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
import { useAuth } from './auth-context';
import {
  DEFAULT_FEATURE_FLAGS,
  featureFlagsApi,
  type FeatureFlagKey,
  type FeatureFlags,
} from './feature-flags';

interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  isLoading: boolean;
  refresh: () => Promise<void>;
  isEnabled: (key: FeatureFlagKey) => boolean;
  setLocalFlags: (flags: FeatureFlags) => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(
  undefined,
);

export function FeatureFlagsProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [flags, setFlags] = useState<FeatureFlags>({ ...DEFAULT_FEATURE_FLAGS });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setFlags({ ...DEFAULT_FEATURE_FLAGS });
      setIsLoading(false);
      return;
    }
    try {
      const next = await featureFlagsApi.get();
      setFlags({ ...DEFAULT_FEATURE_FLAGS, ...next });
    } catch {
      setFlags({ ...DEFAULT_FEATURE_FLAGS });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      flags,
      isLoading,
      refresh,
      isEnabled: (key) => flags[key] !== false,
      setLocalFlags: setFlags,
    }),
    [flags, isLoading, refresh],
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) {
    throw new Error('useFeatureFlags muss innerhalb FeatureFlagsProvider genutzt werden');
  }
  return ctx;
}
