import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

export default function ReturningDashboard() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Return to Learning Dashboard</Text>

      <Card title="Course Overview" />
      <Card title="Next Learning Step" />
      <Card title="Community Discussion" />
      <Card title="Progress Tracker" />
    </ScrollView>
  );
}

function Card({ title }: { title: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
  card: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 16,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: "600" },
});