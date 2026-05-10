/**
 * Calendar tab — a month-view calendar with events and personal reminders.
 * Educators and admins can create events (classes, deadlines, general events)
 * and target them at everyone, a specific student group, or a specific course.
 * All users can add personal reminders that only they can see.
 * Dots on calendar cells indicate days that have events (blue) or reminders (amber).
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";
import { useToast } from "../../components/Toast";
import { BASE_URL } from "../../config";
import { useAccessibility } from "../../contexts/AccessibilityContext";

// ─── Types ────────────────────────────────────────────────────────────────
// Shape of a calendar event returned by the API
interface Event {
  id: number; title: string; description: string | null; event_date: string;
  event_time: string | null; type: "event" | "deadline" | "class";
  role_target: string; student_group: string | null; programme_name: string | null;
  created_by: number; created_by_email: string;
}
interface Reminder { id: number; title: string; reminder_date: string; reminder_time: string | null; }
interface TokenPayload { id: number; email: string; role: string; }
type TargetMode = "all" | "group" | "course";

// ─── Helpers ──────────────────────────────────────────────────────────────
// Read the JWT from the right storage depending on whether we're on web or native
const getToken = async (): Promise<string | null> =>
  Platform.OS === "web" ? localStorage.getItem("token") : SecureStore.getItemAsync("token");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const STUDENT_GROUPS = ["Ireland-Midlands", "Ireland-SUSI", "SB+", "Middle East", "India", "China"];

const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatTime = (timeStr: string | null): string => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  return ` · ${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
};

const typeColor = (type: string): string => {
  switch (type) { case "deadline": return "#ef4444"; case "class": return "#8b5cf6"; default: return "#2563eb"; }
};
const typeIcon = (type: string): string => {
  switch (type) { case "deadline": return "⚠️"; case "class": return "🎓"; default: return "📅"; }
};

// ─── Component ────────────────────────────────────────────────────────────
export default function CalendarScreen() {
  const { showToast, confirm } = useToast();
  const { colors, t } = useAccessibility();
  // Track which month and day the user is currently looking at
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  // selectedDate is the highlighted cell — tapping a day sets this
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey(today));
  const [events, setEvents] = useState<Event[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState<number | null>(null);

  // create event modal — mutually exclusive targeting
  const [eventModal, setEventModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newType, setNewType] = useState<"event" | "deadline" | "class">("event");
  const [targetMode, setTargetMode] = useState<TargetMode>("all");
  const [targetGroup, setTargetGroup] = useState("");
  const [targetProgramme, setTargetProgramme] = useState("");
  const [showCourseSuggestions, setShowCourseSuggestions] = useState(false);

  // programme names for autocomplete
  const [programmeNames, setProgrammeNames] = useState<string[]>([]);

  // create reminder modal
  const [reminderModal, setReminderModal] = useState(false);
  const [remTitle, setRemTitle] = useState("");
  const [remDate, setRemDate] = useState("");
  const [remTime, setRemTime] = useState("");

  const isStaff = role === "educator" || role === "admin";

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

  // fetch programme names for autocomplete
  useEffect(() => {
    const fetchProgrammes = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${BASE_URL}/api/resources/programmes`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setProgrammeNames(await res.json());
      } catch (err) { console.error("Failed to fetch programmes:", err); }
    };
    fetchProgrammes();
  }, []);

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
    } catch (err) { console.error("Failed to fetch calendar data:", err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const eventDates = new Set(events.map((e) => e.event_date.split("T")[0]));
  const reminderDates = new Set(reminders.map((r) => r.reminder_date.split("T")[0]));
  const selectedEvents = events.filter((e) => e.event_date.split("T")[0] === selectedDate);
  const selectedReminders = reminders.filter((r) => r.reminder_date.split("T")[0] === selectedDate);

  const prevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); };
  const nextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); };

  const courseSuggestions = programmeNames.filter((p) => targetProgramme && p.toLowerCase().includes(targetProgramme.toLowerCase()));

  // create event — sends only the relevant targeting field
  const handleCreateEvent = async () => {
    if (!newTitle.trim() || !newDate.trim()) {
      showToast("Title and date are required", "warning");
      return;
    }
    try {
      const token = await getToken();
      const body: any = {
        title: newTitle, description: newDesc || null,
        event_date: newDate, event_time: newTime || null,
        type: newType, role_target: "all",
      };
      // only send the targeting field that was actually selected
      if (targetMode === "group" && targetGroup) body.student_group = targetGroup;
      else if (targetMode === "course" && targetProgramme) body.programme_name = targetProgramme;

      const res = await fetch(`${BASE_URL}/api/calendar/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEventModal(false);
        setNewTitle(""); setNewDesc(""); setNewDate(""); setNewTime(""); setNewType("event");
        setTargetMode("all"); setTargetGroup(""); setTargetProgramme("");
        fetchData();
        showToast("Event created", "success");
      } else {
        const err = await res.json();
        showToast(err.error, "error", "Error");
      }
    } catch { showToast("Could not create event", "error", "Error"); }
  };

  const handleDeleteEvent = async (id: number) => {
    const confirmed = await confirm("Are you sure?", {
      title: "Delete Event",
      confirmText: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    const token = await getToken();
    await fetch(`${BASE_URL}/api/calendar/events/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    fetchData();
    showToast("Event deleted", "success");
  };

  const handleCreateReminder = async () => {
    if (!remTitle.trim() || !remDate.trim()) {
      showToast("Title and date are required", "warning");
      return;
    }
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/calendar/reminders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: remTitle, reminder_date: remDate, reminder_time: remTime || null }),
      });
      if (res.ok) { setReminderModal(false); setRemTitle(""); setRemDate(""); setRemTime(""); fetchData(); showToast("Reminder created", "success"); }
    } catch { showToast("Could not create reminder", "error", "Error"); }
  };

  const handleDeleteReminder = async (id: number) => {
    const token = await getToken();
    await fetch(`${BASE_URL}/api/calendar/reminders/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    fetchData();
    showToast("Reminder deleted", "success");
  };

  if (loading) return <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}><AppHeader /><ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <AppHeader />
      <ScrollView>
        {/* month header */}
        <View style={[s.monthHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={prevMonth}><Ionicons name="chevron-back" size={24} color={colors.primary} /></TouchableOpacity>
          <Text style={[s.monthTitle, { color: colors.text }]}>{MONTHS[currentMonth]} {currentYear}</Text>
          <TouchableOpacity onPress={nextMonth}><Ionicons name="chevron-forward" size={24} color={colors.primary} /></TouchableOpacity>
        </View>

        <View style={[s.dayLabels, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>{DAYS.map((d) => <Text key={d} style={[s.dayLabel, { color: colors.textMuted }]}>{d}</Text>)}</View>

        <View style={[s.grid, { backgroundColor: colors.surface }]}>
          {calendarCells.map((day, idx) => {
            if (day === null) return <View key={`empty-${idx}`} style={s.cell} />;
            const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isSelected = dateKey === selectedDate;
            const isToday = dateKey === toDateKey(today);
            return (
              <TouchableOpacity key={dateKey} style={[s.cell, isSelected && s.cellSelected, isToday && !isSelected && { backgroundColor: colors.primaryLight, borderRadius: 20 }]} onPress={() => setSelectedDate(dateKey)}>
                <Text style={[s.cellText, { color: colors.text }, isSelected && s.cellTextSelected]}>{day}</Text>
                <View style={s.dotRow}>
                  {eventDates.has(dateKey) && <View style={[s.dot, { backgroundColor: "#2563eb" }]} />}
                  {reminderDates.has(dateKey) && <View style={[s.dot, { backgroundColor: "#f59e0b" }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* action buttons */}
        <View style={s.actionRow}>
          {isStaff && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.primaryLight }]} onPress={() => { setNewDate(selectedDate); setEventModal(true); }}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={[s.actionBtnText, { color: colors.primary }]}>{t("calendar_add_event")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#fef3c7" }]} onPress={() => { setRemDate(selectedDate); setReminderModal(true); }}>
            <Ionicons name="alarm-outline" size={18} color="#f59e0b" />
            <Text style={[s.actionBtnText, { color: "#f59e0b" }]}>{t("calendar_add_reminder")}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[s.dayTitle, { color: colors.text }]}>{new Date(selectedDate + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</Text>

        {selectedEvents.length === 0 && selectedReminders.length === 0 && <Text style={[s.emptyDayText, { color: colors.textMuted }]}>{t("calendar_no_events")}</Text>}

        {selectedEvents.map((event) => (
          <View key={event.id} style={[s.eventCard, { backgroundColor: colors.surface }]}>
            <View style={[s.eventStripe, { backgroundColor: typeColor(event.type) }]} />
            <View style={s.eventInfo}>
              <Text style={[s.eventTitle, { color: colors.text }]}>{typeIcon(event.type)} {event.title}</Text>
              {event.description ? <Text style={[s.eventDesc, { color: colors.textMuted }]}>{event.description}</Text> : null}
              <Text style={[s.eventMeta, { color: colors.textMuted }]}>
                {event.type.charAt(0).toUpperCase() + event.type.slice(1)}{formatTime(event.event_time)}
                {event.student_group ? ` · ${event.student_group}` : ""}
                {event.programme_name ? ` · ${event.programme_name}` : ""}
              </Text>
            </View>
            {(isStaff || event.created_by === userId) && (
              <TouchableOpacity onPress={() => handleDeleteEvent(event.id)}><Ionicons name="trash-outline" size={18} color="#ef4444" /></TouchableOpacity>
            )}
          </View>
        ))}

        {selectedReminders.map((r) => (
          <View key={r.id} style={s.reminderCard}>
            <Ionicons name="alarm" size={18} color="#f59e0b" />
            <Text style={s.reminderLabel}>{r.title}{formatTime(r.reminder_time)}</Text>
            <TouchableOpacity onPress={() => handleDeleteReminder(r.id)}><Ionicons name="close-circle" size={16} color="#ef4444" /></TouchableOpacity>
          </View>
        ))}

        <Text style={[s.upcomingTitle, { color: colors.text }]}>Upcoming</Text>
        {events.filter((e) => e.event_date.split("T")[0] >= toDateKey(today)).slice(0, 5).map((event) => (
          <TouchableOpacity key={`up-${event.id}`} style={[s.upcomingRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} onPress={() => setSelectedDate(event.event_date.split("T")[0])}>
            <View style={[s.upcomingDot, { backgroundColor: typeColor(event.type) }]} />
            <View style={s.upcomingInfo}>
              <Text style={[s.upcomingEventTitle, { color: colors.text }]} numberOfLines={1}>{event.title}</Text>
              <Text style={[s.upcomingDate, { color: colors.textMuted }]}>
                {new Date(event.event_date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                {formatTime(event.event_time)}
                {event.programme_name ? ` · ${event.programme_name}` : ""}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
        {events.filter((e) => e.event_date.split("T")[0] >= toDateKey(today)).length === 0 && <Text style={[s.emptyDayText, { color: colors.textMuted }]}>No upcoming events</Text>}
      </ScrollView>

      {/* ══════ CREATE EVENT MODAL ══════ */}
      <Modal visible={eventModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEventModal(false)}>
        <SafeAreaView style={[s.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[s.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>New Event</Text>
            <TouchableOpacity onPress={() => setEventModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody}>
            <Text style={[s.fieldLabel, { color: colors.textMuted }]}>Title *</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="e.g. Assignment 1 Due" placeholderTextColor={colors.textMuted} value={newTitle} onChangeText={setNewTitle} />

            <Text style={[s.fieldLabel, { color: colors.textMuted }]}>Description</Text>
            <TextInput style={[s.input, { height: 80, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="Optional details..." placeholderTextColor={colors.textMuted} multiline value={newDesc} onChangeText={setNewDesc} />

            <Text style={[s.fieldLabel, { color: colors.textMuted }]}>Date * (YYYY-MM-DD)</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="e.g. 2026-03-15" placeholderTextColor={colors.textMuted} value={newDate} onChangeText={setNewDate} />

            <Text style={[s.fieldLabel, { color: colors.textMuted }]}>Time (HH:MM, optional)</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="e.g. 14:00" placeholderTextColor={colors.textMuted} value={newTime} onChangeText={setNewTime} />

            <Text style={[s.fieldLabel, { color: colors.textMuted }]}>Type</Text>
            <View style={s.typeRow}>
              {(["event", "deadline", "class"] as const).map((tp) => (
                <TouchableOpacity key={tp} style={[s.typeChip, { backgroundColor: newType === tp ? typeColor(tp) : colors.surfaceAlt, borderColor: newType === tp ? typeColor(tp) : colors.border }]} onPress={() => setNewType(tp)}>
                  <Text style={[s.typeChipText, { color: newType === tp ? "#fff" : colors.text }]}>{tp.charAt(0).toUpperCase() + tp.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* mutually exclusive targeting — All, Student Group, or Course */}
            <Text style={[s.fieldLabel, { color: colors.textMuted }]}>Visible To</Text>
            <View style={s.typeRow}>
              <TouchableOpacity style={[s.typeChip, { backgroundColor: targetMode === "all" ? "#2563eb" : colors.surfaceAlt, borderColor: targetMode === "all" ? "#2563eb" : colors.border }]} onPress={() => { setTargetMode("all"); setTargetGroup(""); setTargetProgramme(""); setShowCourseSuggestions(false); }}>
                <Text style={[s.typeChipText, { color: targetMode === "all" ? "#fff" : colors.text }]}>Everyone</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.typeChip, { backgroundColor: targetMode === "group" ? "#2563eb" : colors.surfaceAlt, borderColor: targetMode === "group" ? "#2563eb" : colors.border }]} onPress={() => { setTargetMode("group"); setTargetProgramme(""); setShowCourseSuggestions(false); }}>
                <Text style={[s.typeChipText, { color: targetMode === "group" ? "#fff" : colors.text }]}>Student Group</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.typeChip, { backgroundColor: targetMode === "course" ? "#2563eb" : colors.surfaceAlt, borderColor: targetMode === "course" ? "#2563eb" : colors.border }]} onPress={() => { setTargetMode("course"); setTargetGroup(""); }}>
                <Text style={[s.typeChipText, { color: targetMode === "course" ? "#fff" : colors.text }]}>Specific Course</Text>
              </TouchableOpacity>
            </View>

            {/* show group picker only when "Student Group" is selected */}
            {targetMode === "group" && (
              <View style={[s.typeRow, { marginTop: 10 }]}>
                {STUDENT_GROUPS.map((g) => (
                  <TouchableOpacity key={g} style={[s.typeChip, targetGroup === g && { backgroundColor: "#10b981", borderColor: "#10b981" }]} onPress={() => setTargetGroup(g)}>
                    <Text style={[s.typeChipText, targetGroup === g && { color: "#fff" }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* show course search only when "Specific Course" is selected */}
            {targetMode === "course" && (
              <>
                <TextInput
                  style={[s.input, { marginTop: 10 }]}
                  placeholder="Search for a course name..."
                  value={targetProgramme}
                  onChangeText={(v) => { setTargetProgramme(v); setShowCourseSuggestions(v.length > 0); }}
                  autoCapitalize="none"
                />
                {showCourseSuggestions && courseSuggestions.length > 0 && (
                  <View style={s.suggestionsBox}>
                    <ScrollView style={{ maxHeight: 120 }}>
                      {courseSuggestions.slice(0, 6).map((p) => (
                        <TouchableOpacity key={p} style={s.suggestionRow} onPress={() => { setTargetProgramme(p); setShowCourseSuggestions(false); }}>
                          <Text style={s.suggestionText} numberOfLines={1}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity style={s.submitBtn} onPress={handleCreateEvent}>
              <Text style={s.submitBtnText}>Create Event</Text>
            </TouchableOpacity>
            <View style={{ height: 30 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ══════ CREATE REMINDER MODAL ══════ */}
      <Modal visible={reminderModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReminderModal(false)}>
        <SafeAreaView style={[s.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[s.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>{t("calendar_add_reminder")}</Text>
            <TouchableOpacity onPress={() => setReminderModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
          </View>
          <View style={s.modalBody}>
            <Text style={[s.fieldLabel, { color: colors.textMuted }]}>Title *</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="e.g. Study for exam" placeholderTextColor={colors.textMuted} value={remTitle} onChangeText={setRemTitle} />
            <Text style={[s.fieldLabel, { color: colors.textMuted }]}>Date * (YYYY-MM-DD)</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="e.g. 2026-03-15" placeholderTextColor={colors.textMuted} value={remDate} onChangeText={setRemDate} />
            <Text style={[s.fieldLabel, { color: colors.textMuted }]}>Time (HH:MM, optional)</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="e.g. 14:00" placeholderTextColor={colors.textMuted} value={remTime} onChangeText={setRemTime} />
            <TouchableOpacity style={s.submitBtn} onPress={handleCreateReminder}>
              <Text style={s.submitBtnText}>Create Reminder</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1 },
  monthHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  monthTitle: { fontSize: 18, fontWeight: "700" },
  dayLabels: { flexDirection: "row", backgroundColor: "#fff", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600", color: "#888" },
  grid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#fff", paddingBottom: 8 },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 8 },
  cellSelected: { backgroundColor: "#2563eb", borderRadius: 20 },
  cellToday: { backgroundColor: "#eff6ff", borderRadius: 20 },
  cellText: { fontSize: 14, fontWeight: "500", color: "#333" },
  cellTextSelected: { color: "#fff", fontWeight: "700" },
  dotRow: { flexDirection: "row", gap: 3, marginTop: 2, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  actionRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eff6ff", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  actionBtnText: { fontSize: 13, fontWeight: "600", color: "#2563eb" },
  dayTitle: { fontSize: 16, fontWeight: "700", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  emptyDayText: { color: "#bbb", fontSize: 14, paddingHorizontal: 16, paddingVertical: 8 },
  eventCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", paddingRight: 12 },
  eventStripe: { width: 4, alignSelf: "stretch" },
  eventInfo: { flex: 1, padding: 12 },
  eventTitle: { fontSize: 14, fontWeight: "600" },
  eventDesc: { fontSize: 12, color: "#666", marginTop: 4 },
  eventMeta: { fontSize: 11, color: "#999", marginTop: 4 },
  reminderCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, backgroundColor: "#fffbeb", borderRadius: 12, padding: 12, gap: 10 },
  reminderLabel: { flex: 1, fontSize: 13, color: "#92400e", fontWeight: "500" },
  upcomingTitle: { fontSize: 16, fontWeight: "700", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  upcomingRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0", backgroundColor: "#fff" },
  upcomingDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  upcomingInfo: { flex: 1 },
  upcomingEventTitle: { fontSize: 14, fontWeight: "600" },
  upcomingDate: { fontSize: 12, color: "#888", marginTop: 2 },
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { padding: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#fafafa" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#f9f9f9" },
  typeChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  typeChipText: { fontSize: 13, color: "#555", fontWeight: "500" },
  suggestionsBox: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", marginTop: 4, marginBottom: 8 },
  suggestionRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  suggestionText: { fontSize: 13, color: "#374151" },
  submitBtn: { backgroundColor: "#2563eb", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 24 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});