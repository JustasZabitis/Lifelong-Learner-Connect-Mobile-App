import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";

// ─── Types ───────────────────────────────────────────────────────────────
interface Conversation {
  id: number;
  name: string | null;
  is_group: boolean;
  last_message: string | null;
  last_message_at: string | null;
  other_user_email: string | null;
}

interface User {
  id: number;
  email: string;
  role: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────
const getToken = async (): Promise<string | null> =>
  Platform.OS === "web"
    ? localStorage.getItem("token")
    : SecureStore.getItemAsync("token");

const formatTime = (dateStr: string | null): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
};

// ─── Component ────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [myEmail, setMyEmail] = useState("");

  // New Message modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  // Group chat modal state
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  // ── Load logged-in user info ──
  useEffect(() => {
    const init = async () => {
      const token = await getToken();
      if (!token) return;
      const decoded = jwtDecode<TokenPayload>(token);
      setMyEmail(decoded.email);
    };
    init();
  }, []);

  // ── Fetch conversations ──
  const fetchConversations = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setConversations(data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ── Fetch all users for the picker ──
  const fetchAllUsers = async () => {
    setModalLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/messages/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setAllUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setModalLoading(false);
    }
  };

  // ── Start a direct message ──
  const startDirectMessage = async (otherUserId: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/messages/conversations/direct`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ other_user_id: otherUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setModalVisible(false);
        setUserSearch("");
        router.push(`/chat/${data.conversation_id}` as any)
      }
    } catch (err) {
      Alert.alert("Error", "Could not start conversation");
    }
  };

  // ── Create a group chat ──
  const createGroupChat = async () => {
    if (!groupName.trim()) return Alert.alert("Please enter a group name");
    if (selectedUsers.length === 0)
      return Alert.alert("Please select at least one participant");

    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/messages/conversations/group`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: groupName,
          participant_ids: selectedUsers,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroupModalVisible(false);
        setGroupName("");
        setSelectedUsers([]);
        fetchConversations();
        router.push(`/chat/${data.conversation_id}` as any)
      }
    } catch (err) {
      Alert.alert("Error", "Could not create group");
    }
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = allUsers.filter((u) =>
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  // ── Conversation display name ──
  const getConversationTitle = (convo: Conversation): string => {
    if (convo.is_group) return convo.name || "Group Chat";
    return convo.other_user_email || "Unknown";
  };

  // ── Render each conversation row ──
  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationRow}
      onPress={() => router.push(`/chat/${item.id}` as any) }
    >
      {/* Avatar circle */}
      <View style={[styles.avatar, item.is_group && styles.avatarGroup]}>
        <Ionicons
          name={item.is_group ? "people" : "person"}
          size={20}
          color="#fff"
        />
      </View>

      {/* Text content */}
      <View style={styles.conversationInfo}>
        <View style={styles.conversationTop}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {getConversationTitle(item)}
          </Text>
          <Text style={styles.timeText}>{formatTime(item.last_message_at)}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message || "No messages yet"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader />

      {/* ── Header bar ── */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              fetchAllUsers();
              setGroupModalVisible(true);
            }}
          >
            <Ionicons name="people-outline" size={22} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              fetchAllUsers();
              setModalVisible(true);
            }}
          >
            <Ionicons name="create-outline" size={22} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Conversations list ── */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
      ) : conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubText}>
            Tap the pencil icon to start a new message
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* ── New Direct Message Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Message</Text>
            <TouchableOpacity onPress={() => { setModalVisible(false); setUserSearch(""); }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search by email..."
            value={userSearch}
            onChangeText={setUserSearch}
            autoCapitalize="none"
          />

          {modalLoading ? (
            <ActivityIndicator style={{ marginTop: 20 }} color="#2563eb" />
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.userRow}
                  onPress={() => startDirectMessage(item.id)}
                >
                  <View style={styles.userAvatar}>
                    <Ionicons name="person" size={18} color="#fff" />
                  </View>
                  <View>
                    <Text style={styles.userEmail}>{item.email}</Text>
                    <Text style={styles.userRole}>{item.role}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ── New Group Chat Modal ── */}
      <Modal
        visible={groupModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setGroupModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Group Chat</Text>
            <TouchableOpacity onPress={() => { setGroupModalVisible(false); setGroupName(""); setSelectedUsers([]); }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Group name..."
            value={groupName}
            onChangeText={setGroupName}
          />

          <Text style={styles.sectionLabel}>Select participants:</Text>

          {modalLoading ? (
            <ActivityIndicator style={{ marginTop: 20 }} color="#2563eb" />
          ) : (
            <FlatList
              data={allUsers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const selected = selectedUsers.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.userRow, selected && styles.userRowSelected]}
                    onPress={() => toggleUserSelection(item.id)}
                  >
                    <View style={[styles.userAvatar, selected && styles.userAvatarSelected]}>
                      <Ionicons name={selected ? "checkmark" : "person"} size={18} color="#fff" />
                    </View>
                    <View>
                      <Text style={styles.userEmail}>{item.email}</Text>
                      <Text style={styles.userRole}>{item.role}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity style={styles.createButton} onPress={createGroupChat}>
            <Text style={styles.createButtonText}>
              Create Group ({selectedUsers.length} selected)
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },

  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 12 },
  iconButton: { padding: 4 },

  listContent: { paddingTop: 4 },

  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarGroup: { backgroundColor: "#7c3aed" },
  conversationInfo: { flex: 1 },
  conversationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  conversationName: { fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  timeText: { fontSize: 12, color: "#999" },
  lastMessage: { fontSize: 13, color: "#666" },

  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyText: { fontSize: 18, fontWeight: "600", color: "#999", marginTop: 16 },
  emptySubText: { fontSize: 14, color: "#bbb", marginTop: 8, textAlign: "center" },

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
  searchInput: {
    margin: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    fontSize: 15,
  },
  sectionLabel: { paddingHorizontal: 16, fontWeight: "600", color: "#555", marginBottom: 8 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  userRowSelected: { backgroundColor: "#eff6ff" },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userAvatarSelected: { backgroundColor: "#16a34a" },
  userEmail: { fontSize: 15, fontWeight: "500" },
  userRole: { fontSize: 12, color: "#888", marginTop: 2 },

  createButton: {
    margin: 16,
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  createButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});