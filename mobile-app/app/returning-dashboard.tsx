import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
import * as SecureStore from "expo-secure-store";
import DashboardCard from "../components/DashboardCard";
import AppHeader from "../components/AppHeader";

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

export default function ReturningDashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      const token =
        Platform.OS === "web"
          ? localStorage.getItem("token")
          : await SecureStore.getItemAsync("token");

      if (!token) {
        router.replace("/");
        return;
      }

      const decoded = jwtDecode<TokenPayload>(token);
      setEmail(decoded.email);
    };

    loadUser();
  }, []);

  return (
    <View style={styles.safeArea}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.welcome}>Welcome Back 🌟</Text>
        <Text style={styles.subtitle}>
          Let’s continue your learning journey.
        </Text>

        <DashboardCard
          title="📢 Announcements"
          description="Stay updated with course information."
          onPress={() => router.push("/(tabs)/announcements")}
        />

        <DashboardCard
          title="📚 Learning Materials"
          description="Access resources and recordings easily."
        />

        <DashboardCard
          title="💬 Support & Community"
          description="Connect with peers and educators."
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },
  container: { padding: 20 },
  welcome: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 20 },
});