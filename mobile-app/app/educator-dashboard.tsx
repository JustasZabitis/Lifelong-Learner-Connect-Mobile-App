/**
 * Educator dashboard — the home screen for users with the "educator" role.
 * Gives educators quick access to announcements, analytics, assessments,
 * and messaging so they can manage their courses from one place.
 */

import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import DashboardCard from "../components/DashboardCard";
import AppHeader from "../components/AppHeader";
import QuickLinks from "../components/QuickLinks";
import { useAccessibility } from "../contexts/AccessibilityContext";

export default function EducatorDashboard() {
  // useRouter lets us navigate to other screens when a card is pressed
  const router = useRouter();
  const { colors, t } = useAccessibility();

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Shared header bar with logo, role badge, and logout button */}
      <AppHeader />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Page title — visible at the top of the scroll area */}
        <Text style={[styles.welcome, { color: colors.text }]}>{t("educator_dashboard")} 👩‍🏫</Text>

        {/* Horizontal shortcut row (e.g. messages, calendar icons) */}
        <QuickLinks />

        {/* Card: tap to go straight to the announcements tab */}
        <DashboardCard
          title={`📢 ${t("educator_post_announcement")}`}
          description={t("educator_post_announcement_desc")}
          onPress={() => router.push("/(tabs)/announcements")}
        />

        {/* Card: placeholder for future engagement analytics feature */}
        <DashboardCard
          title={`📊 ${t("educator_analytics")}`}
          description={t("educator_analytics_desc")}
        />

        {/* Card: placeholder for a future assessments and grading feature */}
        <DashboardCard
          title={`📝 ${t("educator_assessments")}`}
          description={t("educator_assessments_desc")}
        />

        {/* Card: placeholder for the direct messaging feature */}
        <DashboardCard
          title={`💬 ${t("educator_messaging")}`}
          description={t("educator_messaging_desc")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-height container with a soft grey background
  safeArea: { flex: 1 },

  // Padding around all the scrollable content
  container: { padding: 20 },

  // Large bold page title at the top of the screen
  welcome: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
});
