/**
 * Progress tab — shows the student's learning progress, badges, and micro-credentials.
 * Displays a circular ring with overall average completion, individual course cards
 * with a colour-coded progress bar and current grade, a badge grid (earned vs locked),
 * and a list of completed certificate-type programmes as micro-credentials.
 * Data is fetched in parallel from four separate API endpoints on mount.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";
import { BASE_URL } from "../../config";
import { useAccessibility } from "../../contexts/AccessibilityContext";

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

interface ProgressRecord {
  id: number;
  programme_name: string;
  programme_code: string;
  programme_year: number;
  nqai_level: number;
  student_group: string;
  completion_percent: number;
  current_grade: string | null;
  status: string;
}

interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned_at?: string;
}

interface Summary {
  total_courses: number;
  completed_courses: number;
  active_courses: number;
  avg_completion: number;
  total_badges: number;
  micro_credentials: number;
}

const getToken = async (): Promise<string | null> =>
  Platform.OS === "web"
    ? localStorage.getItem("token")
    : SecureStore.getItemAsync("token");

// ─── Circular Progress Component ──────────────────────────────────────
// Draws an approximated circle arc using stacked Views with coloured borders.
// Each quadrant of the ring is coloured only when percent passes 25/50/75%.
const CircleProgress = ({
  percent,
  size = 90,
  strokeWidth = 8,
  color = "#2563eb",
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute" }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color }}>{Math.round(percent)}%</Text>
      </View>
      {/* Background SVG circle using View borders as fallback */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color + "20",
          position: "absolute",
        }}
      />
      {/* Progress arc approximated with border */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: "transparent",
          borderTopColor: color,
          borderRightColor: percent > 25 ? color : "transparent",
          borderBottomColor: percent > 50 ? color : "transparent",
          borderLeftColor: percent > 75 ? color : "transparent",
          transform: [{ rotate: "-45deg" }],
        }}
      />
    </View>
  );
};

// ─── Progress Bar Component ───────────────────────────────────────────
// A simple horizontal bar filled to `percent`% in the given colour.
// Used inside each course card to show completion at a glance.
const ProgressBar = ({
  percent,
  color = "#2563eb",
  height = 8,
}: {
  percent: number;
  color?: string;
  height?: number;
}) => (
  <View style={[styles.progressBarBg, { height }]}>
    <View
      style={[
        styles.progressBarFill,
        {
          width: `${Math.min(percent, 100)}%`,
          backgroundColor: color,
          height,
        },
      ]}
    />
  </View>
);

// ─── Status helpers ───────────────────────────────────────────────────
const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "#10b981";
    case "in_progress":
      return "#2563eb";
    case "not_started":
      return "#9ca3af";
    default:
      return "#6b7280";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In Progress";
    case "not_started":
      return "Not Started";
    default:
      return status;
  }
};

const getGradeColor = (grade: string | null) => {
  if (!grade) return "#9ca3af";
  const g = grade.toUpperCase();
  if (g.startsWith("A") || g === "FIRST" || g === "1ST") return "#10b981";
  if (g.startsWith("B") || g.includes("2.1")) return "#2563eb";
  if (g.startsWith("C") || g.includes("2.2")) return "#f59e0b";
  return "#6b7280";
};

