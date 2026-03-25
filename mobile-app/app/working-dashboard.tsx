/**
 * Student dashboard — the home screen for users with the "student" role.
 * Shows a welcome message, quick stats, shortcuts, and navigation cards
 * to the main features of the app.
 */

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
import * as SecureStore from "expo-secure-store";
import DashboardCard from "../components/DashboardCard";
import AppHeader from "../components/AppHeader";
import QuickLinks from "../components/QuickLinks";

// Shape of the decoded JWT payload
interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

export default function WorkingDashboard() {
  const router = useRouter();
  // Store just the email for the welcome message
  const [email, setEmail] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      // Get the token from the right storage depending on the platform
      const token =
        Platform.OS === "web"
          ? localStorage.getItem("token")
          : await SecureStore.getItemAsync("token");

      // If there's no token the user isn't logged in — send them back to the login screen
      if (!token) {
        router.replace("/");
        return;
      }

      // Decode the JWT to extract the user's email for the greeting
      const decoded = jwtDecode<TokenPayload>(token);
      setEmail(decoded.email);
    };

    loadUser();
  }, []);

  return (
    <View style={styles.safeArea}>
      {/* Header bar with logo, role badge, and logout button */}
      <AppHeader />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Greeting and user email */}
        <Text style={styles.welcome}>Welcome back 👋</Text>
        <Text style={styles.email}>{email}</Text>

        {/* Quick summary stats — hardcoded placeholders for now */}
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

        {/* Horizontal quick-link shortcuts (e.g. messages, calendar) */}
        <QuickLinks />

        {/* Navigation cards for each major feature */}
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
  // Full-height container with a light grey background
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },

  // Padding around the scrollable content
  container: {
    padding: 20,
  },

  // Large bold greeting text at the top
  welcome: {
    fontSize: 22,
    fontWeight: "700",
  },

  // Smaller muted email shown below the greeting
  email: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },

  // Row container for the two stat boxes
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  // Individual stat card with white background and shadow
  statBox: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 5,
    alignItems: "center",
    elevation: 3,
  },

  // Big bold number inside the stat box
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
  },

  // Small label text below the number
  statLabel: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
    textAlign: "center",
  },
});
