/**
 * Academic Year Management — Admin Page
 *
 * End-of-year and start-of-year lifecycle tools for student accounts:
 *   Overview   — student counts by year level, alumni total, programme breakdown
 *   Graduate   — mark completing students as alumni (with optional notification)
 *   Progress   — advance students to the next year level (Year 1 → 2 → 3 → 4)
 *   Notify     — send custom welcome / orientation / results notifications
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { BASE_URL } from "../config";
import { authColors } from "../constants/auth-theme";
import AppHeader from "../components/AppHeader";
import { useToast } from "../components/Toast";
import { useAccessibility } from "../contexts/AccessibilityContext";

// ─── Theme ─────────────────────────────────────────────────────────────────────

const C = {
  bg: authColors.offWhite,
  card: authColors.white,
  border: authColors.cardBorder,
  gold: authColors.gold,
  black: authColors.black,
  charcoal: authColors.charcoal,
  muted: authColors.mutedText,
  body: authColors.bodyText,
  inputBg: authColors.inputBg,
  inputBorder: authColors.inputBorder,

  // Semantic colours
  green: "#16A34A",
  greenLight: "#F0FDF4",
  greenBorder: "#BBF7D0",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
  blueBorder: "#BFDBFE",
  amber: "#D97706",
  amberLight: "#FFFBEB",
  amberBorder: "#FDE68A",
  purple: "#7C3AED",
  purpleLight: "#F5F3FF",
  purpleBorder: "#DDD6FE",
  red: "#DC2626",
  redLight: "#FEF2F2",
  redBorder: "#FECACA",
};

type Tab = "overview" | "graduate" | "progress" | "notify";

const TAB_DEFS: { key: Tab; labelKey: string; icon: string; color: string }[] = [
  { key: "overview",  labelKey: "acad_tab_overview",  icon: "◈",  color: C.blue   },
  { key: "graduate",  labelKey: "acad_tab_graduate",  icon: "🎓", color: C.purple },
  { key: "progress",  labelKey: "acad_tab_progress",  icon: "↑",  color: C.green  },
  { key: "notify",    labelKey: "acad_tab_notify",    icon: "✉",  color: C.amber  },
];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Student {
  id: number;
  email: string;
  programme: string | null;
  year_level: number;
  nqai_level: number | null;
  last_login: string | null;
  is_alumni: boolean;
  suspended: boolean;
}

interface OverviewData {
  byYear: { year_level: number; count: string }[];
  byNqai: { nqai_level: number; count: string }[];
  alumniCount: number;
  programmes: { programme: string; count: string }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const getToken = async (): Promise<string | null> =>
  Platform.OS === "web"
    ? localStorage.getItem("token")
    : SecureStore.getItemAsync("token");

function fmtDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── NQAI Level definitions ────────────────────────────────────────────────────
// National Framework of Qualifications Ireland levels used in TUS programmes

interface NqaiDef {
  label: string;        // Short label e.g. "Masters"
  fullLabel: string;    // Full NQAI description
  icon: string;
  maxYears: number;     // Cap for year progression
  colour: { bg: string; text: string; border: string };
}

const NQAI_LEVELS: Record<number, NqaiDef> = {
  9: {
    label: "Masters / PG",
    fullLabel: "Level 9 — Masters / Postgraduate Diploma",
    icon: "🏅",
    maxYears: 2,
    colour: { bg: C.purpleLight, text: C.purple, border: C.purpleBorder },
  },
  8: {
    label: "Honours Degree",
    fullLabel: "Level 8 — Honours Bachelor / Higher Diploma",
    icon: "🎓",
    maxYears: 4,
    colour: { bg: C.blueLight, text: C.blue, border: C.blueBorder },
  },
  7: {
    label: "Ordinary Degree",
    fullLabel: "Level 7 — Ordinary Bachelor / Apprenticeship",
    icon: "📘",
    maxYears: 3,
    colour: { bg: C.greenLight, text: C.green, border: C.greenBorder },
  },
  6: {
    label: "Higher Cert",
    fullLabel: "Level 6 — Higher Certificate / Short Certificate",
    icon: "📄",
    maxYears: 2,
    colour: { bg: C.amberLight, text: C.amber, border: C.amberBorder },
  },
};

const YEAR_ORDINALS: Record<number, string> = {
  1: "1st", 2: "2nd", 3: "3rd", 4: "4th",
};

/** Returns a human-readable year label like "L8 Year 2 / 4" */
function getYearLabel(student: Student): string {
  const lvl = student.nqai_level ?? 8;
  const def = NQAI_LEVELS[lvl];
  const maxYrs = def?.maxYears ?? 4;
  const ord = YEAR_ORDINALS[student.year_level] ?? `${student.year_level}th`;
  return `${ord} Year / ${maxYrs}`;
}

