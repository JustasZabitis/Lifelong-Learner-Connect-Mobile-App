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
import { useAccessibility } from "../contexts/AccessibilityContext";

// Static gold colour used for accent elements regardless of theme
const GOLD = authColors.gold;

export default function AdminDashboard() {
  // useRouter lets us push to the Admin Portal or any other screen
  const router = useRouter();
  const { colors, t } = useAccessibility();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Shared header bar with logo, role badge, and logout */}
      <AppHeader />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Dark banner at the top with a gold accent bar and title text.
            Always uses a dark charcoal bg so white text is legible in all themes. */}
        <View style={styles.heroRow}>
          {/* Thin vertical gold bar — purely decorative, matches the TUS brand */}
          <View style={styles.goldBar} />
          <View>
            <Text style={styles.welcome}>{t("admin_control_panel")}</Text>
            <Text style={styles.welcomeSub}>{t("admin_full_access")}</Text>
          </View>
        </View>

        {/* Horizontal shortcut row (e.g. messages, calendar icons) */}
        <QuickLinks />

        {/* Primary call-to-action: big card that opens the full Admin Portal */}
        <TouchableOpacity
          style={[styles.portalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push("/admin-portal" as any)}
          activeOpacity={0.88}
        >
          {/* Left side: icon box + title and subtitle text */}
          <View style={styles.portalCardLeft}>
            <View style={[styles.portalIconBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={styles.portalIcon}>🏛</Text>
            </View>
            <View>
              <Text style={[styles.portalCardTitle, { color: colors.text }]}>{t("admin_portal")}</Text>
              <Text style={[styles.portalCardSub, { color: colors.textMuted }]}>
                {t("admin_portal_subtitle")}
              </Text>
            </View>
          </View>
          {/* Right side: gold arrow chevron to signal this is tappable */}
          <Text style={styles.portalArrow}>→</Text>
        </TouchableOpacity>

        {/* First row of quick-access cards: User Management and Registration Stats */}
        <View style={styles.cardRow}>
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/admin-portal" as any)}
          >
            <Text style={styles.quickCardIcon}>👥</Text>
            <Text style={[styles.quickCardTitle, { color: colors.text }]}>{t("admin_user_management")}</Text>
            <Text style={[styles.quickCardSub, { color: colors.textMuted }]}>{t("admin_user_management_desc")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/admin-portal" as any)}
          >
            <Text style={styles.quickCardIcon}>📊</Text>
            <Text style={[styles.quickCardTitle, { color: colors.text }]}>{t("admin_reg_stats")}</Text>
            <Text style={[styles.quickCardSub, { color: colors.textMuted }]}>{t("admin_reg_stats_desc")}</Text>
          </TouchableOpacity>
        </View>

        {/* Second row of quick-access cards: Audit Log and Inactive Users */}
        <View style={styles.cardRow}>
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/admin-portal" as any)}
          >
            <Text style={styles.quickCardIcon}>🗒</Text>
            <Text style={[styles.quickCardTitle, { color: colors.text }]}>{t("admin_audit_log")}</Text>
            <Text style={[styles.quickCardSub, { color: colors.textMuted }]}>{t("admin_audit_log_desc")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/admin-portal" as any)}
          >
            <Text style={styles.quickCardIcon}>⏳</Text>
            <Text style={[styles.quickCardTitle, { color: colors.text }]}>{t("admin_inactive_users")}</Text>
            <Text style={[styles.quickCardSub, { color: colors.textMuted }]}>{t("admin_inactive_users_desc")}</Text>
          </TouchableOpacity>
        </View>

        {/* Academic Year Management — full-width feature card */}
        <TouchableOpacity
          style={[styles.academicCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push("/academic-year" as any)}
          activeOpacity={0.88}
        >
          <View style={styles.academicCardLeft}>
            <View style={styles.academicIconBox}>
              <Text style={styles.academicIcon}>🎓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.academicCardTitle, { color: colors.text }]}>{t("admin_academic_year")}</Text>
              <Text style={[styles.academicCardSub, { color: colors.textMuted }]}>
                {t("admin_academic_year_desc")}
              </Text>
            </View>
          </View>
          <Text style={styles.academicArrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-height root container — background is set dynamically via inline style
  root: { flex: 1 },

  // Scrollable area with consistent padding and vertical gap between children
  container: { padding: 20, gap: 16 },

  // Hero banner — always dark charcoal so white text stays legible in all themes
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#1f2937",
    borderRadius: 16,
    padding: 20,
    marginBottom: 4,
  },

  // Thin gold vertical accent bar inside the hero banner
  goldBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    backgroundColor: GOLD,
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

  // Primary card that links to the full Admin Portal — bg/border set dynamically
  portalCard: {
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
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
    alignItems: "center",
    justifyContent: "center",
  },

  // The emoji icon itself inside the icon box
  portalIcon: { fontSize: 22 },

  // Bold title text on the portal card — colour set dynamically
  portalCardTitle: {
    fontSize: 16,
    fontWeight: "800",
  },

  // Small muted subtitle listing the portal's main sections — colour set dynamically
  portalCardSub: {
    fontSize: 12,
    marginTop: 2,
  },

  // Gold arrow on the right of the portal card — signals it's tappable
  portalArrow: {
    fontSize: 20,
    color: GOLD,
    fontWeight: "800",
  },

  // Row wrapper that holds two equal-width quick-action cards side by side
  cardRow: {
    flexDirection: "row",
    gap: 12,
  },

  // Individual quick-action card — bg/border set dynamically
  quickCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 6,
  },

  // Large emoji icon at the top of each quick card
  quickCardIcon: { fontSize: 22 },

  // Bold title text inside a quick card — colour set dynamically
  quickCardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },

  // Muted description text below the title in each quick card — colour set dynamically
  quickCardSub: {
    fontSize: 12,
    lineHeight: 17,
  },

  // Academic Year Management — gold-accented full-width feature card — bg/border set dynamically
  academicCard: {
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  academicCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  academicIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFFBEB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  academicIcon: { fontSize: 22 },
  academicCardTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  academicCardSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  academicArrow: {
    fontSize: 18,
    color: GOLD,
    fontWeight: "800",
  },
});
