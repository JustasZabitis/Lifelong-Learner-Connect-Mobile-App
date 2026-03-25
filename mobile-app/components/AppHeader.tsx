/**
 * App header component showing user info, notifications, and logout button.
 * Also polls the server periodically to detect force-logout or suspension.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { useRouter } from "expo-router";
import { BASE_URL } from "../config";

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

// Poll interval to check if user has been force-logged out or suspended
const SESSION_POLL_MS = 20_000; // 20 seconds

export default function AppHeader() {
  const [user, setUser] = useState<TokenPayload | null>(null);
  const router = useRouter();

  // Clears stored token and redirects to login page
  const clearSessionAndRedirect = async () => {
    if (Platform.OS === "web") {
      localStorage.removeItem("token");
    } else {
      await SecureStore.deleteItemAsync("token");
    }
    router.replace("/");
  };

  // Load current user from token on component mount
  useEffect(() => {
    const loadUser = async () => {
      // Retrieve token from platform-specific storage
      let token;

      if (Platform.OS === "web") {
        token = localStorage.getItem("token");
      } else {
        token = await SecureStore.getItemAsync("token");
      }

      if (!token) {
        router.replace("/");
        return;
      }

      // Decode JWT to extract user info (id, email, role)
      const decoded = jwtDecode<TokenPayload>(token);
      setUser(decoded);
    };

    loadUser();
  }, []);

  // Periodically check if user's session is still valid (detects force-logout and suspension)
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Get current token from storage
        let token: string | null = null;
        if (Platform.OS === "web") {
          token = localStorage.getItem("token");
        } else {
          token = await SecureStore.getItemAsync("token");
        }

        if (!token) return; // User not logged in, nothing to check

        // Ping /api/auth/me to verify session is still valid
        const res = await fetch(`${BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });

        // If we get 401/403, session has been revoked by admin or account suspended
        if (res.status === 401 || res.status === 403) {
          await clearSessionAndRedirect();
        }
      } catch {
        // Network errors don't trigger logout; wait for next poll
      }
    };

    // Set up polling interval and clean it up on unmount
    const interval = setInterval(checkSession, SESSION_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Handles user logout by clearing token and notifying backend
  const logout = async () => {
    try {
      // Call backend logout endpoint to clear httpOnly cookie
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Network errors don't block logout; continue clearing local storage
    }

    // Clear token from device storage
    if (Platform.OS === "web") {
      localStorage.removeItem("token");
    } else {
      await SecureStore.deleteItemAsync("token");
    }

    // Redirect to login page
    router.replace("/");
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      {/* Left side: Logo and user role badge */}
      <View style={styles.left}>
        <Text style={styles.logo}>LLC</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
        </View>
      </View>

      {/* Right side: Notifications, avatar, and logout button */}
      <View style={styles.right}>
        <Text style={styles.icon}>🔔</Text>

        {/* Avatar showing first letter of email */}
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
    backgroundColor: "#2563eb",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  right: { flexDirection: "row", alignItems: "center", gap: 14 },
  icon: { fontSize: 18, color: "#ffffff" },
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
});