/**
 * Part-time student dashboard — home screen for users with the "parttime" role.
 * Focuses on schedule management since part-time learners often juggle work
 * and study commitments. Shows a greeting, quick links, and feature cards
 * for the calendar, announcements, and resource hub.
 */

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
import * as SecureStore from "expo-secure-store";
import DashboardCard from "../components/DashboardCard";
import AppHeader from "../components/AppHeader";
import QuickLinks from "../components/QuickLinks";

// Shape of the fields we care about inside the decoded JWT
interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

export default function PartTimeDashboard() {
  // useRouter lets us navigate programmatically (e.g. redirect to login)
  const router = useRouter();

  // We only store the email so we can display a personalised greeting
  const [email, setEmail] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      // On web we read from localStorage; on iOS/Android we use SecureStore
      const token =
        Platform.OS === "web"
          ? localStorage.getItem("token")
          : await SecureStore.getItemAsync("token");

      // No token means the user isn't logged in — kick them back to the login screen
      if (!token) {
        router.replace("/");
        return;
      }

      // Decode the JWT payload to pull out the user's email for the greeting
      const decoded = jwtDecode<TokenPayload>(token);
      setEmail(decoded.email);
    };

    loadUser();
  }, []);

  return (
    <View style={styles.safeArea}>
      {/* Shared header bar with logo, role badge, and logout button */}
      <AppHeader />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Greeting message at the top of the screen */}
        <Text style={styles.welcome}>Hello 👋</Text>

        {/* Short tagline that frames the part-time experience */}
        <Text style={styles.subtitle}>
          Manage your schedule efficiently.
        </Text>

        {/* Horizontal row of icon shortcuts (messages, calendar, etc.) */}
        <QuickLinks />

        {/* Card: placeholder for a future calendar and deadlines feature */}
        <DashboardCard
          title="📅 Calendar & Deadlines"
          description="View upcoming classes and submissions."
        />

        {/* Card: navigates directly to the announcements tab */}
        <DashboardCard
          title="📢 Announcements"
          description="See new course updates."
          onPress={() => router.push("/(tabs)/announcements")}
        />

        {/* Card: placeholder for quick access to course materials */}
        <DashboardCard
          title="📂 Quick Resources"
          description="Access materials instantly."
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-height wrapper with a light grey background
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },

  // Padding inside the scrollable content area
  container: { padding: 20 },

  // Large bold greeting at the top of the page
  welcome: { fontSize: 22, fontWeight: "700" },

  // Smaller muted tagline shown directly below the greeting
  subtitle: { fontSize: 14, color: "#666", marginBottom: 20 },
});
