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
} from "react-native";
import AppHeader from "../../components/AppHeader";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";

interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: string;
  created_at: string;
  read_count: number;
  created_by: number;
}

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:5000"
    : "http://192.168.0.246:5000";

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState<number | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

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

  const fetchAnnouncements = async () => {
    const token = await getToken();
    if (!token) return;

    const res = await fetch(`${BASE_URL}/api/announcements`, {
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
      }),
    });

    setNewTitle("");
    setNewContent("");
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

  const canCreate = role === "educator" || role === "admin";

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader />

      <View style={styles.container}>
        <Text style={styles.header}>Announcements</Text>

        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            const isOwner =
              userId === item.created_by || role === "admin";

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

        {canCreate && (
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

            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreate}
            >
              <Text style={styles.buttonText}>Post</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },
  container: { flex: 1, padding: 16 },

  header: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  subHeader: { fontSize: 18, fontWeight: "600", marginBottom: 10 },

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

  title: { fontWeight: "600", fontSize: 16 },
  content: { marginTop: 8 },

  footer: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
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

  buttonText: { color: "#fff", textAlign: "center" },
});