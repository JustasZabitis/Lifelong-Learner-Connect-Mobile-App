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

export default function WorkingDashboard() {
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
        <Text style={styles.welcome}>Welcome back 👋</Text>
        <Text style={styles.email}>{email}</Text>

        {/* Quick Info Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statLabel}>New Announcements</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>2</Text>
            <Text style={styles.statLabel}>Upcoming Deadlines</Text>
          </View>
        </View>

        {/* Feature Cards */}
        <DashboardCard
          title="📢 Announcements"
          description="View important course and institution updates."
          onPress={() => router.push("/(tabs)/announcements")}
        />

        <DashboardCard
          title="💬 Messages"
          description="Check messages from educators and classmates."
        />

        <DashboardCard
          title="📚 Resource Hub"
          description="Access materials, recordings and downloads."
        />

        <DashboardCard
          title="📅 Calendar"
          description="See deadlines and sync events."
        />

        <DashboardCard
          title="📈 Progress"
          description="Track your learning progress and achievements."
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },

  container: {
    padding: 20,
  },

  welcome: {
    fontSize: 22,
    fontWeight: "700",
  },

  email: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },

  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  statBox: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 5,
    alignItems: "center",
    elevation: 3,
  },

  statNumber: {
    fontSize: 20,
    fontWeight: "700",
  },

  statLabel: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
    textAlign: "center",
  },
});