/** Badge colour based on nqai_level, fallback to blue */
function getBadgeColour(nqaiLevel: number | null) {
  return (NQAI_LEVELS[nqaiLevel ?? 8] ?? NQAI_LEVELS[8]).colour;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle, color, textColor, mutedColor }: {
  icon: string; title: string; subtitle: string; color: string; textColor?: string; mutedColor?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIconWrap, { backgroundColor: color + "18" }]}>
        <Text style={[styles.sectionIcon, { color }]}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, textColor ? { color: textColor } : {}]}>{title}</Text>
        <Text style={[styles.sectionSub, mutedColor ? { color: mutedColor } : {}]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function StatCard({ value, label, color, icon, index, bgColor, mutedColor }: {
  value: number | string; label: string; color: string; icon: string; index: number; bgColor?: string; mutedColor?: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }, bgColor ? { backgroundColor: bgColor } : {}]}>
      <Text style={[styles.statIcon]}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, mutedColor ? { color: mutedColor } : {}]}>{label}</Text>
    </View>
  );
}

function StudentRow({
  student,
  selected,
  onToggle,
  index,
  rowBg,
  emailColor,
  mutedColor,
}: {
  student: Student;
  selected: boolean;
  onToggle: () => void;
  index: number;
  rowBg?: string;
  emailColor?: string;
  mutedColor?: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const col = getBadgeColour(student.nqai_level);
  const nqaiDef = NQAI_LEVELS[student.nqai_level ?? 8] ?? NQAI_LEVELS[8];

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(220)}
      style={animStyle}
    >
      <Pressable
        onPressIn={() => { scale.value = withTiming(0.985, { duration: 80 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 100 }); }}
        onPress={onToggle}
        style={[
          styles.studentRow,
          rowBg ? { backgroundColor: rowBg } : {},
          selected && styles.studentRowSelected,
        ]}
      >
        {/* Checkbox */}
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Text style={styles.checkboxTick}>✓</Text>}
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={[styles.studentEmail, emailColor ? { color: emailColor } : {}]} numberOfLines={1}>{student.email}</Text>
          <Text style={[styles.studentProgramme, mutedColor ? { color: mutedColor } : {}]} numberOfLines={1}>
            {student.programme || "No programme assigned"}
          </Text>
        </View>

        {/* Course level + year badge */}
        <View style={styles.badgeStack}>
          <View style={[styles.nqaiBadge, { backgroundColor: col.bg, borderColor: col.border }]}>
            <Text style={[styles.nqaiBadgeText, { color: col.text }]}>
              {nqaiDef.icon} L{student.nqai_level ?? 8}
            </Text>
          </View>
          <View style={[styles.yearBadge, { backgroundColor: col.bg, borderColor: col.border }]}>
            <Text style={[styles.yearBadgeText, { color: col.text }]}>
              Y{student.year_level}/{nqaiDef.maxYears}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ActionButton({
  label, onPress, color, disabled, loading, icon,
}: {
  label: string; onPress: () => void; color: string;
  disabled?: boolean; loading?: boolean; icon?: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={() => { if (!disabled) scale.value = withSpring(0.96); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        onPress={onPress}
        disabled={disabled || loading}
        style={[
          styles.actionBtn,
          { backgroundColor: disabled ? "#E5E5EA" : color },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={[styles.actionBtnText, { color: disabled ? C.muted : "#fff" }]}>
            {icon ? `${icon}  ` : ""}{label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AcademicYear() {
  const router = useRouter();
  const { showToast, confirm } = useToast();
  const { colors, t } = useAccessibility();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Filters
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterNqai, setFilterNqai] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState<string>("");

  // Loading states
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Notification composer
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifType, setNotifType] = useState<"info" | "success" | "warning" | "error">("info");

  // Graduate / progress options
  const [sendNotifOnAction, setSendNotifOnAction] = useState(true);
  const [customMessage, setCustomMessage] = useState("");

  // ── Auth header helper ──────────────────────────────────────────────────────

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/api/academic/overview`, {
        headers, credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (err) {
      showToast("Failed to load overview", "error");
    } finally {
      setLoadingOverview(false);
    }
  }, [authHeaders]);

  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const headers = await authHeaders();
      const params = new URLSearchParams();
      if (filterYear) params.append("yearLevel", filterYear);
      if (filterNqai) params.append("nqaiLevel", filterNqai);
      if (filterSearch) params.append("search", filterSearch);

      const res = await fetch(
        `${BASE_URL}/api/academic/students?${params.toString()}`,
        { headers, credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
        setSelectedIds(new Set());
      }
    } catch (err) {
      showToast("Failed to load students", "error");
    } finally {
      setLoadingStudents(false);
    }
  }, [authHeaders, filterYear, filterNqai, filterSearch]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (activeTab !== "overview") {
      fetchStudents();
    }
  }, [activeTab, fetchStudents]);

  // ── Selection helpers ────────────────────────────────────────────────────────

  const toggleStudent = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  };

  const selectedCount = selectedIds.size;

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleGraduate = async () => {
    if (selectedCount === 0) {
      showToast("Select at least one student to graduate.", "warning");
      return;
    }
    const ok = await confirm(
      `Graduate ${selectedCount} student${selectedCount > 1 ? "s" : ""}? Their accounts will be archived as alumni and they will lose active login access.`,
      { title: "Confirm Graduation", confirmText: "Graduate", danger: true }
    );
    if (!ok) return;

    setActionLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/api/academic/graduate`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          userIds: Array.from(selectedIds),
          sendNotification: sendNotifOnAction,
          message: customMessage || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.count} student${data.count > 1 ? "s" : ""} graduated successfully.`, "success", "Graduation Complete 🎓");
        setSelectedIds(new Set());
        fetchStudents();
        fetchOverview();
      } else {
        showToast(data.error || "Failed to graduate students.", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleProgressYear = async () => {
    if (selectedCount === 0) {
      showToast("Select at least one student to progress.", "warning");
      return;
    }
    const ok = await confirm(
      `Progress ${selectedCount} student${selectedCount > 1 ? "s" : ""} to the next year level?`,
      { title: "Confirm Year Progression", confirmText: "Progress Students" }
    );
    if (!ok) return;

    setActionLoading(true);
    try {
      const headers = await authHeaders();
      const year = new Date().getFullYear();
      const res = await fetch(`${BASE_URL}/api/academic/progress-year`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          userIds: Array.from(selectedIds),
          sendNotification: sendNotifOnAction,
          academicYear: `${year}/${year + 1}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.count} student${data.count > 1 ? "s" : ""} progressed to the next year.`, "success", "Year Progression Done ↑");
        setSelectedIds(new Set());
        fetchStudents();
        fetchOverview();
      } else {
        showToast(data.error || "Failed to progress students.", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleNotify = async () => {
    if (selectedCount === 0) {
      showToast("Select at least one student to notify.", "warning");
      return;
    }
    if (!notifTitle.trim() || !notifMessage.trim()) {
      showToast("Please enter both a title and message.", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${BASE_URL}/api/academic/notify`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          userIds: Array.from(selectedIds),
          title: notifTitle.trim(),
          message: notifMessage.trim(),
          type: notifType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Notification sent to ${data.count} student${data.count > 1 ? "s" : ""}.`, "success", "Notification Sent ✉");
        setNotifTitle("");
        setNotifMessage("");
        setSelectedIds(new Set());
      } else {
        showToast(data.error || "Failed to send notifications.", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Tab content renderers ───────────────────────────────────────────────────

  const renderOverview = () => {
    if (loadingOverview) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={C.gold} size="large" />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t("acad_loading")}</Text>
        </View>
      );
    }
    if (!overview) return null;

    const totalActive = overview.byYear.reduce((s, r) => s + parseInt(r.count), 0);

    return (
      <View>
        <SectionHeader
          icon="◈"
          title={t("acad_overview")}
          subtitle={t("acad_overview_sub")}
          color={C.blue}
          textColor={colors.text}
          mutedColor={colors.textMuted}
        />

        {/* Top stats row */}
        <View style={styles.statRow}>
          <StatCard value={totalActive} label={t("acad_active_students")} color={C.blue}   icon="👥" index={0} bgColor={colors.surface} mutedColor={colors.textMuted} />
          <StatCard value={overview.alumniCount} label={t("acad_alumni")} color={C.purple} icon="🎓" index={1} bgColor={colors.surface} mutedColor={colors.textMuted} />
          <StatCard value={overview.programmes.length} label={t("acad_programmes")} color={C.green} icon="📚" index={2} bgColor={colors.surface} mutedColor={colors.textMuted} />
        </View>

        {/* By NQAI course level */}
        <View style={[styles.sectionBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.blockTitle, { color: colors.text }]}>{t("acad_by_course_level")}</Text>
          {[9, 8, 7, 6].map((lvl) => {
            const row = overview.byNqai.find((r) => r.nqai_level === lvl);
            const count = row ? parseInt(row.count) : 0;
            const pct = totalActive > 0 ? (count / totalActive) * 100 : 0;
            const def = NQAI_LEVELS[lvl];
            const col = def.colour;
            return (
              <View key={lvl} style={styles.yearRow}>
                <Text style={{ fontSize: 14, width: 22, textAlign: "center" }}>{def.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.yearLabel, { color: colors.text }]}>{def.label}</Text>
                  <Text style={[styles.yearLabelSub, { color: colors.textMuted }]}>{def.fullLabel}</Text>
                </View>
                <View style={[styles.yearBarWrap, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={[styles.yearBar, { width: `${pct}%`, backgroundColor: col.text }]} />
                </View>
                <Text style={[styles.yearCount, { color: col.text }]}>{count}</Text>
              </View>
            );
          })}
        </View>

        {/* By year level within active students */}
        {overview.byYear.length > 0 && (
          <View style={[styles.sectionBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{t("acad_by_year_level")}</Text>
            {overview.byYear.map((row) => {
              const yr = row.year_level;
              const count = parseInt(row.count);
              const pct = totalActive > 0 ? (count / totalActive) * 100 : 0;
              const col = yr <= 2
                ? { text: C.blue, bg: C.blueLight }
                : yr === 3
                ? { text: C.green, bg: C.greenLight }
                : { text: C.purple, bg: C.purpleLight };
              return (
                <View key={yr} style={styles.yearRow}>
                  <View style={[styles.yearDot, { backgroundColor: col.text }]} />
                  <Text style={[styles.yearLabel, { color: colors.text }]}>{t("acad_year")} {yr}</Text>
                  <View style={[styles.yearBarWrap, { backgroundColor: colors.surfaceAlt }]}>
                    <View style={[styles.yearBar, { width: `${pct}%`, backgroundColor: col.text }]} />
                  </View>
                  <Text style={[styles.yearCount, { color: col.text }]}>{count}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* By programme */}
        {overview.programmes.length > 0 && (
          <View style={[styles.sectionBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>{t("acad_top_programmes")}</Text>
            {overview.programmes.slice(0, 6).map((p, i) => (
              <View key={p.programme} style={[styles.progRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.progName, { color: colors.text }]} numberOfLines={1}>{p.programme}</Text>
                <View style={[styles.progBadge, { backgroundColor: C.blueLight }]}>
                  <Text style={[styles.progBadgeText, { color: C.blue }]}>{p.count}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View>
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={fetchOverview}
          >
            <Text style={[styles.refreshBtnText, { color: colors.textMuted }]}>⟳  {t("acad_refresh")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStudentList = (actionColor: string, actionLabel: string, onAction: () => void, actionIcon: string) => {
    const activeStudents = students.filter((s) => !s.is_alumni);

    return (
      <>
        {/* Search + filter bar */}
        <View style={styles.filterRow}>
          <TextInput
            style={[styles.searchInput, { flex: 1, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            placeholder={t("acad_search_placeholder")}
            placeholderTextColor={colors.textMuted}
            value={filterSearch}
            onChangeText={setFilterSearch}
          />
        </View>

        {/* NQAI level filter chips */}
        <View style={styles.chipFilterSection}>
          <Text style={[styles.chipFilterLabel, { color: colors.textMuted }]}>{t("acad_course_level")}</Text>
          <View style={styles.chipFilterRow}>
            {[
              { value: "", label: t("acad_all_levels") },
              { value: "9", label: "🏅 L9 Masters" },
              { value: "8", label: "🎓 L8 Honours" },
              { value: "7", label: "📘 L7 Ordinary" },
              { value: "6", label: "📄 L6 Higher Cert" },
            ].map(({ value, label }) => {
              const def = NQAI_LEVELS[parseInt(value)];
              const activeCol = def?.colour.text ?? C.charcoal;
              const activeBg = def?.colour.bg ?? C.charcoal;
              const active = filterNqai === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => { setFilterNqai(value); setFilterYear(""); }}
                  style={[
                    styles.yearFilterChip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    active && { backgroundColor: value ? activeBg : C.charcoal, borderColor: value ? activeCol : C.charcoal },
                  ]}
                >
                  <Text style={[
                    styles.yearFilterChipText,
                    { color: colors.text },
                    active && { color: value ? activeCol : "#fff", fontWeight: "700" },
                  ]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Year-within-level filter (only visible when a course level is selected) */}
        {filterNqai !== "" && (
          <View style={styles.chipFilterSection}>
            <Text style={[styles.chipFilterLabel, { color: colors.textMuted }]}>{t("acad_year")}</Text>
            <View style={styles.chipFilterRow}>
              {["", "1", "2", "3", "4"].slice(0, (NQAI_LEVELS[parseInt(filterNqai)]?.maxYears ?? 4) + 1).map((y, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => setFilterYear(y)}
                  style={[
                    styles.yearFilterChip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    filterYear === y && { backgroundColor: C.charcoal, borderColor: C.charcoal },
                  ]}
                >
                  <Text style={[
                    styles.yearFilterChipText,
                    { color: colors.text },
                    filterYear === y && { color: "#fff" },
                  ]}>
                    {y === "" ? t("acad_all_years") : `${t("acad_year")} ${y}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Select all / count bar */}
        <View style={styles.selectBar}>
          <Pressable onPress={toggleAll} style={styles.selectAllBtn}>
            <View style={[styles.checkbox, selectedIds.size === activeStudents.length && activeStudents.length > 0 && styles.checkboxSelected]}>
              {selectedIds.size === activeStudents.length && activeStudents.length > 0 && (
                <Text style={styles.checkboxTick}>✓</Text>
              )}
            </View>
            <Text style={[styles.selectAllText, { color: colors.text }]}>{t("acad_select_all")}</Text>
          </Pressable>
          {selectedCount > 0 && (
            <View>
              <View style={[styles.selectedBadge, { backgroundColor: actionColor + "18", borderColor: actionColor + "40" }]}>
                <Text style={[styles.selectedBadgeText, { color: actionColor }]}>
                  {selectedCount} {t("acad_selected")}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Student list */}
        {loadingStudents ? (
          <View style={styles.centered}>
            <ActivityIndicator color={C.gold} />
          </View>
        ) : activeStudents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={[styles.emptyText, { color: colors.text }]}>{t("acad_no_students")}</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>{t("acad_adjust_filters")}</Text>
          </View>
        ) : (
          <View style={styles.studentList}>
            {activeStudents.map((s, i) => (
              <StudentRow
                key={s.id}
                student={s}
                selected={selectedIds.has(s.id)}
                onToggle={() => toggleStudent(s.id)}
                index={i}
                rowBg={colors.surface}
                emailColor={colors.text}
                mutedColor={colors.textMuted}
              />
            ))}
          </View>
        )}
      </>
    );
  };

  const renderGraduate = () => (
    <View>
      <SectionHeader
        icon="🎓"
        title={t("acad_graduate_title")}
        subtitle={t("acad_graduate_sub")}
        color={C.purple}
        textColor={colors.text}
        mutedColor={colors.textMuted}
      />

      {/* Options card */}
      <View style={[styles.optionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.optionsTitle, { color: colors.text }]}>{t("acad_graduation_options")}</Text>

        <Pressable
          onPress={() => setSendNotifOnAction((v) => !v)}
          style={styles.toggleRow}
        >
          <View style={[styles.toggle, sendNotifOnAction && styles.toggleOn]}>
            <View style={[styles.toggleThumb, sendNotifOnAction && styles.toggleThumbOn]} />
          </View>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>{t("acad_send_congrats")}</Text>
        </Pressable>

        {sendNotifOnAction && (
          <View>
            <Text style={[styles.optionsFieldLabel, { color: colors.textMuted }]}>{t("acad_custom_message")}</Text>
            <TextInput
              style={[styles.searchInput, styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder={t("acad_custom_message_placeholder")}
              placeholderTextColor={colors.textMuted}
              value={customMessage}
              onChangeText={setCustomMessage}
              multiline
              numberOfLines={3}
            />
          </View>
        )}
      </View>

      {renderStudentList(C.purple, t("acad_graduate_selected"), handleGraduate, "🎓")}

      <View style={styles.actionRow}>
        <ActionButton
          label={`${t("acad_tab_graduate")} ${selectedCount > 0 ? selectedCount + " " : ""}${t("acad_students_label")}`}
          onPress={handleGraduate}
          color={C.purple}
          disabled={selectedCount === 0}
          loading={actionLoading}
          icon="🎓"
        />
      </View>
    </View>
  );

  const renderProgress = () => (
    <View>
      <SectionHeader
        icon="↑"
        title={t("acad_progress_title")}
        subtitle={t("acad_progress_sub")}
        color={C.green}
        textColor={colors.text}
        mutedColor={colors.textMuted}
      />

      {/* Info card */}
      <View style={[styles.optionsCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: C.green }]}>
        <Text style={[styles.optionsTitle, { color: colors.text }]}>{t("acad_how_it_works")}</Text>
        <Text style={[styles.optionsBody, { color: colors.textSecondary }]}>
          {t("acad_progress_body")}
        </Text>

        <Pressable
          onPress={() => setSendNotifOnAction((v) => !v)}
          style={[styles.toggleRow, { marginTop: 12 }]}
        >
          <View style={[styles.toggle, sendNotifOnAction && { backgroundColor: C.green }]}>
            <View style={[styles.toggleThumb, sendNotifOnAction && styles.toggleThumbOn]} />
          </View>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>{t("acad_send_welcome_back")} {new Date().getFullYear()}/{new Date().getFullYear() + 1}</Text>
        </Pressable>
      </View>

      {renderStudentList(C.green, t("acad_progress_year"), handleProgressYear, "↑")}

      <View style={styles.actionRow}>
        <ActionButton
          label={`${t("acad_tab_progress")} ${selectedCount > 0 ? selectedCount + " " : ""}${t("acad_students_label")}`}
          onPress={handleProgressYear}
          color={C.green}
          disabled={selectedCount === 0}
          loading={actionLoading}
          icon="↑"
        />
      </View>
    </View>
  );

  const NOTIF_TYPES: { key: "info" | "success" | "warning" | "error"; label: string; color: string }[] = [
    { key: "info",    label: "Info",    color: C.blue   },
    { key: "success", label: "Success", color: C.green  },
    { key: "warning", label: "Warning", color: C.amber  },
    { key: "error",   label: "Alert",   color: C.red    },
  ];

  const renderNotify = () => (
    <View>
      <SectionHeader
        icon="✉"
        title={t("acad_notify_title")}
        subtitle={t("acad_notify_sub")}
        color={C.amber}
        textColor={colors.text}
        mutedColor={colors.textMuted}
      />

      {/* Quick templates */}
      <View style={[styles.optionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.optionsTitle, { color: colors.text }]}>{t("acad_quick_templates")}</Text>
        <View style={styles.templateRow}>
          {[
            { label: t("acad_tpl_welcome"), title: "Welcome Back! 🎉", msg: `Welcome back to ${new Date().getFullYear()}/${new Date().getFullYear() + 1}! We're delighted to have you return. Check the dashboard for your updated timetable and announcements.`, type: "success" as const },
            { label: t("acad_tpl_orientation"), title: "Orientation Week 📅", msg: "Don't forget — Orientation Week starts soon! Check the calendar for your schedule, and reach out via Messages if you have any questions.", type: "info" as const },
            { label: t("acad_tpl_results"), title: "Results Available 📊", msg: "Your exam results are now available. Please log in and check your dashboard for details. Contact your programme coordinator if you have any queries.", type: "info" as const },
          ].map((tpl) => (
            <Pressable
              key={tpl.label}
              onPress={() => { setNotifTitle(tpl.title); setNotifMessage(tpl.msg); setNotifType(tpl.type); }}
              style={[styles.templateChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            >
              <Text style={[styles.templateChipText, { color: colors.text }]}>{tpl.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Compose area */}
      <View style={[styles.optionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.optionsTitle, { color: colors.text }]}>{t("acad_compose")}</Text>

        {/* Type selector */}
        <View style={styles.typeRow}>
          {NOTIF_TYPES.map((nt) => (
            <Pressable
              key={nt.key}
              onPress={() => setNotifType(nt.key)}
              style={[
                styles.typeChip,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                notifType === nt.key && { backgroundColor: nt.color, borderColor: nt.color },
              ]}
            >
              <Text style={[
                styles.typeChipText,
                { color: colors.text },
                notifType === nt.key && { color: "#fff" },
              ]}>
                {nt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.optionsFieldLabel, { color: colors.textMuted }]}>{t("acad_notif_title_label")}</Text>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          placeholder={t("acad_notif_title_placeholder")}
          placeholderTextColor={colors.textMuted}
          value={notifTitle}
          onChangeText={setNotifTitle}
        />

        <Text style={[styles.optionsFieldLabel, { marginTop: 10, color: colors.textMuted }]}>{t("acad_message_label")}</Text>
        <TextInput
          style={[styles.searchInput, styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          placeholder={t("acad_message_placeholder")}
          placeholderTextColor={colors.textMuted}
          value={notifMessage}
          onChangeText={setNotifMessage}
          multiline
          numberOfLines={4}
        />
      </View>

      {renderStudentList(C.amber, t("acad_send_notification"), handleNotify, "✉")}

      <View style={styles.actionRow}>
        <ActionButton
          label={`${t("acad_send_to")} ${selectedCount > 0 ? selectedCount + " " : ""}${t("acad_students_label")}`}
          onPress={handleNotify}
          color={C.amber}
          disabled={selectedCount === 0 || !notifTitle.trim() || !notifMessage.trim()}
          loading={actionLoading}
          icon="✉"
        />
      </View>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "overview":  return renderOverview();
      case "graduate":  return renderGraduate();
      case "progress":  return renderProgress();
      case "notify":    return renderNotify();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppHeader />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero banner */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.hero}>
          <View style={styles.heroLeft}>
            <View style={styles.goldBar} />
            <View>
              <Text style={styles.heroTitle}>{t("acad_hero_title")}</Text>
              <Text style={styles.heroSub}>{t("acad_hero_sub")}</Text>
            </View>
          </View>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>{t("back")}</Text>
          </Pressable>
        </Animated.View>

        {/* Tab bar */}
        <Animated.View entering={FadeInDown.delay(80).duration(280)} style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {TAB_DEFS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => { setActiveTab(tab.key); setSelectedIds(new Set()); }}
              style={[
                styles.tabItem,
                activeTab === tab.key && [styles.tabItemActive, { borderBottomColor: tab.color }],
              ]}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[
                styles.tabLabel,
                { color: colors.textMuted },
                activeTab === tab.key && { color: tab.color, fontWeight: "700" },
              ]}>
                {t(tab.labelKey)}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Tab content */}
        <View style={styles.content}>
          {renderContent()}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { padding: 16, gap: 16, paddingBottom: 48 },

  // Hero
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.charcoal,
    borderRadius: 16,
    padding: 20,
  },
  heroLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  goldBar: { width: 4, height: 44, borderRadius: 2, backgroundColor: C.gold },
  heroTitle: { fontSize: 20, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  backBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)",
  },
  backBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    gap: 3,
  },
  tabItemActive: {
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  tabIcon: { fontSize: 16 },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: C.muted,
    letterSpacing: 0.2,
  },

  // Content area
  content: { gap: 12 },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 4,
  },
  sectionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionIcon: { fontSize: 20, fontWeight: "700" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: C.black, letterSpacing: 0.1 },
  sectionSub: { fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 18 },

  // Stat cards
  statRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    gap: 4,
  },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: C.muted, textAlign: "center", fontWeight: "500" },

  // Overview blocks
  sectionBlock: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  blockTitle: {
    fontSize: 14, fontWeight: "700", color: C.black, marginBottom: 4, letterSpacing: 0.1,
  },
  yearRow: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32,
  },
  yearDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  yearLabel: { fontSize: 13, color: C.body, fontWeight: "600", flex: 1 },
  yearLabelSub: { fontSize: 11, marginTop: 1 },
  yearBarWrap: {
    flex: 1, height: 6, backgroundColor: C.inputBg, borderRadius: 3, overflow: "hidden",
  },
  yearBar: { height: 6, borderRadius: 3, minWidth: 4 },
  yearCount: { width: 28, fontSize: 13, fontWeight: "700", textAlign: "right" },
  progRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  progName: { flex: 1, fontSize: 13, color: C.body },
  progBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  progBadgeText: { fontSize: 12, fontWeight: "700" },

  // Refresh button
  refreshBtn: {
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  refreshBtnText: { fontSize: 14, fontWeight: "600", color: C.muted },

  // Options card
  optionsCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    gap: 10,
  },
  optionsTitle: {
    fontSize: 14, fontWeight: "700", color: C.black, letterSpacing: 0.1,
  },
  optionsBody: {
    fontSize: 13, color: C.body, lineHeight: 20,
  },
  optionsFieldLabel: {
    fontSize: 12, fontWeight: "600", color: C.muted, marginBottom: 4, letterSpacing: 0.2,
  },

  // Toggle
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggle: {
    width: 42, height: 24, borderRadius: 12,
    backgroundColor: C.inputBorder,
    justifyContent: "center",
    padding: 2,
  },
  toggleOn: { backgroundColor: C.purple },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#fff",
  },
  toggleThumbOn: { alignSelf: "flex-end" },
  toggleLabel: { flex: 1, fontSize: 13, color: C.body },

  // Filter row
  filterRow: {
    gap: 10,
  },
  // NQAI level + year filter chips
  chipFilterSection: { gap: 6 },
  chipFilterLabel: {
    fontSize: 11, fontWeight: "700", color: C.muted,
    textTransform: "uppercase", letterSpacing: 0.5,
    marginLeft: 2,
  },
  chipFilterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  searchInput: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    fontSize: 14,
    color: C.black,
  },
  textArea: { minHeight: 80, textAlignVertical: "top", paddingTop: 12 },
  yearFilterRow: { flexDirection: "row", gap: 8 },
  yearFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  yearFilterChipText: { fontSize: 12, fontWeight: "600", color: C.body },

  // Select bar
  selectBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  selectAllBtn: { flexDirection: "row", alignItems: "center", gap: 10 },
  selectAllText: { fontSize: 13, color: C.body, fontWeight: "500" },
  selectedBadge: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  selectedBadgeText: { fontSize: 12, fontWeight: "700" },

  // Student list
  studentList: { gap: 6 },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  studentRowSelected: {
    borderColor: C.gold,
    backgroundColor: "#FFFDF5",
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: C.inputBorder,
    alignItems: "center", justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: C.charcoal, borderColor: C.charcoal,
  },
  checkboxTick: { color: "#fff", fontSize: 12, fontWeight: "700" },
  studentEmail: { fontSize: 14, fontWeight: "600", color: C.black },
  studentProgramme: { fontSize: 12, color: C.muted, marginTop: 2 },
  // Badge stack: course level (L8) + year (Y2/4) stacked vertically
  badgeStack: { alignItems: "flex-end", gap: 4 },
  nqaiBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1,
  },
  nqaiBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
  yearBadge: {
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  yearBadgeText: { fontSize: 11, fontWeight: "700" },

  // Templates
  templateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  templateChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: C.inputBg,
    borderWidth: 1, borderColor: C.inputBorder,
  },
  templateChipText: { fontSize: 13, fontWeight: "600", color: C.body },

  // Type selector
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: C.inputBorder,
    backgroundColor: C.inputBg,
  },
  typeChipText: { fontSize: 12, fontWeight: "600", color: C.body },

  // Action row
  actionRow: { marginTop: 8 },
  actionBtn: {
    height: 52, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8,
  },
  actionBtnText: { fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },

  // Misc
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: C.muted },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 16, fontWeight: "700", color: C.black },
  emptySub: { fontSize: 14, color: C.muted },
});
