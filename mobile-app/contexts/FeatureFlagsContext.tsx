
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
  isEnabled: () => true,
  refresh: async () => {},
});

const getToken = async (): Promise<string | null> =>
  Platform.OS === "web"
    ? localStorage.getItem("token")
    : SecureStore.getItemAsync("token");

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [flagList, setFlagList] = useState<{ flag_key: string; enabled: boolean; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${BASE_URL}/api/features`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags || {});
        setFlagList(data.flagList || []);
      }
    } catch (err) {
      console.error("Failed to fetch feature flags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const isEnabled = useCallback(
    (key: string): boolean => {
      // Default to true if flag doesn't exist (don't block unknown features)
      if (flags[key] === undefined) return true;
      return flags[key];
    },
    [flags]
  );

  return (
    <FeatureFlagsContext.Provider value={{ flags, flagList, loading, isEnabled, refresh: fetchFlags }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}