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

export default function EducatorDashboard() {
  // useRouter lets us navigate to other screens when a card is pressed
  const router = useRouter();

  return (
    <View style={styles.safeArea}>
      {/* Shared header bar with logo, role badge, and logout button */}
      <AppHeader />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Page title — visible at the top of the scroll area */}
        <Text style={styles.welcome}>Educator Dashboard 👩‍🏫</Text>

        {/* Horizontal shortcut row (e.g. messages, calendar icons) */}
        <QuickLinks />

        {/* Card: tap to go straight to the announcements tab */}
        <DashboardCard
          title="📢 Post Announcement"
          description="Create and manage course announcements."
          onPress={() => router.push("/(tabs)/announcements")}
        />

        {/* Card: placeholder for future engagement analytics feature */}
        <DashboardCard
          title="📊 Engagement Analytics"
          description="View read receipts and participation trends."
        />

        {/* Card: placeholder for a future assessments and grading feature */}
        <DashboardCard
          title="📝 Assessments"
          description="Manage assignments and grading."
        />

        {/* Card: placeholder for the direct messaging feature */}
        <DashboardCard
          title="💬 Messaging"
          description="Communicate directly with learners."
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-height container with a soft grey background
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },

  // Padding around all the scrollable content
  container: { padding: 20 },

  // Large bold page title at the top of the screen
  welcome: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
});
