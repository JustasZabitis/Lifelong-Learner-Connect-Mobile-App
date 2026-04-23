/**
 * Student dashboard — the home screen for users with the "student" role.
 * Shows a welcome message, quick stats, shortcuts, and navigation cards
 * to the main features of the app.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import DashboardCard from "../components/DashboardCard";
import AppHeader from "../components/AppHeader";
import QuickLinks from "../components/QuickLinks";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";
import { useAccessibility } from "../contexts/AccessibilityContext";

// Shape of the decoded JWT payload
interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

// ─── Feature nav cards config ────────────────────────────────────────────────
// flagKey matches the key used in FeatureFlagsContext — null means always show
// titleKey / descKey are translation keys resolved at render time
const NAV_CARDS = [
  {
    flagKey: "announcements",
    icon: "megaphone-outline" as const,
    iconColor: "#2563eb",
    bg: "#EFF6FF",
    titleKey: "tab_announcements",
    descKey: "nav_announcements_desc",
    route: "/(tabs)/announcements" as const,
  },
  {
    flagKey: "messages",
    icon: "chatbubble-outline" as const,
    iconColor: "#059669",
    bg: "#ECFDF5",
    titleKey: "tab_messages",
    descKey: "nav_messages_desc",
    route: null,
  },
  {
    flagKey: "resources",
    icon: "folder-outline" as const,
    iconColor: "#D97706",
    bg: "#FFFBEB",
    titleKey: "tab_resources",
    descKey: "nav_resources_desc",
    route: null,
  },
  {
    flagKey: "calendar",
    icon: "calendar-outline" as const,
    iconColor: "#7C3AED",
    bg: "#F5F3FF",
    titleKey: "tab_calendar",
    descKey: "nav_calendar_desc",
    route: null,
  },
  {
    flagKey: "progress",
    icon: "trending-up-outline" as const,
    iconColor: "#DC2626",
    bg: "#FEF2F2",
    titleKey: "tab_progress",
    descKey: "nav_progress_desc",
    route: null,
  },
  {
    flagKey: "competitions",
    icon: "trophy-outline" as const,
    iconColor: "#B45309",
    bg: "#FFFBEB",
    titleKey: "competitions_title",
    descKey: "nav_competitions_desc",
    route: "/(tabs)/competitions" as const,
  },
];

export default function WorkingDashboard() {
  const router = useRouter();
  const { isEnabled } = useFeatureFlags();
  const { colors, speak, t } = useAccessibility();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("Student");

  useEffect(() => {
    const loadUser = async () => {
      const token =
        Platform.OS === "web"
          ? localStorage.getItem("token")
          : await SecureStore.getItemAsync("token");

      if (!token) {
        router.replace("/");
        return;
      }

      const decoded = jwtDecode<TokenPayload>(token);
      setEmail(decoded.email);
      // Extract a friendly display name from the email prefix
      const namePart = decoded.email.split("@")[0];
      const formatted = namePart
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setFirstName(formatted);
      speak(`${getGreeting()}, ${formatted}.`);
    };

    loadUser();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greeting_morning");
    if (hour < 17) return t("greeting_afternoon");
    return t("greeting_evening");
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Header bar with logo, role badge, and logout button */}
      <AppHeader />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Welcome banner ─────────────────────────────────────── */}
        <View style={styles.welcomeBanner}>
          <View style={styles.welcomeLeft}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.studentName}>{firstName}</Text>
            <Text style={styles.welcomeSub}>{t("dashboard_overview")}</Text>
          </View>
          <View style={styles.crestAccent}>
            <Ionicons name="school" size={32} color="#A39461" />
          </View>
        </View>

        {/* ── Section label ──────────────────────────────────────── */}
        <View style={styles.sectionRule}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("dashboard_at_a_glance")}</Text>
          <View style={[styles.ruleLine, { backgroundColor: colors.border }]} />
        </View>

        {/* ── Quick stats row ────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderTopColor: "#2563eb", backgroundColor: colors.surface }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>3</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t("stat_notices")}</Text>
          </View>

          <View style={[styles.statCard, { borderTopColor: "#10b981", backgroundColor: colors.surface }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>2</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t("stat_deadlines")}</Text>
          </View>

          <View style={[styles.statCard, { borderTopColor: "#f59e0b", backgroundColor: colors.surface }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>5</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t("stat_messages")}</Text>
          </View>
        </View>

        {/* ── Quick links ────────────────────────────────────────── */}
        <View style={styles.sectionRule}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("dashboard_quick_access")}</Text>
          <View style={[styles.ruleLine, { backgroundColor: colors.border }]} />
        </View>
        <QuickLinks />

        {/* ── Navigation cards grid ──────────────────────────────── */}
        <View style={styles.sectionRule}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("dashboard_student_portal")}</Text>
          <View style={[styles.ruleLine, { backgroundColor: colors.border }]} />
        </View>

        <View style={styles.navGrid}>
          {NAV_CARDS.filter((card) => isEnabled(card.flagKey)).map((card, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.navCard, { backgroundColor: card.bg }]}
              onPress={() => card.route && router.push(card.route as any)}
              activeOpacity={0.82}
            >
              <View style={[styles.navIconBadge, { backgroundColor: "#ffffff" }]}>
                <Ionicons name={card.icon} size={20} color={card.iconColor} />
              </View>

              <Text style={[styles.navCardTitle, { color: colors.text }]}>{t(card.titleKey)}</Text>
              <Text style={[styles.navCardDesc, { color: colors.textMuted }]}>{t(card.descKey)}</Text>

              <View style={styles.navArrow}>
                <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  container: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 20,
  },

  // ── Welcome banner ──────────────────────────────────────────────────────────
  welcomeBanner: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 22,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderLeftWidth: 4,
    borderLeftColor: "#A39461",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  welcomeLeft: {
    flex: 1,
  },
  greeting: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  studentName: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  welcomeSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    lineHeight: 16,
  },
  crestAccent: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 16,
  },

  // ── Section rule ────────────────────────────────────────────────────────────
  sectionRule: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: "#9ca3af",
  },
  ruleLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },

  // ── Stats row ───────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderTopWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 14,
    fontWeight: "500",
  },

  // ── Navigation grid ─────────────────────────────────────────────────────────
  navGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  navCard: {
    width: "47%",
    borderRadius: 14,
    padding: 16,
    position: "relative",
    minHeight: 110,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  navIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  navCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  navCardDesc: {
    fontSize: 11,
    color: "#6b7280",
    lineHeight: 15,
  },
  navArrow: {
    position: "absolute",
    top: 14,
    right: 12,
  },
});
