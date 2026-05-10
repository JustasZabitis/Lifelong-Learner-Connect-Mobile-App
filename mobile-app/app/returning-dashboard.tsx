/**
 * Returning student dashboard — home screen for users with the "returning" role.
 * Designed for learners who are coming back to education after a break.
 * Surfaces announcements, learning materials, and community support features
 * to help them settle back into study.
 */

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
import * as SecureStore from "expo-secure-store";
import DashboardCard from "../components/DashboardCard";
import AppHeader from "../components/AppHeader";
import QuickLinks from "../components/QuickLinks";
import { useAccessibility } from "../contexts/AccessibilityContext";

// The fields we need from the decoded JWT — id, email, and role
interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

export default function ReturningDashboard() {
  // useRouter lets us redirect to login if there's no valid token
  const router = useRouter();
  const { colors, t } = useAccessibility();

  // We store just the email to show a personalised welcome message
  const [email, setEmail] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      // Web uses localStorage; native iOS/Android uses Expo SecureStore
      const token =
        Platform.OS === "web"
          ? localStorage.getItem("token")
          : await SecureStore.getItemAsync("token");

      // If there's no token the session has expired — redirect to the login screen
      if (!token) {
        router.replace("/");
        return;
      }

      // Decode the JWT to get the user's email for the greeting line
      const decoded = jwtDecode<TokenPayload>(token);
      setEmail(decoded.email);
    };

    loadUser();
  }, []);

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Shared header bar at the top with the logo, role badge, and logout */}
      <AppHeader />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Warm welcome message aimed at returning learners */}
        <Text style={[styles.welcome, { color: colors.text }]}>{t("returning_welcome")}</Text>

        {/* Short motivational tagline below the heading */}
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t("returning_subtitle")}
        </Text>

        {/* Horizontal row of icon shortcuts (messages, calendar, etc.) */}
        <QuickLinks />

        {/* Card: navigates to the announcements tab so the user stays informed */}
        <DashboardCard
          title={`📢 ${t("tab_announcements")}`}
          description={t("returning_announcements_desc")}
          onPress={() => router.push("/(tabs)/announcements")}
        />

        {/* Card: placeholder for the resource hub feature */}
        <DashboardCard
          title={`📚 ${t("returning_materials")}`}
          description={t("returning_materials_desc")}
        />

        {/* Card: placeholder for messaging and forum community features */}
        <DashboardCard
          title={`💬 ${t("returning_community")}`}
          description={t("returning_community_desc")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-height screen wrapper — background set dynamically via inline style
  safeArea: { flex: 1 },

  // Padding around the scrollable content inside the screen
  container: { padding: 20 },

  // Large bold greeting at the very top of the content area
  welcome: { fontSize: 22, fontWeight: "700" },

  // Smaller muted tagline shown just below the greeting — colour set dynamically
  subtitle: { fontSize: 14, marginBottom: 20 },
});
