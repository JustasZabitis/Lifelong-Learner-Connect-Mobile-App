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

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

export default function AppHeader() {
  const [user, setUser] = useState<TokenPayload | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
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

      const decoded = jwtDecode<TokenPayload>(token);
      setUser(decoded);
    };

    loadUser();
  }, []);

  const logout = async () => {
    if (Platform.OS === "web") {
      localStorage.removeItem("token");
    } else {
      await SecureStore.deleteItemAsync("token");
    }
    router.replace("/");
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.logo}>LLC</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.icon}>🔔</Text>

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