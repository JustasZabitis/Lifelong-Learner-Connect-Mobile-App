/**
 * Context for managing feature flags loaded from the backend.
 * Allows admins to toggle features on/off without code changes.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { BASE_URL } from "../config";

interface FeatureFlagsContextType {
  flags: Record<string, boolean>;
  flagList: { flag_key: string; enabled: boolean; label: string }[];
  loading: boolean;
  isEnabled: (key: string) => boolean;
  refresh: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  flags: {},
  flagList: [],
  loading: true,
  // Default to false while loading to prevent UI flash of unwanted features
  isEnabled: () => false,
  refresh: async () => {},
});

// Helper to get token from platform-specific storage
const getToken = async (): Promise<string | null> =>
  Platform.OS === "web"
    ? localStorage.getItem("token")
    : SecureStore.getItemAsync("token");

// Provider component that wraps the app with feature flag state
export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [flagList, setFlagList] = useState<{ flag_key: string; enabled: boolean; label: string }[]>([]);
  const [loading, setLoading] = useState(false); // Don't block initial render
  const [fetched, setFetched] = useState(false); // Track if flags have been loaded

  // Fetches feature flags from the backend
  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();

      if (!token) {
        // User not logged in; can't load flags
        setLoading(false);
        return;
      }

      // Fetch flags from backend API
      const res = await fetch(`${BASE_URL}/api/features`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags || {});
        setFlagList(data.flagList || []);
        setFetched(true); // Mark as successfully loaded
      }
    } catch (err) {
      console.error("Failed to fetch feature flags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch flags on mount
  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  // Helper to check if a feature is enabled
  const isEnabled = useCallback(
    (key: string): boolean => {
      // While loading, hide everything to prevent feature flash
      if (!fetched) return false;

      // If flag doesn't exist in DB, default to enabled (feature on)
      if (flags[key] === undefined) return true;

      // Return the flag's actual value
      return flags[key];
    },
    [flags, fetched]
  );

  return (
    <FeatureFlagsContext.Provider value={{ flags, flagList, loading, isEnabled, refresh: fetchFlags }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

// Custom hook to access feature flags from anywhere in the app
export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}