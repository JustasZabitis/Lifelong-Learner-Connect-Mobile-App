import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import DashboardCard from "../components/DashboardCard";
import AppHeader from "../components/AppHeader";

export default function EducatorDashboard() {
  const router = useRouter();

  return (
    <View style={styles.safeArea}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.welcome}>Educator Dashboard 👩‍🏫</Text>

        <DashboardCard
          title="📢 Post Announcement"
          description="Create and manage course announcements."
          onPress={() => router.push("/(tabs)/announcements")}
        />

        <DashboardCard
          title="📊 Engagement Analytics"
          description="View read receipts and participation trends."
        />

        <DashboardCard
          title="📝 Assessments"
          description="Manage assignments and grading."
        />

        <DashboardCard
          title="💬 Messaging"
          description="Communicate directly with learners."
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },
  container: { padding: 20 },
  welcome: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
});