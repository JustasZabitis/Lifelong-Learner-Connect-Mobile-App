import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  Alert,
  ScrollView,
} from "react-native";
import AppHeader from "../../components/AppHeader";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";

interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: string;
  student_group: string | null;
  created_at: string;
  read_count: number;
  created_by: number;
}

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

import { BASE_URL } from "../../config";

const STUDENT_GROUPS = [
  "Ireland-Midlands",
  "Ireland-SUSI",
  "SB+",
  "Middle East",
  "India",
  "China",
];

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState<number | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [targetGroup, setTargetGroup] = useState<string>("all");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Filter state for educators/admins
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const getToken = async () =>
    Platform.OS === "web"
      ? localStorage.getItem("token")
      : await SecureStore.getItemAsync("token");

  const loadUser = async () => {
    const token = await getToken();
    if (!token) return;

    const decoded = jwtDecode<TokenPayload>(token);
    setRole(decoded.role);
    setUserId(decoded.id);
  };

  const fetchAnnouncements = async (groupFilter?: string) => {
    const token = await getToken();
    if (!token) return;

    const filter = groupFilter ?? activeFilter;
    const queryParam =
      filter && filter !== "all" ? `?student_group=${encodeURIComponent(filter)}` : "";

    const res = await fetch(`${BASE_URL}/api/announcements${queryParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    setAnnouncements(data);
  };

  useEffect(() => {
    loadUser();
    fetchAnnouncements();
  }, []);

  const markAsRead = async (id: number) => {
    const token = await getToken();
    if (!token) return;

    await fetch(`${BASE_URL}/api/announcements/${id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    fetchAnnouncements();
  };

  const handleCreate = async () => {
    if (!newTitle || !newContent) {
      Alert.alert("Error", "Title and content required");
      return;
    }

    const token = await getToken();
    if (!token) return;

    await fetch(`${BASE_URL}/api/announcements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: newTitle,
        content: newContent,
        priority,
        student_group: targetGroup === "all" ? null : targetGroup,
      }),
    });

    setNewTitle("");
    setNewContent("");
    setTargetGroup("all");
    fetchAnnouncements();
  };

  const handleDelete = async (id: number) => {
    const token = await getToken();
    if (!token) return;

    await fetch(`${BASE_URL}/api/announcements/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    fetchAnnouncements();
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    const token = await getToken();
    if (!token) return;

    await fetch(`${BASE_URL}/api/announcements/${editingId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: editTitle,
        content: editContent,
        priority,
      }),
    });

    setEditingId(null);
    fetchAnnouncements();
  };

  const handleFilterChange = (group: string) => {
    setActiveFilter(group);
    fetchAnnouncements(group);
  };

  const canCreate = role === "educator" || role === "admin";
  const isStaff = role === "educator" || role === "admin";

  const renderHeader = () => (
    <>
      {/* ── Filter chips for educators/admins ── */}
      {isStaff && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterBarContent}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              activeFilter === "all" && styles.filterChipActive,
            ]}
            onPress={() => handleFilterChange("all")}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === "all" && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {STUDENT_GROUPS.map((group) => (
            <TouchableOpacity
              key={group}
              style={[
                styles.filterChip,
                activeFilter === group && styles.filterChipActive,
              ]}
              onPress={() => handleFilterChange(group)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === group && styles.filterChipTextActive,
                ]}
              >
                {group}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </>
  );

  const renderFooter = () => {
    if (!canCreate) return null;

    return (
      <View style={styles.createSection}>
        <Text style={styles.subHeader}>Create Announcement</Text>

        <TextInput
          placeholder="Title"
          style={styles.input}
          value={newTitle}
          onChangeText={setNewTitle}
        />

        <TextInput
          placeholder="Content"
          style={[styles.input, { height: 80 }]}
          multiline
          value={newContent}
          onChangeText={setNewContent}
        />

        {/* Student Group Selector */}
        <Text style={styles.selectorLabel}>Target Group</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.groupSelector}
          contentContainerStyle={styles.groupSelectorContent}
        >
          <TouchableOpacity
            style={[
              styles.groupChip,
              targetGroup === "all" && styles.groupChipActive,
            ]}
            onPress={() => setTargetGroup("all")}
          >
            <Text
              style={[
                styles.groupChipText,
                targetGroup === "all" && styles.groupChipTextActive,
              ]}
            >
              All Students
            </Text>
          </TouchableOpacity>

          {STUDENT_GROUPS.map((group) => (
            <TouchableOpacity
              key={group}
              style={[
                styles.groupChip,
                targetGroup === group && styles.groupChipActive,
              ]}
              onPress={() => setTargetGroup(group)}
            >
              <Text
                style={[
                  styles.groupChipText,
                  targetGroup === group && styles.groupChipTextActive,
                ]}
              >
                {group}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Priority Selector */}
        <Text style={styles.selectorLabel}>Priority</Text>
        <View style={styles.priorityRow}>
          {(["low", "medium", "high"] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.priorityChip,
                priority === p && styles.priorityChipActive,
                priority === p && p === "high" && { backgroundColor: "#ef4444" },
                priority === p && p === "medium" && { backgroundColor: "#f59e0b" },
                priority === p && p === "low" && { backgroundColor: "#10b981" },
              ]}
              onPress={() => setPriority(p)}
            >
              <Text
                style={[
                  styles.priorityChipText,
                  priority === p && styles.priorityChipTextActive,
                ]}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreate}
        >
          <Text style={styles.buttonText}>Post</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader />

      <View style={styles.container}>
        <Text style={styles.header}>Announcements</Text>

        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          renderItem={({ item }) => {
            const isOwner =
              userId === item.created_by || role === "admin" || role === "educator";

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => markAsRead(item.id)}
              >
                {editingId === item.id ? (
                  <>
                    <TextInput
                      style={styles.input}
                      value={editTitle}
                      onChangeText={setEditTitle}
                    />
                    <TextInput
                      style={styles.input}
                      value={editContent}
                      onChangeText={setEditContent}
                    />
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleUpdate}
                    >
                      <Text style={styles.buttonText}>Save</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.row}>
                      <Text style={styles.title}>{item.title}</Text>

                      <View
                        style={[
                          styles.badge,
                          item.priority === "high" && styles.high,
                          item.priority === "medium" && styles.medium,
                          item.priority === "low" && styles.low,
                        ]}
                      >
                        <Text style={styles.badgeText}>
                          {item.priority.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Student group badge */}
                    {item.student_group && (
                      <View style={styles.groupBadge}>
                        <Text style={styles.groupBadgeText}>
                          🎯 {item.student_group}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.content}>{item.content}</Text>

                    <View style={styles.footer}>
                      <Text style={styles.readCount}>
                        👁 {item.read_count}
                      </Text>

                      {isOwner && (
                        <View style={styles.actions}>
                          <TouchableOpacity
                            onPress={() => {
                              setEditingId(item.id);
                              setEditTitle(item.title);
                              setEditContent(item.content);
                            }}
                          >
                            <Text style={styles.edit}>Edit</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleDelete(item.id)}
                          >
                            <Text style={styles.delete}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },
  container: { flex: 1, padding: 16 },

  header: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  subHeader: { fontSize: 18, fontWeight: "600", marginBottom: 10 },

  // Filter bar — fixed height, no squishing
  filterBar: {
    flexGrow: 0,
    flexShrink: 0,
    height: 40,
    marginBottom: 12,
  },
  filterBarContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    flexShrink: 0,
  },
  filterChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  filterChipTextActive: { color: "#fff" },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  title: { fontWeight: "600", fontSize: 16, flex: 1, marginRight: 8 },
  content: { marginTop: 8 },

  // Group badge on cards
  groupBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },
  groupBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563eb",
  },

  footer: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },

  badgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  high: { backgroundColor: "#ef4444" },
  medium: { backgroundColor: "#f59e0b" },
  low: { backgroundColor: "#10b981" },

  readCount: { fontSize: 12 },

  actions: { flexDirection: "row" },
  edit: { color: "#2563eb", marginRight: 15 },
  delete: { color: "#ef4444" },

  createSection: {
    marginTop: 20,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },

  // Group selector in create form
  selectorLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 4,
  },
  groupSelector: {
    flexGrow: 0,
    flexShrink: 0,
    height: 40,
    marginBottom: 10,
  },
  groupSelectorContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    flexShrink: 0,
  },
  groupChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  groupChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  groupChipTextActive: { color: "#fff" },

  // Priority selector
  priorityRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  priorityChipActive: {
    borderColor: "transparent",
  },
  priorityChipText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  priorityChipTextActive: { color: "#fff" },

  createButton: {
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 12,
  },

  saveButton: {
    backgroundColor: "#2563eb",
    padding: 10,
    borderRadius: 10,
  },

  buttonText: { color: "#fff", textAlign: "center", fontWeight: "600" },
});