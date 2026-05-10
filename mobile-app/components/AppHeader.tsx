/**
 * App header component showing user info, notifications, and logout button.
 * Also polls the server periodically to detect force-logout or suspension.
 *
 * The bell icon fetches the user's in-app notifications from
 * GET /api/academic/my-notifications and shows them in a dropdown panel.
 * Unread count is shown as a red badge. Opening the panel marks all as read.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL } from "../config";
import { useAccessibility } from "../contexts/AccessibilityContext";

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  created_at: string;
}

// Poll interval to check if user has been force-logged out or suspended
const SESSION_POLL_MS = 20_000; // 20 seconds
// How often to re-fetch notification count while panel is closed
const NOTIF_POLL_MS = 30_000; // 30 seconds

const TYPE_COLORS: Record<string, string> = {
  info: "#2563eb",
  success: "#16a34a",
  warning: "#d97706",
  error: "#dc2626",
};

const TYPE_ICONS: Record<string, string> = {
  info: "information-circle-outline",
  success: "checkmark-circle-outline",
  warning: "warning-outline",
  error: "alert-circle-outline",
};

async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem("token");
  return SecureStore.getItemAsync("token");
}

async function removeToken(): Promise<void> {
  if (Platform.OS === "web") localStorage.removeItem("token");
  else await SecureStore.deleteItemAsync("token");
}

export default function AppHeader() {
  const [user, setUser] = useState<TokenPayload | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const router = useRouter();
  const { colors } = useAccessibility();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const clearSessionAndRedirect = useCallback(async () => {
    await removeToken();
    router.replace("/");
  }, [router]);

  const fetchNotifications = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/api/academic/my-notifications`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // Network errors: silently skip — don't disrupt the UI
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      await fetch(`${BASE_URL}/api/academic/my-notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Silently ignore — badge will clear on next fetch
    }
  }, []);

  // ─── Load user from token ────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) { router.replace("/"); return; }
      setUser(jwtDecode<TokenPayload>(token));
    })();
  }, []);

  // ─── Initial + periodic notification fetch ───────────────────────────────────

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, NOTIF_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // ─── Session validity poll ───────────────────────────────────────────────────

  useEffect(() => {
    const checkSession = async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(`${BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (res.status === 401 || res.status === 403) await clearSessionAndRedirect();
      } catch {
        // Network errors don't trigger logout
      }
    };
    const interval = setInterval(checkSession, SESSION_POLL_MS);
    return () => clearInterval(interval);
  }, [clearSessionAndRedirect]);

  // ─── Logout ──────────────────────────────────────────────────────────────────

  const logout = async () => {
    try {
      await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch { /* ignore */ }
    await removeToken();
    router.replace("/");
  };

  // ─── Bell press ─────────────────────────────────────────────────────────────

  const handleBellPress = async () => {
    setPanelOpen(true);
    await fetchNotifications(); // refresh on open
    if (unreadCount > 0) await markAllRead();
  };

  if (!user) return null;

  const headerBg =
    colors.background === "#0f172a"
      ? "#0f172a"
      : colors.background === "#000000"
      ? "#000000"
      : "#111827";

  return (
    <>
      <View style={[styles.container, { backgroundColor: headerBg }]}>
        {/* Left: logo + role badge */}
        <View style={styles.left}>
          <Text style={styles.logo}>LLC</Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
          </View>
        </View>

        {/* Right: bell, avatar, logout */}
        <View style={styles.right}>
          <TouchableOpacity style={styles.bellButton} onPress={handleBellPress}>
            <Ionicons name="notifications-outline" size={20} color="#ffffff" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.email.charAt(0).toUpperCase()}
            </Text>
          </View>

          <TouchableOpacity onPress={logout}>
            <Text style={styles.logout}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Notification panel modal ─────────────────────────────────────────── */}
      <Modal
        visible={panelOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPanelOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setPanelOpen(false)}>
          <Pressable
            style={styles.panel}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header row */}
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setPanelOpen(false)}>
                <Ionicons name="close-outline" size={22} color="#374151" />
              </TouchableOpacity>
            </View>

            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={36} color="#9ca3af" />
                <Text style={styles.emptyText}>No notifications yet</Text>
              </View>
            ) : (
              <ScrollView style={styles.notifList} showsVerticalScrollIndicator={false}>
                {notifications.map((n) => (
                  <View
                    key={n.id}
                    style={[
                      styles.notifItem,
                      !n.is_read && styles.notifUnread,
                    ]}
                  >
                    <Ionicons
                      name={TYPE_ICONS[n.type] as any}
                      size={20}
                      color={TYPE_COLORS[n.type]}
                      style={styles.notifIcon}
                    />
                    <View style={styles.notifBody}>
                      <Text style={styles.notifTitle}>{n.title}</Text>
                      <Text style={styles.notifMessage}>{n.message}</Text>
                      <Text style={styles.notifDate}>
                        {new Date(n.created_at).toLocaleDateString("en-IE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  right: { flexDirection: "row", alignItems: "center", gap: 14 },
  bellButton: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  avatar: {
    backgroundColor: "#374151",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#ffffff", fontWeight: "600" },
  logout: { color: "#ef4444", fontWeight: "600" },

  // ─── Modal ───────────────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingRight: 12,
  },
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    width: 320,
    maxHeight: 460,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  panelTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: { color: "#9ca3af", fontSize: 14 },
  notifList: { maxHeight: 380 },
  notifItem: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 10,
  },
  notifUnread: { backgroundColor: "#eff6ff" },
  notifIcon: { marginTop: 2 },
  notifBody: { flex: 1 },
  notifTitle: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 2 },
  notifMessage: { fontSize: 13, color: "#374151", lineHeight: 18 },
  notifDate: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
});
