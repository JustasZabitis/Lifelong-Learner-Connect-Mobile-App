import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import DashboardCard from "../components/DashboardCard";
import AppHeader from "../components/AppHeader";

export default function AdminDashboard() {
  return (
    <View style={styles.safeArea}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.welcome}>Admin Control Panel 🏛</Text>

        <DashboardCard
          title="👥 User Management"
          description="Manage users and roles."
        />

        <DashboardCard
          title="📢 System Announcements"
          description="Broadcast institution-wide messages."
        />

        <DashboardCard
          title="📈 System Analytics"
          description="Monitor app usage and engagement."
        />

        <DashboardCard
          title="⚙️ Settings"
          description="Configure system-level preferences."
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