// ─── Main Component ──────────────────────────────────────────────────
// Fetches progress, summary stats, all available badges, and the user's
// earned badges in parallel, then renders the overview ring + all sections.
export default function ProgressScreen() {
  const { colors, t } = useAccessibility();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [myBadges, setMyBadges] = useState<Badge[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const fetchAll = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [progressRes, summaryRes, allBadgesRes, myBadgesRes] = await Promise.all([
        fetch(`${BASE_URL}/api/progress`, { headers }),
        fetch(`${BASE_URL}/api/progress/summary`, { headers }),
        fetch(`${BASE_URL}/api/progress/badges`, { headers }),
        fetch(`${BASE_URL}/api/progress/badges/mine`, { headers }),
      ]);

      if (progressRes.ok) setProgress(await progressRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (allBadgesRes.ok) setAllBadges(await allBadgesRes.json());
      if (myBadgesRes.ok) setMyBadges(await myBadgesRes.json());
    } catch (err) {
      console.error("Failed to fetch progress data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Build a Set of badge IDs the user has earned for O(1) lookups in the badge grid
  const earnedBadgeIds = new Set(myBadges.map((b) => b.id));

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <AppHeader />
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const avgCompletion = summary ? Math.round(parseFloat(String(summary.avg_completion))) : 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <AppHeader />

      <ScrollView contentContainerStyle={styles.container}>
        {/* ── Header ── */}
        <Text style={[styles.screenTitle, { color: colors.text }]}>{t("progress_title")}</Text>

        {/* ── Overview Ring + Stats ── */}
        <View style={[styles.overviewCard, { backgroundColor: colors.surface }]}>
          <CircleProgress
            percent={avgCompletion}
            size={100}
            strokeWidth={10}
            color={colors.primary}
          />
          <View style={styles.overviewStats}>
            <View style={styles.overviewStatRow}>
              <View style={[styles.statDot, { backgroundColor: "#2563eb" }]} />
              <Text style={[styles.overviewStatText, { color: colors.text }]}>
                {summary?.active_courses || 0} {t("progress_active")}
              </Text>
            </View>
            <View style={styles.overviewStatRow}>
              <View style={[styles.statDot, { backgroundColor: "#10b981" }]} />
              <Text style={[styles.overviewStatText, { color: colors.text }]}>
                {summary?.completed_courses || 0} {t("progress_completed")}
              </Text>
            </View>
            <View style={styles.overviewStatRow}>
              <View style={[styles.statDot, { backgroundColor: "#f59e0b" }]} />
              <Text style={[styles.overviewStatText, { color: colors.text }]}>
                {summary?.total_badges || 0} {t("progress_badges")}
              </Text>
            </View>
            <View style={styles.overviewStatRow}>
              <View style={[styles.statDot, { backgroundColor: "#8b5cf6" }]} />
              <Text style={[styles.overviewStatText, { color: colors.text }]}>
                {summary?.micro_credentials || 0} {t("progress_micro_credentials")}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Course Progress ── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("progress_course_progress")}</Text>

        {progress.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="school-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t("progress_no_courses")}</Text>
            <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
              {t("progress_no_courses_hint")}
            </Text>
          </View>
        ) : (
          progress.map((course) => (
            <View key={course.id} style={[styles.courseCard, { backgroundColor: colors.surface }]}>
              <View style={styles.courseHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.courseName, { color: colors.text }]} numberOfLines={2}>
                    {course.programme_name}
                  </Text>
                  <Text style={[styles.courseMeta, { color: colors.textMuted }]}>
                    Level {course.nqai_level} · Year {course.programme_year} · {course.student_group}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(course.status) + "18" },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: getStatusColor(course.status) }]}
                  >
                    {getStatusLabel(course.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.courseProgressRow}>
                <View style={{ flex: 1 }}>
                  <ProgressBar
                    percent={course.completion_percent}
                    color={getStatusColor(course.status)}
                  />
                </View>
                <Text style={[styles.percentText, { color: getStatusColor(course.status) }]}>
                  {course.completion_percent}%
                </Text>
              </View>

              {course.current_grade && (
                <View style={[styles.gradeRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.gradeLabel, { color: colors.textMuted }]}>{t("progress_current_grade")}</Text>
                  <View
                    style={[
                      styles.gradeBadge,
                      { backgroundColor: getGradeColor(course.current_grade) + "18" },
                    ]}
                  >
                    <Text
                      style={[styles.gradeText, { color: getGradeColor(course.current_grade) }]}
                    >
                      {course.current_grade}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ))
        )}

        {/* ── Badges ── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("progress_badges_title")}</Text>

        <View style={styles.badgeGrid}>
          {allBadges.map((badge) => {
            const earned = earnedBadgeIds.has(badge.id);
            return (
              <View
                key={badge.id}
                style={[styles.badgeCard, { backgroundColor: colors.surface }, !earned && styles.badgeCardLocked]}
              >
                <View
                  style={[
                    styles.badgeIcon,
                    {
                      backgroundColor: earned ? badge.color + "20" : colors.surfaceAlt,
                    },
                  ]}
                >
                  <Ionicons
                    name={(badge.icon || "trophy") as any}
                    size={24}
                    color={earned ? badge.color : colors.textMuted}
                  />
                </View>
                <Text
                  style={[styles.badgeName, { color: colors.text }, !earned && styles.badgeNameLocked]}
                  numberOfLines={1}
                >
                  {badge.name}
                </Text>
                <Text
                  style={[styles.badgeDesc, { color: colors.textMuted }, !earned && styles.badgeDescLocked]}
                  numberOfLines={2}
                >
                  {badge.description}
                </Text>
                {earned && (
                  <View style={styles.earnedTag}>
                    <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                    <Text style={styles.earnedTagText}>{t("progress_earned")}</Text>
                  </View>
                )}
                {!earned && (
                  <View style={styles.lockedTag}>
                    <Ionicons name="lock-closed" size={12} color="#9ca3af" />
                    <Text style={styles.lockedTagText}>{t("progress_locked")}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Micro-Credentials ── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("progress_micro_credentials")}</Text>

        {progress.filter(
          (c) => c.status === "completed" && c.programme_name.toLowerCase().includes("certificate")
        ).length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="ribbon-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No micro-credentials yet</Text>
            <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
              Complete certificate programmes to earn micro-credentials
            </Text>
          </View>
        ) : (
          progress
            .filter(
              (c) => c.status === "completed" && c.programme_name.toLowerCase().includes("certificate")
            )
            .map((cert) => (
              <View key={cert.id} style={[styles.microCredCard, { backgroundColor: colors.surface }]}>
                <View style={styles.microCredIcon}>
                  <Ionicons name="ribbon" size={22} color="#8b5cf6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.microCredName, { color: colors.text }]} numberOfLines={2}>
                    {cert.programme_name}
                  </Text>
                  <Text style={[styles.microCredMeta, { color: colors.textMuted }]}>
                    Level {cert.nqai_level} · {cert.student_group}
                    {cert.current_grade ? ` · Grade: ${cert.current_grade}` : ""}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color="#10b981" />
              </View>
            ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 16, paddingBottom: 40 },

  screenTitle: { fontSize: 22, fontWeight: "700", marginBottom: 16 },

  // Overview card
  overviewCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  overviewStats: { flex: 1, marginLeft: 20, gap: 10 },
  overviewStatRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statDot: { width: 10, height: 10, borderRadius: 5 },
  overviewStatText: { fontSize: 14, fontWeight: "500", color: "#374151" },

  // Section
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    marginTop: 8,
  },

  // Course cards
  courseCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  courseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  courseName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  courseMeta: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  courseProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  percentText: { fontSize: 14, fontWeight: "700", minWidth: 40, textAlign: "right" },
  gradeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  gradeLabel: { fontSize: 12, color: "#6b7280" },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  gradeText: { fontSize: 13, fontWeight: "700" },

  // Progress bar
  progressBarBg: {
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    overflow: "hidden",
  },
  progressBarFill: {
    borderRadius: 10,
  },

  // Badges
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  badgeCard: {
    width: "47%" as any,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  badgeCardLocked: { opacity: 0.55 },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeName: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 2 },
  badgeNameLocked: { color: "#9ca3af" },
  badgeDesc: { fontSize: 11, color: "#6b7280", lineHeight: 15, marginBottom: 6 },
  badgeDescLocked: { color: "#d1d5db" },
  earnedTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  earnedTagText: { fontSize: 11, fontWeight: "600", color: "#10b981" },
  lockedTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  lockedTagText: { fontSize: 11, fontWeight: "600", color: "#9ca3af" },

  // Micro-credentials
  microCredCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  microCredIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#8b5cf620",
    justifyContent: "center",
    alignItems: "center",
  },
  microCredName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  microCredMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },

  // Empty state
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    marginBottom: 20,
  },
  emptyText: { fontSize: 15, fontWeight: "600", color: "#9ca3af", marginTop: 10 },
  emptySubText: { fontSize: 13, color: "#d1d5db", marginTop: 4, textAlign: "center" },
});