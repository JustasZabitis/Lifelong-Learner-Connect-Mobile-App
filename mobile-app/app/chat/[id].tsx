import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";

// ─── Types ───────────────────────────────────────────────────────────────
interface Message {
  id: number;
  content: string;
  sender_id: number;
  sender_email: string;
  created_at: string;
}

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

// ─── Config ───────────────────────────────────────────────────────────────
import { BASE_URL } from "../../config";

const getToken = async (): Promise<string | null> =>
  Platform.OS === "web"
    ? localStorage.getItem("token")
    : SecureStore.getItemAsync("token");

const formatMessageTime = (dateStr: string): string =>
  new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

// ─── Component ────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [myEmail, setMyEmail] = useState("");
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load user info from token ──
  useEffect(() => {
    const init = async () => {
      const token = await getToken();
      if (!token) return;
      const decoded = jwtDecode<TokenPayload>(token);
      setMyUserId(decoded.id);
      setMyEmail(decoded.email);
    };
    init();
  }, []);

  // ── Fetch message history from REST API ──
  const fetchMessages = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(
        `${BASE_URL}/api/messages/conversations/${conversationId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (res.ok) setMessages(data);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ── Connect Socket.io and join the conversation room ──
  useEffect(() => {
    let socket: Socket;

    const connectSocket = async () => {
      const token = await getToken();
      if (!token) return;

      // Connect to the server, passing the JWT token for auth
      socket = io(BASE_URL, {
        auth: { token },
        transports: ["websocket"],
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("Socket connected");
        // Tell the server we want to receive messages for this conversation
        socket.emit("join_conversation", conversationId);
      });

      // ── Receive a new message in real time ──
      socket.on("receive_message", (message: Message) => {
        setMessages((prev) => [...prev, message]);
        // Scroll to the bottom when a new message arrives
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      });

      // ── Typing indicators ──
      socket.on("user_typing", ({ email }: { email: string }) => {
        setTypingUser(email);
      });

      socket.on("user_stop_typing", () => {
        setTypingUser(null);
      });

      socket.on("connect_error", (err) => {
        console.error("Socket connection error:", err.message);
      });
    };

    connectSocket();

    // ── Cleanup: leave the room and disconnect when navigating away ──
    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave_conversation", conversationId);
        socketRef.current.disconnect();
      }
    };
  }, [conversationId]);

  // ── Send a message ──
  const sendMessage = () => {
    const content = inputText.trim();
    if (!content || !socketRef.current) return;

    // Emit the message via Socket.io (server saves it + broadcasts it)
    socketRef.current.emit("send_message", {
      conversation_id: conversationId,
      content,
    });

    setInputText("");

    // Stop the typing indicator
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current.emit("stop_typing", conversationId);
  };

  // ── Typing indicator: emit while user is typing ──
  const handleTyping = (text: string) => {
    setInputText(text);

    if (!socketRef.current) return;

    socketRef.current.emit("typing", conversationId);

    // Stop after 2 seconds of no typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("stop_typing", conversationId);
    }, 2000);
  };

  // ── Scroll to bottom when messages first load ──
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [loading]);

  // ── Render a single message bubble ──
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === myUserId;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showSenderLabel =
      !isMe && (!prevMessage || prevMessage.sender_id !== item.sender_id);

    return (
      <View style={[styles.messageWrapper, isMe ? styles.myWrapper : styles.theirWrapper]}>
        {/* Show sender email above their first consecutive message */}
        {showSenderLabel && (
          <Text style={styles.senderLabel}>{item.sender_email}</Text>
        )}

        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.messageText, isMe && styles.myMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
            {formatMessageTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Top nav bar ── */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#2563eb" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Chat</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {/* ── Messages list ── */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No messages yet. Say hello! 👋</Text>
              </View>
            }
          />
        )}

        {/* ── Typing indicator ── */}
        {typingUser && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>{typingUser} is typing...</Text>
          </View>
        )}

        {/* ── Input bar ── */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={inputText}
            onChangeText={handleTyping}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },
  flex: { flex: 1 },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: { padding: 4 },
  navTitle: { fontSize: 17, fontWeight: "700" },

  messageList: { padding: 16, paddingBottom: 8 },

  messageWrapper: { marginBottom: 6, maxWidth: "80%" },
  myWrapper: { alignSelf: "flex-end", alignItems: "flex-end" },
  theirWrapper: { alignSelf: "flex-start", alignItems: "flex-start" },

  senderLabel: {
    fontSize: 11,
    color: "#888",
    marginBottom: 2,
    marginLeft: 4,
  },

  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  messageText: { fontSize: 15, color: "#1a1a1a", lineHeight: 21 },
  myMessageText: { color: "#fff" },

  messageTime: { fontSize: 10, color: "#999", marginTop: 4, alignSelf: "flex-end" },
  myMessageTime: { color: "rgba(255,255,255,0.7)" },

  typingIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: "#f4f6f8",
  },
  typingText: { fontSize: 12, color: "#888", fontStyle: "italic" },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    backgroundColor: "#f9f9f9",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: { backgroundColor: "#93c5fd" },

  emptyState: { flex: 1, alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#aaa", fontSize: 15 },
});