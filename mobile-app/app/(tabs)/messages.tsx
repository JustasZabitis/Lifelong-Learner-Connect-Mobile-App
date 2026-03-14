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
  is_broadcast: boolean;
  last_message: string | null;
  last_message_at: string | null;
  other_user_email: string | null;
  archived_at?: string | null;
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

const STUDENT_GROUPS = [
  "Ireland-Midlands",
  "Ireland-SUSI",
  "SB+",
  "Middle East",
  "India",
  "China",
];

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
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [myEmail, setMyEmail] = useState("");
  const [myRole, setMyRole] = useState("");

  // Show/hide archived section
  const [showArchived, setShowArchived] = useState(false);

  // New Message modal
  const [modalVisible, setModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  // Group chat modal
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  // Broadcast modal
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [broadcastGroup, setBroadcastGroup] = useState<string>("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);

  // ── Load user info ──
  useEffect(() => {
    const init = async () => {
      const token = await getToken();
      if (!token) return;
      const decoded = jwtDecode<TokenPayload>(token);
      setMyEmail(decoded.email);
      setMyRole(decoded.role);
    };
    init();
  }, []);

  const isStaff = myRole === "educator" || myRole === "admin";

  // ── Fetch active conversations ──
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

  // ── Fetch archived conversations ──
  const fetchArchived = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/messages/conversations/archived`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setArchivedConversations(data);
    } catch (err) {
      console.error("Failed to fetch archived:", err);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchArchived();
  }, [fetchConversations, fetchArchived]);

  // ── Fetch all users for picker ──
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

  // ── Archive a conversation ──
  const handleArchive = async (id: number) => {
    const token = await getToken();
    await fetch(`${BASE_URL}/api/messages/conversations/${id}/archive`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchConversations();
    fetchArchived();
  };

  // ── Unarchive a conversation ──
  const handleUnarchive = async (id: number) => {
    const token = await getToken();
    await fetch(`${BASE_URL}/api/messages/conversations/${id}/unarchive`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchConversations();
    fetchArchived();
  };

  // ── Delete a conversation permanently ──
  const handleDelete = async (id: number) => {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm("Permanently delete this conversation? This cannot be undone.")
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Delete Conversation",
              "This will permanently remove this conversation. This cannot be undone.",
              [
                { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                { text: "Delete", style: "destructive", onPress: () => resolve(true) },
              ]
            );
          });

    if (!confirmed) return;

    const token = await getToken();
    await fetch(`${BASE_URL}/api/messages/conversations/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchConversations();
    fetchArchived();
  };

  // ── Start direct message ──
  const startDirectMessage = async (otherUserId: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/messages/conversations/direct`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ other_user_id: otherUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setModalVisible(false);
        setUserSearch("");
        router.push(`/chat/${data.conversation_id}` as any);
      }
    } catch (err) {
      Alert.alert("Error", "Could not start conversation");
    }
  };

  // ── Create group chat ──
  const createGroupChat = async () => {
    if (!groupName.trim()) return Alert.alert("Please enter a group name");
    if (selectedUsers.length === 0) return Alert.alert("Please select at least one participant");

    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/messages/conversations/group`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName, participant_ids: selectedUsers }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroupModalVisible(false);
        setGroupName("");
        setSelectedUsers([]);
        fetchConversations();
        router.push(`/chat/${data.conversation_id}` as any);
      }
    } catch (err) {
      Alert.alert("Error", "Could not create group");
    }
  };

  // ── Broadcast ──
  const handleBroadcast = async () => {
    if (!broadcastGroup) return Alert.alert("Please select a student group");
    if (!broadcastMessage.trim()) return Alert.alert("Please enter a message");

    setBroadcasting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/messages/conversations/broadcast`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ student_group: broadcastGroup, message: broadcastMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setBroadcastModalVisible(false);
        setBroadcastGroup("");
        setBroadcastMessage("");
        fetchConversations();
        Alert.alert("Broadcast Sent", `Message sent to ${data.sent_to} learner(s) in ${data.student_group}.`);
      } else {
        Alert.alert("Error", data.error || "Broadcast failed");
      }
    } catch (err) {
      Alert.alert("Error", "Could not broadcast message");
    } finally {
      setBroadcasting(false);
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

  const getConversationTitle = (convo: Conversation): string => {
    if (convo.is_group) return convo.name || "Group Chat";
    if (convo.is_broadcast && convo.name) return convo.name;
    return convo.other_user_email || "Unknown";
  };

  // ── Render conversation row ──
  const renderConversationRow = (item: Conversation, isArchived: boolean) => (
    <View style={styles.conversationRow}>
      <TouchableOpacity
        style={styles.conversationPressable}
        onPress={() => router.push(`/chat/${item.id}` as any)}
      >
        <View
          style={[
            styles.avatar,
            item.is_group && styles.avatarGroup,
            item.is_broadcast && styles.avatarBroadcast,
          ]}
        >
          <Ionicons
            name={item.is_broadcast ? "megaphone" : item.is_group ? "people" : "person"}
            size={20}
            color="#fff"
          />
        </View>

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

      {/* Action buttons */}
      <View style={styles.rowActions}>
        {isArchived ? (
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={() => handleUnarchive(item.id)}
          >
            <Ionicons name="arrow-undo-outline" size={18} color="#2563eb" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.archiveBtn}
            onPress={() => handleArchive(item.id)}
          >
            <Ionicons name="archive-outline" size={18} color="#f59e0b" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item.id)}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader />

      {/* ── Header bar ── */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerActions}>
          {isStaff && (
            <TouchableOpacity style={styles.iconButton} onPress={() => setBroadcastModalVisible(true)}>
              <Ionicons name="megaphone-outline" size={22} color="#f59e0b" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => { fetchAllUsers(); setGroupModalVisible(true); }}
          >
            <Ionicons name="people-outline" size={22} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => { fetchAllUsers(); setModalVisible(true); }}
          >
            <Ionicons name="create-outline" size={22} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Main content ── */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => renderConversationRow(item, false)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubText}>
                Tap the pencil icon to start a new message
              </Text>
            </View>
          }
          ListFooterComponent={
            archivedConversations.length > 0 ? (
              <View style={styles.archivedSection}>
                <TouchableOpacity
                  style={styles.archivedToggle}
                  onPress={() => setShowArchived(!showArchived)}
                >
                  <Ionicons name="archive-outline" size={18} color="#6b7280" />
                  <Text style={styles.archivedToggleText}>
                    Cleared Messages ({archivedConversations.length})
                  </Text>
                  <Ionicons
                    name={showArchived ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#6b7280"
                  />
                </TouchableOpacity>

                {showArchived &&
                  archivedConversations.map((convo) => (
                    <View key={convo.id} style={styles.archivedRow}>
                      {renderConversationRow(convo, true)}
                    </View>
                  ))}
              </View>
            ) : null
          }
        />
      )}

      {/* ══════ BROADCAST MODAL ══════ */}
      <Modal visible={broadcastModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBroadcastModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Broadcast to Group</Text>
            <TouchableOpacity onPress={() => setBroadcastModalVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <Text style={styles.broadcastLabel}>Select Student Group</Text>
            <View style={styles.broadcastGroupGrid}>
              {STUDENT_GROUPS.map((group) => (
                <TouchableOpacity
                  key={group}
                  style={[styles.broadcastGroupChip, broadcastGroup === group && styles.broadcastGroupChipActive]}
                  onPress={() => setBroadcastGroup(group)}
                >
                  <Text style={[styles.broadcastGroupChipText, broadcastGroup === group && styles.broadcastGroupChipTextActive]}>{group}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.broadcastLabel, { marginTop: 16 }]}>Message</Text>
            <TextInput
              style={[styles.searchInput, { height: 100, textAlignVertical: "top", margin: 0 }]}
              placeholder="Type your message to the group..."
              value={broadcastMessage}
              onChangeText={setBroadcastMessage}
              multiline
            />
            <Text style={styles.broadcastNote}>This will send a one-way message to each learner individually. Students cannot reply.</Text>
            <TouchableOpacity style={[styles.createButton, broadcasting && { opacity: 0.6 }]} onPress={handleBroadcast} disabled={broadcasting}>
              <Text style={styles.createButtonText}>{broadcasting ? "Sending..." : "Send Broadcast"}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ══════ NEW DM MODAL ══════ */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Message</Text>
            <TouchableOpacity onPress={() => { setModalVisible(false); setUserSearch(""); }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <TextInput style={styles.searchInput} placeholder="Search by email..." value={userSearch} onChangeText={setUserSearch} autoCapitalize="none" />
          {modalLoading ? (
            <ActivityIndicator style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.userRow} onPress={() => startDirectMessage(item.id)}>
                  <View style={styles.userAvatar}><Ionicons name="person" size={16} color="#fff" /></View>
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

      {/* ══════ GROUP CHAT MODAL ══════ */}
      <Modal visible={groupModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setGroupModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Group Chat</Text>
            <TouchableOpacity onPress={() => { setGroupModalVisible(false); setGroupName(""); setSelectedUsers([]); setUserSearch(""); }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <TextInput style={styles.searchInput} placeholder="Group name..." value={groupName} onChangeText={setGroupName} />
          <TextInput style={styles.searchInput} placeholder="Search users by email..." value={userSearch} onChangeText={setUserSearch} autoCapitalize="none" />
          {selectedUsers.length > 0 && <Text style={styles.sectionLabel}>{selectedUsers.length} selected</Text>}
          {modalLoading ? (
            <ActivityIndicator style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const isSelected = selectedUsers.includes(item.id);
                return (
                  <TouchableOpacity style={[styles.userRow, isSelected && styles.userRowSelected]} onPress={() => toggleUserSelection(item.id)}>
                    <View style={[styles.userAvatar, isSelected && styles.userAvatarSelected]}>
                      <Ionicons name={isSelected ? "checkmark" : "person"} size={16} color="#fff" />
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
            <Text style={styles.createButtonText}>Create Group</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },
  listContent: { paddingBottom: 20 },

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

  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyText: { fontSize: 18, fontWeight: "600", color: "#999", marginTop: 16 },
  emptySubText: { fontSize: 14, color: "#bbb", marginTop: 8, textAlign: "center" },

  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  conversationPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingVertical: 14,
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
  avatarBroadcast: { backgroundColor: "#f59e0b" },
  conversationInfo: { flex: 1 },
  conversationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  conversationName: { fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  timeText: { fontSize: 12, color: "#999" },
  lastMessage: { fontSize: 13, color: "#666" },

  // Archived section
  archivedSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  archivedToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    backgroundColor: "#f9fafb",
  },
  archivedToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  archivedRow: {
    opacity: 0.7,
  },

  // Action buttons on each row
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
    gap: 2,
  },
  archiveBtn: {
    padding: 10,
    borderRadius: 20,
  },
  restoreBtn: {
    padding: 10,
    borderRadius: 20,
  },
  deleteBtn: {
    padding: 10,
    borderRadius: 20,
  },

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

  // Broadcast
  broadcastLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 10 },
  broadcastGroupGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  broadcastGroupChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  broadcastGroupChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  broadcastGroupChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  broadcastGroupChipTextActive: { color: "#fff" },
  broadcastNote: {
    fontSize: 12,
    color: "#92400e",
    backgroundColor: "#fef3c7",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 4,
  },
});