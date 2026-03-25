/**
 * Admin dashboard — the home screen for users with the "admin" role.
 * Shows a dark control-panel header, a prominent link to the full Admin Portal,
 * and four quick-action cards for the most common admin tasks.
 * All four quick cards currently navigate to the Admin Portal screen.
 */

import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import AppHeader from "../components/AppHeader";
import QuickLinks from "../components/QuickLinks";
import { authColors } from "../constants/auth-theme";

// Pull the colours we need out of the shared theme object so we can
// reference them via short names (C.gold, C.charcoal, etc.) throughout the file
const C = {
  bg: authColors.offWhite,
  card: authColors.white,
  border: authColors.cardBorder,
  gold: authColors.gold,
  black: authColors.black,
  charcoal: authColors.charcoal,
  muted: authColors.mutedText,
};

export default function AdminDashboard() {
  // useRouter lets us push to the Admin Portal or any other screen
  const router = useRouter();

  return (
    <View style={styles.root}>
      {/* Shared header bar with logo, role badge, and logout */}
      <AppHeader />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Dark banner at the top with a gold accent bar and title text */}
        <View style={styles.heroRow}>
          {/* Thin vertical gold bar — purely decorative, matches the TUS brand */}
          <View style={styles.goldBar} />
          <View>
            <Text style={styles.welcome}>Admin Control Panel</Text>
            <Text style={styles.welcomeSub}>You have full system access.</Text>
          </View>
        </View>

        {/* Horizontal shortcut row (e.g. messages, calendar icons) */}
        <QuickLinks />

        {/* Primary call-to-action: big card that opens the full Admin Portal */}
        <TouchableOpacity
          style={styles.portalCard}
          onPress={() => router.push("/admin-portal" as any)}
          activeOpacity={0.88}
        >
          {/* Left side: icon box + title and subtitle text */}
          <View style={styles.portalCardLeft}>
            <View style={styles.portalIconBox}>
              <Text style={styles.portalIcon}>🏛</Text>
            </View>
            <View>
              <Text style={styles.portalCardTitle}>Admin Portal</Text>
              <Text style={styles.portalCardSub}>
                Users · Audit log · Stats · Inactive accounts
              </Text>
            </View>
          </View>
          {/* Right side: gold arrow chevron to signal this is tappable */}
          <Text style={styles.portalArrow}>→</Text>
        </TouchableOpacity>

        {/* First row of quick-access cards: User Management and Registration Stats */}
        <View style={styles.cardRow}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/admin-portal" as any)}
          >
            <Text style={styles.quickCardIcon}>👥</Text>
            <Text style={styles.quickCardTitle}>User Management</Text>
            <Text style={styles.quickCardSub}>Manage roles, suspend, delete</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/admin-portal" as any)}
          >
            <Text style={styles.quickCardIcon}>📊</Text>
            <Text style={styles.quickCardTitle}>Registration Stats</Text>
            <Text style={styles.quickCardSub}>By role, programme & date</Text>
          </TouchableOpacity>
        </View>

        {/* Second row of quick-access cards: Audit Log and Inactive Users */}
        <View style={styles.cardRow}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/admin-portal" as any)}
          >
            <Text style={styles.quickCardIcon}>🗒</Text>
            <Text style={styles.quickCardTitle}>Audit Log</Text>
            <Text style={styles.quickCardSub}>All admin actions recorded</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/admin-portal" as any)}
          >
            <Text style={styles.quickCardIcon}>⏳</Text>
            <Text style={styles.quickCardTitle}>Inactive Users</Text>
            <Text style={styles.quickCardSub}>Find & bulk-delete dormant accounts</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-height root container using the off-white background
  root: { flex: 1, backgroundColor: C.bg },

  // Scrollable area with consistent padding and vertical gap between children
  container: { padding: 20, gap: 16 },

  // Dark charcoal hero banner at the top with horizontal layout
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.charcoal,
    borderRadius: 16,
    padding: 20,
    marginBottom: 4,
  },

  // Thin gold vertical accent bar inside the hero banner
  goldBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    backgroundColor: C.gold,
  },

  // Large white title inside the hero banner
  welcome: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.2,
  },

  // Smaller semi-transparent subtitle below the welcome text
  welcomeSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },

  // Dark primary card that links to the full Admin Portal
  portalCard: {
    backgroundColor: C.charcoal,
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  // Left portion of the portal card: icon + text side by side
  portalCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },

  // Rounded square container for the emoji icon inside the portal card
  portalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  // The emoji icon itself inside the icon box
  portalIcon: { fontSize: 22 },

  // Bold white title text on the portal card
  portalCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },

  // Small muted subtitle listing the portal's main sections
  portalCardSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },

  // Gold arrow on the right of the portal card — signals it's tappable
  portalArrow: {
    fontSize: 20,
    color: C.gold,
    fontWeight: "800",
  },

  // Row wrapper that holds two equal-width quick-action cards side by side
  cardRow: {
    flexDirection: "row",
    gap: 12,
  },

  // Individual quick-action card: white background with a subtle border
  quickCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },

  // Large emoji icon at the top of each quick card
  quickCardIcon: { fontSize: 22 },

  // Bold title text inside a quick card
  quickCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.black,
  },

  // Muted description text below the title in each quick card
  quickCardSub: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 17,
  },
});
