import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";
import { BASE_URL } from "../config";

const getToken = async (): Promise<string | null> =>
  Platform.OS === "web"
    ? localStorage.getItem("token")
    : SecureStore.getItemAsync("token");

const FLAG_ICONS: Record<string, string> = {
  announcements: "megaphone-outline",
  messages: "chatbubble-outline",
  group_chat: "people-outline",
  calendar: "calendar-outline",
  forum: "chatbubbles-outline",
  progress: "trending-up-outline",
  competitions: "trophy-outline",
  resources: "folder-outline",
};

export default function FeatureManager() {
  const { flagList, loading, refresh } = useFeatureFlags();
  const [updating, setUpdating] = useState<string | null>(null);

  const toggleFlag = async (flagKey: string, newValue: boolean) => {
    setUpdating(flagKey);
    try {
      const token = await getToken();
      await fetch(`${BASE_URL}/api/features`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ flag_key: flagKey, enabled: newValue }),
      });
      await refresh();
    } catch (err) {
      console.error("Failed to update flag:", err);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#2563eb" />
      </View>
    );
  }

  if (!loading && flagList.length === 0) {
    return (
      <View style={[styles.container, { padding: 16 }]}>
        <Text style={{ color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
          No feature flags found. Check server connection.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {flagList.map((flag) => (
        <View key={flag.flag_key} style={styles.row}>
          <View style={styles.rowInfo}>
            <Ionicons
              name={(FLAG_ICONS[flag.flag_key] || "toggle-outline") as any}
              size={20}
              color={flag.enabled ? "#2563eb" : "#9ca3af"}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, !flag.enabled && styles.labelDisabled]}>
                {flag.label}
              </Text>
              <Text style={styles.key}>{flag.flag_key}</Text>
            </View>
          </View>
          {updating === flag.flag_key ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <Switch
              value={flag.enabled}
              onValueChange={(val) => toggleFlag(flag.flag_key, val)}
              trackColor={{ false: "#d1d5db", true: "#2563eb" }}
              thumbColor="#fff"
            />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 4,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    minHeight: 50,
  },
  rowInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  labelDisabled: {
    color: "#9ca3af",
  },
  key: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 1,
  },
});