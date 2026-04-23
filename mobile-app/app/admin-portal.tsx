/**
 * Admin Portal — the full system management interface for admin-role users.
 * Organised into five animated tabs:
 *   Users    — list, search, suspend, change role, reset password, force logout, delete
 *   Create   — register a new user account
 *   Audit    — paginated log of every admin action with actor + target email
 *   Stats    — registration totals by role, programme, and date
 *   Inactive — accounts that have never logged in or haven't logged in for 90 days
 *
 * All destructive actions (delete, bulk delete) prompt for confirmation first.
 * Every action is recorded to the admin_audit_logs table via the backend.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
  Pressable,
  Alert,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  ZoomIn,
  Layout,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { BASE_URL } from "../config";
import { authColors } from "../constants/auth-theme";
import AppHeader from "../components/AppHeader";
import { useToast } from "../components/Toast";
import { useAccessibility } from "../contexts/AccessibilityContext";

// ─── Types ────────────────────────────────────────────────────────────────────

// Shape of a user record as returned by the admin API
interface User {
  id: number;
  email: string;
  role: string;
  programme: string | null;
  created_at: string;
  last_login: string | null;
  suspended: boolean;
  failed_login_attempts: number;
  lockout_until: string | null;
  status: "active" | "suspended" | "locked" | "never_logged_in";
}

interface AuditLog {
  id: number;
  action: string;
  details: string;
  created_at: string;
  admin_email: string;
  target_email: string | null;
}

interface Stats {
  total: number;
  byRole: { role: string; count: string }[];
  dailyRegistrations: { date: string; count: string }[];
  byProgramme: { programme: string; count: string }[];
  inactiveCount: number;
}

type Tab = "users" | "create" | "audit" | "stats" | "inactive";

// ─── Theme ────────────────────────────────────────────────────────────────────
// Short aliases for the shared auth-theme colours so styles are less verbose
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
  red: "#DC2626",
  redLight: "#FEF2F2",
  green: "#16A34A",
  greenLight: "#F0FDF4",
  amber: "#D97706",
  amberLight: "#FFFBEB",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
  purple: "#7C3AED",
  purpleLight: "#F5F3FF",
};

const ROLES = ["student", "educator", "admin"];

const ROLE_COLOURS: Record<string, { bg: string; text: string }> = {
  admin:    { bg: C.charcoal, text: "#fff" },
  educator: { bg: C.gold,     text: "#fff" },
  student:  { bg: C.blue,     text: "#fff" },
};

const ACTION_ICONS: Record<string, string> = {
  CREATE_USER:    "✦",
  DELETE_USER:    "✕",
  SUSPEND_USER:   "⊘",
  UNSUSPEND_USER: "✓",
  CHANGE_ROLE:    "↑",
  RESET_PASSWORD: "⟳",
  FORCE_LOGOUT:   "⇤",
  BULK_DELETE:    "⊠",
};

const TAB_DEFS: { key: Tab; labelKey: string; icon: string }[] = [
  { key: "users",    labelKey: "admin_tab_users",    icon: "👥" },
  { key: "create",   labelKey: "admin_tab_create",   icon: "✦"  },
  { key: "stats",    labelKey: "admin_tab_stats",    icon: "📊" },
  { key: "inactive", labelKey: "admin_tab_inactive", icon: "⏳" },
  { key: "audit",    labelKey: "admin_tab_audit",    icon: "🗒" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
// fmtDate / fmtDateTime are pure formatting utilities — no alert helpers needed
// here any more; all notifications go through useToast() inside the component.

function fmtDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Animated sub-components ──────────────────────────────────────────────────

// A card that fades + slides up when it enters the list.
// entering={FadeInDown.delay(index * 60).duration(250)} handles the cascade.
function AnimatedCard({
  children,
  index = 0,
  style,
  onPress,
}: {
  children: React.ReactNode;
  index?: number;
  style?: any;
  onPress?: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 120 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 150 });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 55).duration(250)}
      layout={Layout.duration(250)}
      style={[style, animStyle]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// Animated number counter — counts up from 0 to target on mount.
function AnimatedNumber({ value, style }: { value: number; style?: any }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const steps = 30;
    const increment = value / steps;
    const interval = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplay(value);
        clearInterval(interval);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 30);
    return () => clearInterval(interval);
  }, [value]);

  return <Text style={style}>{display}</Text>;
}

// Animated progress bar — grows from 0 to pct% on mount.
function AnimatedBar({
  pct,
  color,
  delay = 0,
}: {
  pct: number;
  color: string;
  delay?: number;
}) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(delay, withTiming(pct, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [pct]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { backgroundColor: color }, barStyle]} />
    </View>
  );
}

// Tab bar item with an animated underline that slides under the active tab.
function TabItem({
  tab,
  active,
  onPress,
}: {
  tab: (typeof TAB_DEFS)[0];
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useAccessibility();
  const underlineOpacity = useSharedValue(active ? 1 : 0);
  const labelScale = useSharedValue(active ? 1 : 0.95);

  useEffect(() => {
    underlineOpacity.value = withTiming(active ? 1 : 0, { duration: 200 });
    labelScale.value = withTiming(active ? 1 : 0.95, { duration: 200 });
  }, [active]);

  const underlineStyle = useAnimatedStyle(() => ({ opacity: underlineOpacity.value }));
  const labelStyle = useAnimatedStyle(() => ({ transform: [{ scale: labelScale.value }] }));

  return (
    <Pressable style={styles.tabItem} onPress={onPress}>
      <Animated.View style={[styles.tabItemInner, labelStyle]}>
        <Text style={styles.tabIcon}>{tab.icon}</Text>
        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t(tab.labelKey)}</Text>
      </Animated.View>
      <Animated.View style={[styles.tabUnderline, underlineStyle]} />
    </Pressable>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminPortal() {
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 900;
  const { showToast, confirm } = useToast();
  const { colors, t } = useAccessibility();

  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [token, setToken] = useState<string | null>(null);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Create
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("student");
  const [newProgramme, setNewProgramme] = useState("");
  const [creating, setCreating] = useState(false);

  // Audit
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Inactive
  const [inactiveUsers, setInactiveUsers] = useState<User[]>([]);
  const [loadingInactive, setLoadingInactive] = useState(false);
  const [inactiveDays, setInactiveDays] = useState("30");

  // Modal
  const [modalAction, setModalAction] = useState<"role" | "password" | null>(null);
  const [modalValue, setModalValue] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  // Content area fade — fades out/in when switching tabs
  const contentOpacity = useSharedValue(1);
  const contentTranslateY = useSharedValue(0);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  const switchTab = (tab: Tab) => {
    // Fade out current content
    contentOpacity.value = withTiming(0, { duration: 120 }, () => {
      runOnJS(setActiveTab)(tab);
      // Slide up slightly then fade in
      contentTranslateY.value = 12;
      contentOpacity.value = withTiming(1, { duration: 200 });
      contentTranslateY.value = withTiming(0, { duration: 200 });
    });
  };

  // ── Token ──
  useEffect(() => {
    const load = async () => {
      const t = Platform.OS === "web"
        ? localStorage.getItem("token")
        : await SecureStore.getItemAsync("token");
      setToken(t);
    };
    load();
  }, []);

  const authHeader = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  // ── Fetchers ──
  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (search)       params.append("search", search);
      if (filterRole)   params.append("role", filterRole);
      if (filterStatus) params.append("status", filterStatus);
      const res = await fetch(`${BASE_URL}/api/admin/users?${params}`, { headers: authHeader() });
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoadingUsers(false); }
  }, [token, search, filterRole, filterStatus, authHeader]);

  const fetchAuditLogs = useCallback(async () => {
    if (!token) return;
    setLoadingAudit(true);
    try {
      const res = await fetch(`${BASE_URL}/api/admin/audit-logs`, { headers: authHeader() });
      if (res.ok) setAuditLogs(await res.json());
    } finally { setLoadingAudit(false); }
  }, [token, authHeader]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    setLoadingStats(true);
    try {
      const res = await fetch(`${BASE_URL}/api/admin/stats`, { headers: authHeader() });
      if (res.ok) setStats(await res.json());
    } finally { setLoadingStats(false); }
  }, [token, authHeader]);

  const fetchInactive = useCallback(async () => {
    if (!token) return;
    setLoadingInactive(true);
    try {
      const res = await fetch(`${BASE_URL}/api/admin/users/inactive?days=${inactiveDays}`, { headers: authHeader() });
      if (res.ok) setInactiveUsers(await res.json());
    } finally { setLoadingInactive(false); }
  }, [token, inactiveDays, authHeader]);

  useEffect(() => {
    if (activeTab === "users")    fetchUsers();
    if (activeTab === "audit")    fetchAuditLogs();
    if (activeTab === "stats")    fetchStats();
    if (activeTab === "inactive") fetchInactive();
  }, [activeTab, token]);

  useEffect(() => {
    if (activeTab !== "users") return;
    const t = setTimeout(() => fetchUsers(), 350);
    return () => clearTimeout(t);
  }, [search, filterRole, filterStatus]);

  // ── Actions ──
  const deleteUser = (u: User) => {
    confirm(`Permanently delete ${u.email}? This cannot be undone.`, {
      title: "Delete Account",
      confirmText: "Delete",
      danger: true,
    }).then(async (ok) => {
      if (!ok) return;
      const res = await fetch(`${BASE_URL}/api/admin/users/${u.id}`, { method: "DELETE", headers: authHeader() });
      if (res.ok) { setShowUserModal(false); fetchUsers(); showToast(`${u.email} has been removed.`, "success", "Account Deleted"); }
      else { const d = await res.json(); showToast(d.error, "error", "Delete Failed"); }
    });
  };

  const toggleSuspend = async (u: User) => {
    const res = await fetch(`${BASE_URL}/api/admin/users/${u.id}/suspend`, {
      method: "PATCH", headers: authHeader(), body: JSON.stringify({ suspended: !u.suspended }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelectedUser((p) => p ? { ...p, suspended: updated.suspended } : null);
      fetchUsers();
    }
  };

  // Clears the automatic login lockout (failed_login_attempts + lockout_until) without
  // touching the suspended flag — completely independent of toggleSuspend.
  const unlockUser = async (u: User) => {
    const res = await fetch(`${BASE_URL}/api/admin/users/${u.id}/unlock`, {
      method: "PATCH", headers: authHeader(),
    });
    if (res.ok) {
      setSelectedUser((p) => p ? { ...p, failed_login_attempts: 0, lockout_until: null, status: p.suspended ? "suspended" : "active" } : null);
      fetchUsers();
    }
  };

  const forceLogout = async (u: User) => {
    const ok = await confirm(`Force logout ${u.email}? They will need to sign in again.`, {
      title: "Force Logout",
      confirmText: "Log Out",
      danger: true,
    });
    if (!ok) return;
    await fetch(`${BASE_URL}/api/admin/users/${u.id}/force-logout`, { method: "PATCH", headers: authHeader() });
    showToast(`${u.email} has been logged out.`, "success", "Logged Out");
    fetchUsers();
  };

  const handleModalAction = async () => {
    if (!selectedUser || !modalAction) return;
    setModalLoading(true);
    const endpoint = modalAction === "role"
      ? `/api/admin/users/${selectedUser.id}/role`
      : `/api/admin/users/${selectedUser.id}/reset-password`;
    const body = modalAction === "role" ? { role: modalValue } : { newPassword: modalValue };
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "PATCH", headers: authHeader(), body: JSON.stringify(body),
    });
    setModalLoading(false);
    if (res.ok) {
      setModalAction(null); setModalValue(""); fetchUsers();
      if (modalAction === "role") setSelectedUser((p) => p ? { ...p, role: modalValue } : null);
      showToast(modalAction === "role" ? "Role updated successfully." : "Password has been reset.", "success", "Updated");
    } else {
      const d = await res.json(); showToast(d.error, "error", "Update Failed");
    }
  };

  const createUser = async () => {
    if (!newEmail || !newPassword) return showToast("Email and password are required.", "warning");
    setCreating(true);
    const res = await fetch(`${BASE_URL}/api/admin/users`, {
      method: "POST", headers: authHeader(),
      body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole, programme: newProgramme }),
    });
    setCreating(false);
    if (res.ok) {
      setNewEmail(""); setNewPassword(""); setNewRole("student"); setNewProgramme("");
      showToast(`Account created for ${newEmail}`, "success", "Account Created");
      if (activeTab === "users") fetchUsers();
    } else {
      const d = await res.json(); showToast(d.error, "error", "Create Failed");
    }
  };

  const bulkDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm(`Permanently delete ${selectedIds.size} selected user${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`, {
      title: "Bulk Delete",
      confirmText: "Delete All",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`${BASE_URL}/api/admin/users/bulk-delete`, {
      method: "DELETE", headers: authHeader(), body: JSON.stringify({ userIds: Array.from(selectedIds) }),
    });
    if (res.ok) { setSelectedIds(new Set()); fetchUsers(); showToast(`${selectedIds.size} users deleted.`, "success", "Done"); }
  };

  const toggleSelectUser = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Small reusable parts ──

  const RoleBadge = ({ role }: { role: string }) => {
    const c = ROLE_COLOURS[role] ?? { bg: C.muted, text: "#fff" };
    return (
      <View style={[styles.badge, { backgroundColor: c.bg }]}>
        <Text style={[styles.badgeText, { color: c.text }]}>{role}</Text>
      </View>
    );
  };

  const StatusDot = ({ status }: { status: User["status"] }) => {
    const colour =
      status === "active"       ? C.green :
      status === "suspended"    ? C.red   :
      status === "locked"       ? "#f97316" : // orange for lockout
      C.amber; // never_logged_in
    // Pulse the dot for suspended or locked accounts to draw attention
    const pulse = useSharedValue(1);
    useEffect(() => {
      if (status === "suspended" || status === "locked") {
        const loop = () => {
          pulse.value = withTiming(0.4, { duration: 700 }, () => {
            pulse.value = withTiming(1, { duration: 700 }, () => runOnJS(loop)());
          });
        };
        loop();
      }
    }, [status]);
    const shouldPulse = status === "suspended" || status === "locked";
    const dotStyle = useAnimatedStyle(() => ({ opacity: shouldPulse ? pulse.value : 1 }));
    return <Animated.View style={[styles.statusDot, { backgroundColor: colour }, dotStyle]} />;
  };

  // ── USERS TAB ──────────────────────────────────────────────────────────────

  const renderUsers = () => (
    <View>
      {/* Filters */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.filterSection}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          placeholder="Search email or programme…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <View style={styles.filterGroup}>
            {["", ...ROLES].map((r) => (
              <Pressable
                key={r}
                style={[styles.filterChip, { backgroundColor: filterRole === r ? C.charcoal : colors.surface, borderColor: filterRole === r ? C.charcoal : colors.border }]}
                onPress={() => setFilterRole(r)}
              >
                <Text style={[styles.filterChipText, { color: filterRole === r ? "#fff" : colors.text }]}>
                  {r || "All Roles"}
                </Text>
              </Pressable>
            ))}
            {(["", "active", "locked", "suspended"] as const).map((s) => (
              <Pressable
                key={s}
                style={[styles.filterChip, { backgroundColor: filterStatus === s ? C.charcoal : colors.surface, borderColor: filterStatus === s ? C.charcoal : colors.border }]}
                onPress={() => setFilterStatus(s)}
              >
                <Text style={[styles.filterChipText, { color: filterStatus === s ? "#fff" : colors.text }]}>
                  {s === ""          ? "Any Status" :
                   s === "active"    ? "Active" :
                   s === "locked"    ? "🔒 Locked" :
                   "Suspended"}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Animated.View>

      {/* Bulk bar — animates in when items are selected */}
      {selectedIds.size > 0 && (
        <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut.duration(150)} style={styles.bulkBar}>
          <Text style={styles.bulkBarText}>{selectedIds.size} selected</Text>
          <TouchableOpacity style={styles.bulkDeleteBtn} onPress={bulkDeleteSelected}>
            <Text style={styles.bulkDeleteText}>Delete Selected</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedIds(new Set())}>
            <Text style={[styles.bulkBarText, { color: "rgba(255,255,255,0.5)" }]}>Clear</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {loadingUsers
        ? <ActivityIndicator size="large" color={C.gold} style={{ marginTop: 48 }} />
        : (
          <View style={isWide ? styles.userGrid : undefined}>
            {users.map((u, i) => (
              <AnimatedCard
                key={u.id}
                index={i}
                style={[styles.userCard, { backgroundColor: colors.surface, borderColor: selectedIds.has(u.id) ? C.gold : colors.border }, isWide && styles.userCardWide, selectedIds.has(u.id) && { backgroundColor: "#FEFBF3" }]}
                onPress={() => { setSelectedUser(u); setShowUserModal(true); }}
              >
                {/* Checkbox */}
                <TouchableOpacity style={styles.checkboxArea} onPress={() => toggleSelectUser(u.id)}>
                  <View style={[styles.checkbox, { borderColor: colors.border }, selectedIds.has(u.id) && styles.checkboxChecked]}>
                    {selectedIds.has(u.id) && (
                      <Animated.Text entering={ZoomIn.duration(150)} style={styles.checkmark}>✓</Animated.Text>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Avatar */}
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>{u.email.charAt(0).toUpperCase()}</Text>
                </View>

                <View style={styles.userCardBody}>
                  <View style={styles.userCardRow}>
                    <Text style={[styles.userEmail, { color: colors.text }]} numberOfLines={1}>{u.email}</Text>
                    <StatusDot status={u.status} />
                  </View>
                  <View style={styles.userCardRow}>
                    <RoleBadge role={u.role} />
                    {u.programme && <Text style={[styles.programme, { color: colors.textMuted }]} numberOfLines={1}>{u.programme}</Text>}
                  </View>
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    Joined {fmtDate(u.created_at)} · Last login {fmtDate(u.last_login)}
                  </Text>
                </View>
              </AnimatedCard>
            ))}
            {users.length === 0 && !loadingUsers && (
              <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No users found</Text>
              </Animated.View>
            )}
          </View>
        )}
    </View>
  );

  // ── CREATE TAB ─────────────────────────────────────────────────────────────

  const renderCreate = () => (
    <Animated.View
      entering={FadeInDown.duration(250)}
      style={[styles.createCard, { backgroundColor: colors.surface, borderColor: colors.border }, isWide && styles.createCardWide]}
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Create New Account</Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
        Manually add a user with any role. Share credentials with them securely.
      </Text>

      {[
        { label: "Email", value: newEmail, onChange: setNewEmail, placeholder: "user@institution.ie", secure: false, keyboard: "email-address" as any },
        { label: "Password", value: newPassword, onChange: setNewPassword, placeholder: "Min 6 characters", secure: true },
      ].map((field, i) => (
        <Animated.View key={field.label} entering={FadeInDown.delay(i * 80).duration(250)}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{field.label}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            placeholder={field.placeholder}
            placeholderTextColor={colors.textMuted}
            value={field.value}
            onChangeText={field.onChange}
            autoCapitalize="none"
            secureTextEntry={field.secure}
            keyboardType={field.keyboard}
          />
        </Animated.View>
      ))}

      <Animated.View entering={FadeInDown.delay(160).duration(250)}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Role</Text>
        <View style={styles.roleSelector}>
          {ROLES.map((r) => {
            const c = ROLE_COLOURS[r] ?? { bg: C.muted, text: "#fff" };
            const active = newRole === r;
            return (
              <Pressable
                key={r}
                style={[styles.roleOption, { backgroundColor: active ? c.bg : colors.inputBg, borderColor: active ? c.bg : colors.inputBorder }, active && { borderColor: c.bg }]}
                onPress={() => setNewRole(r)}
              >
                {active && <Animated.View entering={ZoomIn.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, borderRadius: 20 }]} />}
                <Text style={[styles.roleOptionText, { color: active ? "#fff" : colors.text }, active && { zIndex: 1 }]}>{r}</Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).duration(250)}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Programme <Text style={[styles.optional, { color: colors.textMuted }]}>(optional)</Text></Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          placeholder="e.g. TUS — Business Management"
          placeholderTextColor={colors.textMuted}
          value={newProgramme}
          onChangeText={setNewProgramme}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(320).duration(250)}>
        <TouchableOpacity
          style={[styles.primaryBtn, creating && { opacity: 0.6 }]}
          onPress={createUser}
          disabled={creating}
        >
          {creating
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Create Account</Text>}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );

  // ── STATS TAB ──────────────────────────────────────────────────────────────

  const renderStats = () => (
    <View>
      {loadingStats
        ? <ActivityIndicator size="large" color={C.gold} style={{ marginTop: 48 }} />
        : stats ? (
          <View>
            {/* Metric cards */}
            <View style={[styles.statGrid, isWide && styles.statGridWide]}>
              {[
                { label: "Total Users",   value: stats.total,                          color: C.gold   },
                { label: "Active",        value: stats.total - stats.inactiveCount,    color: C.green  },
                { label: "Inactive 30d+", value: stats.inactiveCount,                  color: C.amber  },
              ].map((m, i) => (
                <Animated.View
                  key={m.label}
                  entering={FadeInDown.delay(i * 80).duration(250)}
                  style={[styles.statCard, { borderTopColor: m.color, backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <AnimatedNumber value={m.value} style={[styles.statNumber, { color: colors.text }]} />
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>{m.label}</Text>
                </Animated.View>
              ))}
            </View>

            {/* Role breakdown */}
            <Animated.View entering={FadeInDown.delay(200).duration(250)} style={[styles.statsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statsSectionTitle, { color: colors.text }]}>Users by Role</Text>
              {stats.byRole.map((r, i) => {
                const c = ROLE_COLOURS[r.role] ?? { bg: C.muted, text: "#fff" };
                const pct = Math.round((parseInt(r.count) / stats.total) * 100) || 0;
                return (
                  <View key={r.role} style={styles.barRow}>
                    <View style={[styles.barLabel, { backgroundColor: c.bg }]}>
                      <Text style={[styles.barLabelText, { color: c.text }]}>{r.role}</Text>
                    </View>
                    <AnimatedBar pct={pct} color={c.bg} delay={i * 120} />
                    <Text style={styles.barCount}>{r.count}</Text>
                  </View>
                );
              })}
            </Animated.View>

            {/* Top programmes */}
            <Animated.View entering={FadeInDown.delay(320).duration(250)} style={[styles.statsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statsSectionTitle, { color: colors.text }]}>Top Programmes</Text>
              {stats.byProgramme.slice(0, 8).map((p, i) => (
                <Animated.View
                  key={i}
                  entering={FadeInDown.delay(i * 50).duration(250)}
                  style={[styles.progRow, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.progName, { color: colors.text }]} numberOfLines={1}>{p.programme}</Text>
                  <View style={[styles.progCountBubble, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.progCountText, { color: colors.text }]}>{p.count}</Text>
                  </View>
                </Animated.View>
              ))}
            </Animated.View>

            {/* Spark chart */}
            <Animated.View entering={FadeInDown.delay(440).duration(250)} style={[styles.statsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statsSectionTitle, { color: colors.text }]}>Registrations — last 30 days</Text>
              <View style={styles.sparkWrap}>
                {stats.dailyRegistrations.length === 0
                  ? <Text style={styles.emptyStateText}>No data</Text>
                  : stats.dailyRegistrations.map((d, i) => {
                    const maxCount = Math.max(...stats.dailyRegistrations.map((x) => parseInt(x.count)));
                    const targetH = Math.max(4, (parseInt(d.count) / maxCount) * 60);
                    return (
                      <SparkBar key={i} targetH={targetH} count={d.count} date={new Date(d.date).getDate()} delay={i * 25} />
                    );
                  })}
              </View>
            </Animated.View>
          </View>
        ) : (
          <Animated.View entering={FadeIn} style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No stats available</Text>
          </Animated.View>
        )}
    </View>
  );

  // ── INACTIVE TAB ───────────────────────────────────────────────────────────

  const renderInactive = () => (
    <View>
      <Animated.View entering={FadeInDown.duration(250)} style={styles.inactiveHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Inactive Accounts</Text>
        <View style={styles.daysSelector}>
          {["7", "14", "30", "60", "90"].map((d) => (
            <Pressable
              key={d}
              style={[styles.filterChip, { backgroundColor: inactiveDays === d ? C.charcoal : colors.surface, borderColor: inactiveDays === d ? C.charcoal : colors.border }]}
              onPress={() => setInactiveDays(d)}
            >
              <Text style={[styles.filterChipText, { color: inactiveDays === d ? "#fff" : colors.text }]}>{d}d</Text>
            </Pressable>
          ))}
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchInactive}>
            <Text style={styles.refreshBtnText}>⟳ Refresh</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {loadingInactive
        ? <ActivityIndicator size="large" color={C.gold} style={{ marginTop: 48 }} />
        : (
          <View>
            {inactiveUsers.length > 0 && (
              <Animated.View entering={FadeInDown.duration(250)}>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: C.red, marginBottom: 14 }]}
                  onPress={async () => {
                    const ids = inactiveUsers.map((u) => u.id);
                    const ok = await confirm(`Permanently delete all ${ids.length} inactive users? This cannot be undone.`, {
                      title: "Delete Inactive",
                      confirmText: "Delete All",
                      danger: true,
                    });
                    if (!ok) return;
                    const res = await fetch(`${BASE_URL}/api/admin/users/bulk-delete`, {
                      method: "DELETE", headers: authHeader(), body: JSON.stringify({ userIds: ids }),
                    });
                    if (res.ok) { fetchInactive(); showToast(`${ids.length} inactive users deleted.`, "success", "Done"); }
                  }}
                >
                  <Text style={styles.primaryBtnText}>Delete All {inactiveUsers.length} Inactive Users</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
            {inactiveUsers.map((u, i) => (
              <Animated.View
                key={u.id}
                entering={FadeInDown.delay(i * 50).duration(250)}
                layout={Layout.duration(250)}
                style={[styles.inactiveRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={[styles.avatarCircleSmall, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={[styles.avatarLetterSmall, { color: colors.text }]}>{u.email.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.userEmail, { color: colors.text }]} numberOfLines={1}>{u.email}</Text>
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>Last login: {fmtDate(u.last_login)} · Joined: {fmtDate(u.created_at)}</Text>
                </View>
                <RoleBadge role={u.role} />
              </Animated.View>
            ))}
            {inactiveUsers.length === 0 && (
              <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No inactive users in the last {inactiveDays} days</Text>
              </Animated.View>
            )}
          </View>
        )}
    </View>
  );

  // ── AUDIT TAB ──────────────────────────────────────────────────────────────

  const renderAudit = () => (
    <View>
      <Animated.View entering={FadeInDown.duration(250)} style={styles.auditHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Audit Log</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchAuditLogs}>
          <Text style={styles.refreshBtnText}>⟳ Refresh</Text>
        </TouchableOpacity>
      </Animated.View>

      {loadingAudit
        ? <ActivityIndicator size="large" color={C.gold} style={{ marginTop: 48 }} />
        : auditLogs.map((log, i) => (
          <Animated.View
            key={log.id}
            entering={FadeInDown.delay(i * 40).duration(250)}
            style={[styles.auditRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.auditIcon}>
              <Text style={styles.auditIconText}>{ACTION_ICONS[log.action] ?? "·"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.auditAction, { color: colors.text }]}>{log.action.replace(/_/g, " ")}</Text>
              <Text style={[styles.auditDetails, { color: colors.textMuted }]} numberOfLines={2}>{log.details}</Text>
              <Text style={[styles.auditMeta, { color: colors.textMuted }]}>by {log.admin_email} · {fmtDateTime(log.created_at)}</Text>
            </View>
          </Animated.View>
        ))}
      {auditLogs.length === 0 && !loadingAudit && (
        <Animated.View entering={FadeIn} style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No audit entries yet</Text>
        </Animated.View>
      )}
    </View>
  );

  // ── USER MODAL ─────────────────────────────────────────────────────────────

  const renderUserModal = () => {
    if (!selectedUser) return null;
    const u = selectedUser;

    return (
      <Modal visible={showUserModal} transparent animationType="fade" onRequestClose={() => setShowUserModal(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeInUp.duration(250)}
            exiting={FadeOut.duration(150)}
            style={[styles.modalCard, { backgroundColor: colors.surface }, isWide && styles.modalCardWide]}
          >
            <ScrollView>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalAvatarLarge}>
                  <Text style={styles.modalAvatarText}>{u.email.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalEmail, { color: colors.text }]}>{u.email}</Text>
                  <View style={styles.modalBadgeRow}>
                    <RoleBadge role={u.role} />
                    <View style={[styles.badge, {
                      backgroundColor:
                        u.suspended                                                       ? C.redLight   :
                        u.lockout_until && new Date(u.lockout_until) > new Date()         ? "#fff3e0"    :
                        C.greenLight
                    }]}>
                      <Text style={[styles.badgeText, {
                        color:
                          u.suspended                                                     ? C.red        :
                          u.lockout_until && new Date(u.lockout_until) > new Date()       ? "#f97316"    :
                          C.green
                      }]}>
                        {u.suspended
                          ? "Suspended"
                          : u.lockout_until && new Date(u.lockout_until) > new Date()
                            ? "🔒 Locked"
                            : "Active"}
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowUserModal(false)} style={[styles.modalClose, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.modalCloseText, { color: colors.textMuted }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Profile */}
              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: colors.textMuted }]}>Profile</Text>
                {[
                  { key: "Programme",      val: u.programme || "Not set" },
                  { key: "Joined",         val: fmtDate(u.created_at) },
                  { key: "Last Login",     val: fmtDate(u.last_login) },
                  { key: "User ID",        val: `#${u.id}` },
                  { key: "Failed Logins",  val: `${u.failed_login_attempts || 0} attempt${(u.failed_login_attempts || 0) === 1 ? "" : "s"}` },
                  ...(u.lockout_until && new Date(u.lockout_until) > new Date()
                    ? [{ key: "Locked Until", val: fmtDate(u.lockout_until) }]
                    : []),
                ].map((row, i) => (
                  <Animated.View
                    key={row.key}
                    entering={FadeInDown.delay(i * 60).duration(250)}
                    style={[styles.detailRow, { borderBottomColor: colors.border }]}
                  >
                    <Text style={[styles.detailKey, { color: colors.textMuted }]}>{row.key}</Text>
                    <Text style={[styles.detailVal, { color: colors.text }]}>{row.val}</Text>
                  </Animated.View>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: colors.textMuted }]}>Actions</Text>
                <View style={styles.actionGrid}>
                  {[
                    // Suspend / Unsuspend — only touches the admin-imposed suspension flag
                    {
                      label: u.suspended ? "Unsuspend" : "Suspend",
                      icon:  u.suspended ? "✓" : "⊘",
                      bg:    u.suspended ? C.greenLight : C.amberLight,
                      color: u.suspended ? C.green      : C.amber,
                      onPress: () => toggleSuspend(u),
                    },
                    { label: "Change Role",    icon: "↑", bg: C.blueLight,   color: C.blue,   onPress: () => { setModalAction("role"); setModalValue(u.role); } },
                    { label: "Reset Password", icon: "⟳", bg: C.purpleLight, color: C.purple, onPress: () => { setModalAction("password"); setModalValue(""); } },
                    { label: "Force Logout",   icon: "⇤", bg: C.amberLight,  color: C.amber,  onPress: () => forceLogout(u) },
                  ].map((btn, i) => (
                    <Animated.View key={btn.label} entering={FadeInDown.delay(i * 60).duration(250)} style={{ flex: 1, minWidth: "45%" as any }}>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: btn.bg }]} onPress={btn.onPress}>
                        <Text style={styles.actionBtnIcon}>{btn.icon}</Text>
                        <Text style={[styles.actionBtnText, { color: btn.color }]}>{btn.label}</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}

                  {/* Unlock — only shown when the account is locked by automatic lockout.
                      Completely separate from suspend/unsuspend; clears failed_login_attempts
                      and lockout_until without touching the suspended flag. */}
                  {u.lockout_until && new Date(u.lockout_until) > new Date() && (
                    <Animated.View entering={FadeInDown.delay(240).duration(250)} style={{ flex: 1, minWidth: "45%" as any }}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#fff3e0" }]}
                        onPress={() => unlockUser(u)}
                      >
                        <Text style={styles.actionBtnIcon}>🔓</Text>
                        <Text style={[styles.actionBtnText, { color: "#f97316" }]}>Unlock Account</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                </View>
                <TouchableOpacity style={styles.dangerBtn} onPress={() => deleteUser(u)}>
                  <Text style={styles.dangerBtnText}>✕  Delete Account Permanently</Text>
                </TouchableOpacity>
              </View>

              {/* Inline role/password sub-form */}
              {modalAction && (
                <Animated.View entering={FadeInDown.duration(250)} style={[styles.inlineModal, { backgroundColor: colors.surfaceAlt, borderColor: colors.inputBorder }]}>
                  <Text style={[styles.inlineModalTitle, { color: colors.text }]}>
                    {modalAction === "role" ? "Change Role" : "Set New Password"}
                  </Text>

                  {modalAction === "role" ? (
                    <View style={styles.roleSelector}>
                      {ROLES.map((r) => {
                        const c = ROLE_COLOURS[r] ?? { bg: C.muted, text: "#fff" };
                        const active = modalValue === r;
                        return (
                          <Pressable
                            key={r}
                            style={[styles.roleOption, { backgroundColor: active ? c.bg : colors.inputBg, borderColor: active ? c.bg : colors.inputBorder }]}
                            onPress={() => setModalValue(r)}
                          >
                            <Text style={[styles.roleOptionText, { color: active ? "#fff" : colors.text }]}>{r}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                      placeholder="New password (min 6 chars)"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry
                      value={modalValue}
                      onChangeText={setModalValue}
                    />
                  )}

                  <TouchableOpacity
                    style={[styles.primaryBtn, modalLoading && { opacity: 0.6 }]}
                    onPress={handleModalAction}
                    disabled={modalLoading}
                  >
                    {modalLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.primaryBtnText}>
                          {modalAction === "role" ? "Apply Role Change" : "Reset Password"}
                        </Text>}
                  </TouchableOpacity>
                  <Pressable onPress={() => setModalAction(null)} style={styles.cancelLink}>
                    <Text style={styles.cancelLinkText}>Cancel</Text>
                  </Pressable>
                </Animated.View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  // ── ROOT ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppHeader />

      {/* Portal header — always dark charcoal so white text is legible in all themes */}
      <Animated.View entering={FadeInDown.duration(400).duration(250)} style={styles.portalHeader}>
        <View style={styles.portalHeaderInner}>
          <View style={styles.goldAccent} />
          <View>
            <Text style={styles.portalTitle}>Admin Portal</Text>
            <Text style={styles.portalSubtitle}>System administration · Lifelong Learner Connect</Text>
          </View>
        </View>
      </Animated.View>

      {/* Tab bar */}
      <Animated.View entering={FadeIn.delay(150).duration(300)} style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarInner}>
          {TAB_DEFS.map((t) => (
            <TabItem key={t.key} tab={t} active={activeTab === t.key} onPress={() => switchTab(t.key)} />
          ))}
        </ScrollView>
      </Animated.View>

      {/* Content — fades + slides on tab switch */}
      <ScrollView style={styles.content}>
        <Animated.View style={[styles.contentInner, isWide && styles.contentInnerWide, contentStyle]}>
          {activeTab === "users"    && renderUsers()}
          {activeTab === "create"   && renderCreate()}
          {activeTab === "stats"    && renderStats()}
          {activeTab === "inactive" && renderInactive()}
          {activeTab === "audit"    && renderAudit()}
          <View style={{ height: 48 }} />
        </Animated.View>
      </ScrollView>

      {renderUserModal()}
    </View>
  );
}

// ── Spark bar — its own component so height animates independently ──────────

function SparkBar({ targetH, count, date, delay }: { targetH: number; count: string; date: number; delay: number }) {
  const height = useSharedValue(0);

  useEffect(() => {
    height.value = withDelay(delay, withTiming(targetH, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, [targetH]);

  const barStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <View style={styles.sparkBarWrap}>
      <Text style={styles.sparkCount}>{count}</Text>
      <Animated.View style={[styles.sparkBar, barStyle]} />
      <Text style={styles.sparkDate}>{date}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  portalHeader: {
    backgroundColor: C.charcoal,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  portalHeaderInner: { maxWidth: 1100, alignSelf: "center", width: "100%", flexDirection: "row", alignItems: "center", gap: 14 },
  goldAccent: { width: 4, height: 36, borderRadius: 2, backgroundColor: C.gold },
  portalTitle: { fontSize: 20, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  portalSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 },

  tabBar: { borderBottomWidth: 1 },
  tabBarInner: { paddingHorizontal: 12 },
  tabItem: { paddingHorizontal: 16, paddingVertical: 14, position: "relative" },
  tabItemInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  tabIcon: { fontSize: 15 },
  tabLabel: { fontSize: 14, fontWeight: "500", color: C.muted },
  tabLabelActive: { color: C.gold, fontWeight: "700" },
  tabUnderline: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, backgroundColor: C.gold, borderRadius: 1 },

  content: { flex: 1 },
  contentInner: { padding: 16, maxWidth: 1100, alignSelf: "center", width: "100%" },
  contentInnerWide: { padding: 24 },

  filterSection: { marginBottom: 16 },
  filterGroup: { flexDirection: "row", gap: 6 },
  searchInput: {
    backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.inputBorder,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14, color: C.black,
  },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.inputBorder, backgroundColor: C.card },
  filterChipActive: { backgroundColor: C.charcoal, borderColor: C.charcoal },
  filterChipText: { fontSize: 12, fontWeight: "500", color: C.body },
  filterChipTextActive: { color: "#fff" },

  bulkBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.charcoal, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginBottom: 12,
  },
  bulkBarText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  bulkDeleteBtn: { backgroundColor: C.red, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, marginLeft: "auto" as any },
  bulkDeleteText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  userGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  userCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border,
    flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10,
    shadowColor: "rgba(0,0,0,0.05)", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  userCardWide: { width: "48%" as any, marginBottom: 0 },
  userCardSelected: { borderColor: C.gold, backgroundColor: "#FEFBF3" },
  checkboxArea: { paddingTop: 2 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: C.inputBorder, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: C.gold, borderColor: C.gold },
  checkmark: { color: "#fff", fontSize: 11, fontWeight: "800" },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.charcoal, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarLetter: { color: "#fff", fontSize: 16, fontWeight: "800" },
  userCardBody: { flex: 1, gap: 5 },
  userCardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userEmail: { fontSize: 14, fontWeight: "600", color: C.black, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  programme: { fontSize: 11, color: C.muted, flex: 1 },
  metaText: { fontSize: 11, color: C.muted },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },

  createCard: { backgroundColor: C.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: C.border, gap: 6 },
  createCardWide: { maxWidth: 540 },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: C.black, marginBottom: 2 },
  sectionSubtitle: { fontSize: 14, color: C.muted, marginBottom: 12, lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: C.body, marginBottom: 4, marginTop: 8 },
  optional: { fontWeight: "400", color: C.muted },
  input: {
    backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.inputBorder,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: C.black,
  },
  roleSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 4 },
  roleOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.inputBorder, backgroundColor: C.inputBg, overflow: "hidden" },
  roleOptionText: { fontSize: 13, fontWeight: "600", color: C.body },
  primaryBtn: {
    backgroundColor: C.charcoal, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 14,
    shadowColor: "rgba(0,0,0,0.2)", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.2 },

  statGrid: { gap: 12, marginBottom: 20 },
  statGridWide: { flexDirection: "row" },
  statCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.border,
    borderTopWidth: 3, flex: 1, alignItems: "center",
    shadowColor: "rgba(0,0,0,0.04)", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  statNumber: { fontSize: 36, fontWeight: "800", color: C.black },
  statLabel: { fontSize: 13, color: C.muted, marginTop: 4, fontWeight: "500" },
  statsSection: { backgroundColor: C.card, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  statsSectionTitle: { fontSize: 15, fontWeight: "700", color: C.black, marginBottom: 14 },

  barRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  barLabel: { width: 90, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, alignItems: "center" },
  barLabelText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  barTrack: { flex: 1, height: 8, backgroundColor: C.inputBg, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%" as any, borderRadius: 4 },
  barCount: { fontSize: 13, fontWeight: "700", color: C.body, width: 30, textAlign: "right" },

  progRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  progName: { flex: 1, fontSize: 13, color: C.body },
  progCountBubble: { backgroundColor: C.inputBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  progCountText: { fontSize: 12, fontWeight: "700", color: C.body },

  sparkWrap: { flexDirection: "row", alignItems: "flex-end", gap: 4, flexWrap: "wrap" },
  sparkBarWrap: { alignItems: "center", gap: 2 },
  sparkBar: { width: 14, borderRadius: 3, backgroundColor: C.gold },
  sparkCount: { fontSize: 9, color: C.muted },
  sparkDate: { fontSize: 9, color: C.muted },

  inactiveHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 },
  daysSelector: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.gold },
  refreshBtnText: { fontSize: 12, fontWeight: "600", color: C.gold },
  inactiveRow: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border,
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8,
  },
  avatarCircleSmall: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.inputBg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, flexShrink: 0 },
  avatarLetterSmall: { fontSize: 14, fontWeight: "700", color: C.body },

  auditHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  auditRow: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border,
    flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8,
  },
  auditIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.charcoal, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  auditIconText: { color: C.gold, fontSize: 14, fontWeight: "900" },
  auditAction: { fontSize: 13, fontWeight: "700", color: C.black, textTransform: "uppercase", letterSpacing: 0.3 },
  auditDetails: { fontSize: 13, color: C.body, marginTop: 2, lineHeight: 18 },
  auditMeta: { fontSize: 11, color: C.muted, marginTop: 4 },

  emptyState: { paddingVertical: 40, alignItems: "center" },
  emptyStateText: { fontSize: 15, color: C.muted, fontWeight: "500" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: {
    backgroundColor: C.card, borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "90%", padding: 24,
    shadowColor: "rgba(0,0,0,0.3)", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 1, shadowRadius: 40, elevation: 20,
  },
  modalCardWide: { maxWidth: 540 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 20 },
  modalAvatarLarge: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.charcoal, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  modalAvatarText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  modalEmail: { fontSize: 15, fontWeight: "700", color: C.black, marginBottom: 6 },
  modalBadgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  modalClose: { marginLeft: "auto" as any, width: 32, height: 32, borderRadius: 16, backgroundColor: C.inputBg, alignItems: "center", justifyContent: "center" },
  modalCloseText: { fontSize: 13, color: C.muted, fontWeight: "700" },
  modalSection: { marginBottom: 20 },
  modalSectionTitle: { fontSize: 12, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  detailKey: { fontSize: 13, color: C.muted, fontWeight: "500" },
  detailVal: { fontSize: 13, color: C.body, fontWeight: "600" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  actionBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, alignItems: "center", gap: 4 },
  actionBtnIcon: { fontSize: 16, fontWeight: "900", color: C.body },
  actionBtnText: { fontSize: 12, fontWeight: "700" },
  dangerBtn: { backgroundColor: C.redLight, borderRadius: 12, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: "#FECACA" },
  dangerBtnText: { color: C.red, fontSize: 14, fontWeight: "700" },
  inlineModal: { backgroundColor: C.inputBg, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.inputBorder, gap: 8 },
  inlineModalTitle: { fontSize: 14, fontWeight: "700", color: C.black, marginBottom: 4 },
  cancelLink: { alignItems: "center", paddingVertical: 4 },
  cancelLinkText: { fontSize: 13, color: C.muted, fontWeight: "600" },
});
