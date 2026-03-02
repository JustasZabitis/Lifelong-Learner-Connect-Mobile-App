import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";

// ─── Types ────────────────────────────────────────────────────────────────
interface Event {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  type: "event" | "deadline" | "class";
  role_target: string;
  created_by: number;
  created_by_email: string;
}

interface Reminder {
  id: number;
  title: string;
  reminder_date: string;
  reminder_time: string | null;
}

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

// ─── Config ───────────────────────────────────────────────────────────────
const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:5000"
    : "http://192.168.0.246:5000";

const getToken = async (): Promise<string | null> =>
  Platform.OS === "web"
    ? localStorage.getItem("token")
    : SecureStore.getItemAsync("token");

// ─── Helpers ──────────────────────────────────────────────────────────────
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatTime = (timeStr: string | null): string => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return ` · ${displayHour}:${m} ${ampm}`;
};

const typeColor = (type: string): string => {
  switch (type) {
    case "deadline": return "#ef4444";
    case "class":    return "#8b5cf6";
    default:         return "#2563eb";
  }
};

const typeIcon = (type: string): string => {
  switch (type) {
    case "deadline": return "⚠️";
    case "class":    return "🎓";
    default:         return "📅";
  }
};

// ─── Component ────────────────────────────────────────────────────────────
export default function CalendarScreen() {
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear]   = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey(today));

  const [events, setEvents]     = useState<Event[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading]   = useState(true);

  const [role, setRole]         = useState("");
  const [userId, setUserId]     = useState<number | null>(null);

  // Create Event modal
  const [eventModal, setEventModal]   = useState(false);
  const [newTitle, setNewTitle]       = useState("");
  const [newDesc, setNewDesc]         = useState("");
  const [newDate, setNewDate]         = useState("");
  const [newTime, setNewTime]         = useState("");
  const [newType, setNewType]         = useState<"event" | "deadline" | "class">("event");
  const [newTarget, setNewTarget]     = useState("all");

  // Create Reminder modal
  const [reminderModal, setReminderModal] = useState(false);
  const [remTitle, setRemTitle]           = useState("");
  const [remDate, setRemDate]             = useState("");
  const [remTime, setRemTime]             = useState("");

  // ── Load user from token ──
  useEffect(() => {
    const init = async () => {
      const token = await getToken();
      if (!token) return;
      const decoded = jwtDecode<TokenPayload>(token);
      setRole(decoded.role);
      setUserId(decoded.id);
    };
    init();
  }, []);

  // ── Fetch events & reminders ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [eventsRes, remindersRes] = await Promise.all([
        fetch(`${BASE_URL}/api/calendar/events`, { headers }),
        fetch(`${BASE_URL}/api/calendar/reminders`, { headers }),
      ]);

      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (remindersRes.ok) setReminders(await remindersRes.json());
    } catch (err) {
      console.error("Failed to fetch calendar data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Build calendar grid for current month ──
  const buildCalendarDays = (): (string | null)[] => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days: (string | null)[] = [];

    for (let i = 0; i < firstDay; i++) days.push(null); // empty slots
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(
        `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      );
    }
    return days;
  };

  // ── Dates that have events or reminders (for dot indicators) ──
  const datesWithContent = new Set([
    ...events.map((e) => e.event_date.split("T")[0]),
    ...reminders.map((r) => r.reminder_date.split("T")[0]),
  ]);

  // ── Events + reminders for the selected day ──
  const selectedEvents = events.filter(
    (e) => e.event_date.split("T")[0] === selectedDate
  );
  const selectedReminders = reminders.filter(
    (r) => r.reminder_date.split("T")[0] === selectedDate
  );

  // ── Navigate months ──
  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  // ── Create event ──
  const handleCreateEvent = async () => {
    if (!newTitle.trim() || !newDate.trim()) {
      return Alert.alert("Title and date are required");
    }
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/calendar/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || null,
          event_date: newDate,
          event_time: newTime || null,
          type: newType,
          role_target: newTarget,
        }),
      });
      if (res.ok) {
        setEventModal(false);
        setNewTitle(""); setNewDesc(""); setNewDate("");
        setNewTime(""); setNewType("event"); setNewTarget("all");
        fetchData();
      } else {
        const err = await res.json();
        Alert.alert("Error", err.error);
      }
    } catch {
      Alert.alert("Error", "Could not create event");
    }
  };

  // ── Delete event ──
  const handleDeleteEvent = async (id: number) => {
    Alert.alert("Delete Event", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const token = await getToken();
          const res = await fetch(`${BASE_URL}/api/calendar/events/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) fetchData();
        },
      },
    ]);
  };

  // ── Create reminder ──
  const handleCreateReminder = async () => {
    if (!remTitle.trim() || !remDate.trim()) {
      return Alert.alert("Title and date are required");
    }
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/calendar/reminders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: remTitle,
          reminder_date: remDate,
          reminder_time: remTime || null,
        }),
      });
      if (res.ok) {
        setReminderModal(false);
        setRemTitle(""); setRemDate(""); setRemTime("");
        fetchData();
      }
    } catch {
      Alert.alert("Error", "Could not create reminder");
    }
  };

  // ── Delete reminder ──
  const handleDeleteReminder = async (id: number) => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api/calendar/reminders/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchData();
  };

  const calendarDays = buildCalendarDays();
  const isEducator = role === "educator";
  const isAdmin = role === "admin";
  const isLearner = !isEducator && !isAdmin;

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader />

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Month navigator ── */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={22} color="#2563eb" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {MONTHS[currentMonth]} {currentYear}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={22} color="#2563eb" />
          </TouchableOpacity>
        </View>

        {/* ── Day labels ── */}
        <View style={styles.dayLabels}>
          {DAYS.map((d) => (
            <Text key={d} style={styles.dayLabel}>{d}</Text>
          ))}
        </View>

        {/* ── Calendar grid ── */}
        <View style={styles.grid}>
          {calendarDays.map((dateKey, i) => {
            if (!dateKey) return <View key={`empty-${i}`} style={styles.dayCell} />;

            const dayNum = parseInt(dateKey.split("-")[2]);
            const isToday = dateKey === toDateKey(today);
            const isSelected = dateKey === selectedDate;
            const hasDot = datesWithContent.has(dateKey);

            return (
              <TouchableOpacity
                key={dateKey}
                style={[
                  styles.dayCell,
                  isSelected && styles.selectedCell,
                  isToday && !isSelected && styles.todayCell,
                ]}
                onPress={() => setSelectedDate(dateKey)}
              >
                <Text style={[
                  styles.dayNumber,
                  isSelected && styles.selectedDayNumber,
                  isToday && !isSelected && styles.todayDayNumber,
                ]}>
                  {dayNum}
                </Text>
                {hasDot && (
                  <View style={[styles.dot, isSelected && styles.dotSelected]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Selected date header ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedDate === toDateKey(today) ? "Today" : selectedDate}
          </Text>
          <View style={styles.sectionActions}>
            {/* Educators can add events */}
            {isEducator && (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => {
                  setNewDate(selectedDate);
                  setEventModal(true);
                }}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Event</Text>
              </TouchableOpacity>
            )}
            {/* Learners can add personal reminders */}
            {isLearner && (
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: "#7c3aed" }]}
                onPress={() => {
                  setRemDate(selectedDate);
                  setReminderModal(true);
                }}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Reminder</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Loading ── */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color="#2563eb" />
        ) : (
          <>
            {/* ── Course Events ── */}
            {selectedEvents.length === 0 && selectedReminders.length === 0 ? (
              <View style={styles.emptyDay}>
                <Text style={styles.emptyDayText}>Nothing scheduled</Text>
              </View>
            ) : (
              <>
                {selectedEvents.map((event) => {
                  const canDelete =
                    isAdmin || (isEducator && event.created_by === userId);

                  return (
                    <View
                      key={event.id}
                      style={[styles.eventCard, { borderLeftColor: typeColor(event.type) }]}
                    >
                      <View style={styles.eventTop}>
                        <Text style={styles.eventTitle}>
                          {typeIcon(event.type)} {event.title}
                        </Text>
                        {canDelete && (
                          <TouchableOpacity onPress={() => handleDeleteEvent(event.id)}>
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {event.description ? (
                        <Text style={styles.eventDesc}>{event.description}</Text>
                      ) : null}

                      <View style={styles.eventMeta}>
                        <View style={[styles.typeBadge, { backgroundColor: typeColor(event.type) }]}>
                          <Text style={styles.typeBadgeText}>{event.type.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.eventTime}>
                          {formatTime(event.event_time)}
                        </Text>
                      </View>

                      <Text style={styles.createdBy}>Posted by {event.created_by_email}</Text>
                    </View>
                  );
                })}

                {/* ── Personal Reminders ── */}
                {selectedReminders.map((reminder) => (
                  <View key={reminder.id} style={[styles.eventCard, styles.reminderCard]}>
                    <View style={styles.eventTop}>
                      <Text style={styles.eventTitle}>🔔 {reminder.title}</Text>
                      <TouchableOpacity onPress={() => handleDeleteReminder(reminder.id)}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.reminderLabel}>
                      Personal reminder{formatTime(reminder.reminder_time)}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* ── Upcoming events strip (next 5) ── */}
            <Text style={styles.upcomingTitle}>Upcoming</Text>
            {events
              .filter((e) => e.event_date.split("T")[0] >= toDateKey(today))
              .slice(0, 5)
              .map((event) => (
                <TouchableOpacity
                  key={`upcoming-${event.id}`}
                  style={styles.upcomingRow}
                  onPress={() => setSelectedDate(event.event_date.split("T")[0])}
                >
                  <View style={[styles.upcomingDot, { backgroundColor: typeColor(event.type) }]} />
                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingEventTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={styles.upcomingDate}>
                      {new Date(event.event_date).toLocaleDateString([], {
                        weekday: "short", month: "short", day: "numeric",
                      })}
                      {formatTime(event.event_time)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            {events.filter((e) => e.event_date.split("T")[0] >= toDateKey(today)).length === 0 && (
              <Text style={styles.emptyDayText}>No upcoming events</Text>
            )}
          </>
        )}
      </ScrollView>

      {/* ══════════════════════════════════════
          CREATE EVENT MODAL (Educators only)
      ══════════════════════════════════════ */}
      <Modal
        visible={eventModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEventModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Event</Text>
            <TouchableOpacity onPress={() => setEventModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Assignment 1 Due"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Optional details..."
              multiline
              value={newDesc}
              onChangeText={setNewDesc}
            />

            <Text style={styles.fieldLabel}>Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2026-03-15"
              value={newDate}
              onChangeText={setNewDate}
            />

            <Text style={styles.fieldLabel}>Time (HH:MM, optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 14:00"
              value={newTime}
              onChangeText={setNewTime}
            />

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {(["event", "deadline", "class"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, newType === t && { backgroundColor: typeColor(t) }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[styles.typeChipText, newType === t && { color: "#fff" }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Visible to</Text>
            <View style={styles.typeRow}>
              {["all", "working", "returning", "parttime"].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, newTarget === t && styles.typeChipActive]}
                  onPress={() => setNewTarget(t)}
                >
                  <Text style={[styles.typeChipText, newTarget === t && { color: "#fff" }]}>
                    {t === "all" ? "Everyone" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateEvent}>
              <Text style={styles.submitBtnText}>Create Event</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════
          CREATE REMINDER MODAL (Learners only)
      ══════════════════════════════════════ */}
      <Modal
        visible={reminderModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReminderModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Reminder</Text>
            <TouchableOpacity onPress={() => setReminderModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Study for exam"
              value={remTitle}
              onChangeText={setRemTitle}
            />

            <Text style={styles.fieldLabel}>Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2026-03-15"
              value={remDate}
              onChangeText={setRemDate}
            />

            <Text style={styles.fieldLabel}>Time (HH:MM, optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 09:00"
              value={remTime}
              onChangeText={setRemTime}
            />

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: "#7c3aed" }]}
              onPress={handleCreateReminder}
            >
              <Text style={styles.submitBtnText}>Add Reminder</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },
  scrollContent: { paddingBottom: 40 },

  // Month nav
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  monthTitle: { fontSize: 18, fontWeight: "700" },
  navBtn: { padding: 6 },

  // Day labels
  dayLabels: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingBottom: 6,
    paddingHorizontal: 4,
  },
  dayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: "#999",
    fontWeight: "600",
  },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#fff",
    paddingHorizontal: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  selectedCell: { backgroundColor: "#2563eb", borderRadius: 10 },
  todayCell: { borderWidth: 1.5, borderColor: "#2563eb", borderRadius: 10 },
  dayNumber: { fontSize: 14, color: "#333" },
  selectedDayNumber: { color: "#fff", fontWeight: "700" },
  todayDayNumber: { color: "#2563eb", fontWeight: "700" },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#2563eb",
    marginTop: 2,
  },
  dotSelected: { backgroundColor: "#fff" },

  // Section
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  sectionActions: { flexDirection: "row", gap: 8 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // Event cards
  eventCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  reminderCard: { borderLeftColor: "#7c3aed" },
  eventTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  eventTitle: { fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  eventDesc: { fontSize: 13, color: "#666", marginBottom: 6 },
  eventMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  typeBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  eventTime: { fontSize: 12, color: "#888" },
  createdBy: { fontSize: 11, color: "#aaa", marginTop: 4 },
  reminderLabel: { fontSize: 12, color: "#7c3aed" },

  emptyDay: { alignItems: "center", paddingVertical: 24 },
  emptyDayText: { color: "#bbb", fontSize: 14, paddingHorizontal: 16, paddingVertical: 8 },

  // Upcoming strip
  upcomingTitle: {
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  upcomingDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  upcomingInfo: { flex: 1 },
  upcomingEventTitle: { fontSize: 14, fontWeight: "600" },
  upcomingDate: { fontSize: 12, color: "#888", marginTop: 2 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { padding: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#fafafa",
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f9f9f9",
  },
  typeChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  typeChipText: { fontSize: 13, color: "#555", fontWeight: "500" },
  submitBtn: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});