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
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import AppHeader from "../../components/AppHeader";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";

interface ForumPost {
  id: number;
  title: string;
  content: string;
  tags: string[];
  author_email: string;
  created_by: number;
  reply_count: number;
  upvote_count: number;
  created_at: string;
}

interface ForumReply {
  id: number;
  content: string;
  author_email: string;
  created_by: number;
  created_at: string;
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

const getToken = async () =>
  Platform.OS === "web"
    ? localStorage.getItem("token")
    : await SecureStore.getItemAsync("token");

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const displayName = (email: string) => email?.split("@")[0] ?? "Unknown";

// available tags users can pick from
const AVAILABLE_TAGS = ["General", "Question", "Help", "Announcement", "Off-Topic"];

// colour per tag so they're visually distinct
const TAG_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  General:      { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  Question:     { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  Help:         { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
  Announcement: { bg: "#fdf4ff", text: "#9333ea", border: "#e9d5ff" },
  "Off-Topic":  { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" },
};

const TagPill = ({ tag, small = false }: { tag: string; small?: boolean }) => {
  const colours = TAG_COLOURS[tag] ?? TAG_COLOURS["General"];
  return (
    <View style={[
      styles.tagPill,
      { backgroundColor: colours.bg, borderColor: colours.border },
      small && styles.tagPillSmall,
    ]}>
      <Text style={[styles.tagPillText, { color: colours.text }, small && styles.tagPillTextSmall]}>
        {tag}
      </Text>
    </View>
  );
};

export default function Forum() {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState<number | null>(null);

  // filter state
  const [activeFilter, setActiveFilter] = useState<string>("All");

  // create post state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // detail view state
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    loadUser();
    fetchPosts();
  }, []);

  const loadUser = async () => {
    const token = await getToken();
    if (!token) return;
    const decoded = jwtDecode<TokenPayload>(token);
    setRole(decoded.role);
    setUserId(decoded.id);
  };

  // ── FETCH POSTS (with optional tag filter) ──
  const fetchPosts = async (tag?: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      const url =
        tag && tag !== "All"
          ? `${BASE_URL}/api/forum?tag=${encodeURIComponent(tag)}`
          : `${BASE_URL}/api/forum`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPosts(data);
    } catch (e) {
      console.error("Error fetching posts:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── CHANGE FILTER ──
  const handleFilterChange = (tag: string) => {
    setActiveFilter(tag);
    fetchPosts(tag);
  };

  // ── TOGGLE TAG ON CREATE FORM ──
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // ── OPEN A POST ──
  const openPost = async (post: ForumPost) => {
    setSelectedPost(post);
    setLoadingReplies(true);
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/api/forum/${post.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReplies(data.replies);
    } catch (e) {
      console.error("Error fetching post detail:", e);
    } finally {
      setLoadingReplies(false);
    }
  };

  // ── CREATE POST ──
  const handleCreatePost = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      Platform.OS === "web"
        ? window.alert("Please fill in both title and content.")
        : Alert.alert("Missing fields", "Please fill in both title and content.");
      return;
    }
    setCreating(true);
    const token = await getToken();
    if (!token) return;
    try {
      await fetch(`${BASE_URL}/api/forum`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          tags: selectedTags,
        }),
      });
      setNewTitle("");
      setNewContent("");
      setSelectedTags([]);
      setShowCreateForm(false);
      fetchPosts(activeFilter);
    } catch (e) {
      console.error("Error creating post:", e);
    } finally {
      setCreating(false);
    }
  };

  // ── DELETE POST ──
  const handleDeletePost = async (postId: number) => {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm("Delete this post?")
        : await new Promise<boolean>((resolve) => {
            Alert.alert("Delete Post", "Are you sure?", [
              { text: "Cancel", onPress: () => resolve(false) },
              { text: "Delete", style: "destructive", onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;
    const token = await getToken();
    if (!token) return;
    await fetch(`${BASE_URL}/api/forum/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSelectedPost(null);
    setReplies([]);
    fetchPosts(activeFilter);
  };

  // ── UPVOTE ──
  const handleUpvote = async (postId: number) => {
    const token = await getToken();
    if (!token) return;

    const res = await fetch(`${BASE_URL}/api/forum/${postId}/upvote`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    // update the list immediately without a full refetch
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, upvote_count: data.upvoted ? Number(p.upvote_count) + 1 : Number(p.upvote_count) - 1 }
          : p
      )
    );

    // if the detail view is open, update it there too
    if (selectedPost?.id === postId) {
      setSelectedPost((prev) =>
        prev
          ? { ...prev, upvote_count: data.upvoted ? Number(prev.upvote_count) + 1 : Number(prev.upvote_count) - 1 }
          : prev
      );
    }
  };

  // ── ADD REPLY ──
  const handleAddReply = async () => {
    if (!replyText.trim()) {
      Platform.OS === "web"
        ? window.alert("Reply cannot be empty.")
        : Alert.alert("Empty reply", "Please write something before submitting.");
      return;
    }
    if (!selectedPost) return;
    setSubmittingReply(true);
    const token = await getToken();
    if (!token) return;
    try {
      await fetch(`${BASE_URL}/api/forum/${selectedPost.id}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: replyText }),
      });
      setReplyText("");
      openPost(selectedPost);
      fetchPosts(activeFilter);
    } catch (e) {
      console.error("Error adding reply:", e);
    } finally {
      setSubmittingReply(false);
    }
  };

  // ── DELETE REPLY ──
  const handleDeleteReply = async (replyId: number) => {
    if (!selectedPost) return;
    const confirmed =
      Platform.OS === "web"
        ? window.confirm("Delete this reply?")
        : await new Promise<boolean>((resolve) => {
            Alert.alert("Delete Reply", "Are you sure?", [
              { text: "Cancel", onPress: () => resolve(false) },
              { text: "Delete", style: "destructive", onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;
    const token = await getToken();
    if (!token) return;
    await fetch(
      `${BASE_URL}/api/forum/${selectedPost.id}/replies/${replyId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    openPost(selectedPost);
  };

  // ══════════════════════════════════════════
  // POST DETAIL VIEW
  // ══════════════════════════════════════════
  if (selectedPost) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.detailContainer}>

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setSelectedPost(null); setReplies([]); }}
            >
              <Text style={styles.backBtnText}>← Back to Forum</Text>
            </TouchableOpacity>

            {/* post body */}
            <View style={styles.postDetailCard}>
              <Text style={styles.postDetailTitle}>{selectedPost.title}</Text>

              {/* tags row */}
              {selectedPost.tags?.length > 0 && (
                <View style={styles.tagsRow}>
                  {selectedPost.tags.map((tag) => (
                    <TagPill key={tag} tag={tag} />
                  ))}
                </View>
              )}

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  👤 {displayName(selectedPost.author_email)}
                </Text>
                <Text style={styles.metaText}>
                  🕐 {formatDate(selectedPost.created_at)}
                </Text>
              </View>

              <Text style={styles.postDetailContent}>{selectedPost.content}</Text>

              <View style={styles.postActions}>
                <TouchableOpacity
                  style={styles.upvoteBtn}
                  onPress={() => handleUpvote(selectedPost.id)}
                >
                  <Text style={styles.upvoteBtnText}>
                    👍 {selectedPost.upvote_count}
                  </Text>
                </TouchableOpacity>

                {(userId === selectedPost.created_by || role === "admin" || role === "educator") && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeletePost(selectedPost.id)}
                  >
                    <Text style={styles.deleteBtnText}>Delete Post</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* replies */}
            <Text style={styles.repliesHeader}>
              Replies ({replies.length})
            </Text>

            {loadingReplies ? (
              <ActivityIndicator color="#2563eb" />
            ) : replies.length === 0 ? (
              <Text style={styles.emptyText}>
                No replies yet — be the first to reply!
              </Text>
            ) : (
              replies.map((reply) => (
                <View key={reply.id} style={styles.replyCard}>
                  <View style={styles.replyHeader}>
                    <View style={styles.replyAvatar}>
                      <Text style={styles.replyAvatarText}>
                        {reply.author_email?.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.replyAuthor}>
                        {displayName(reply.author_email)}
                      </Text>
                      <Text style={styles.replyDate}>
                        {formatDate(reply.created_at)}
                      </Text>
                    </View>
                    {(userId === reply.created_by || role === "admin" || role === "educator") && (
                      <TouchableOpacity onPress={() => handleDeleteReply(reply.id)}>
                        <Text style={styles.replyDelete}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.replyContent}>{reply.content}</Text>
                </View>
              ))
            )}

            {/* add reply */}
            <View style={styles.replyInputBox}>
              <Text style={styles.repliesHeader}>Add a Reply</Text>
              <TextInput
                style={styles.replyInput}
                placeholder="Write your reply..."
                placeholderTextColor="#9ca3af"
                value={replyText}
                onChangeText={setReplyText}
                multiline
              />
              <TouchableOpacity
                style={[styles.submitBtn, submittingReply && styles.btnDisabled]}
                onPress={handleAddReply}
                disabled={submittingReply}
              >
                <Text style={styles.submitBtnText}>
                  {submittingReply ? "Posting..." : "Post Reply"}
                </Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════
  // POST LIST VIEW
  // ══════════════════════════════════════════
  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader />
      <View style={styles.container}>

        {/* header row */}
        <View style={styles.headerRow}>
          <Text style={styles.header}>Discussion Forum</Text>
          <TouchableOpacity
            style={styles.newPostBtn}
            onPress={() => setShowCreateForm(!showCreateForm)}
          >
            <Text style={styles.newPostBtnText}>
              {showCreateForm ? "Cancel" : "+ New Post"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* create post form */}
        {showCreateForm && (
          <View style={styles.createCard}>
            <Text style={styles.createTitle}>Create a New Post</Text>

            <TextInput
              style={styles.input}
              placeholder="Post title..."
              placeholderTextColor="#9ca3af"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="What's on your mind?"
              placeholderTextColor="#9ca3af"
              value={newContent}
              onChangeText={setNewContent}
              multiline
            />

            {/* tag selector */}
            <Text style={styles.tagSelectorLabel}>Add Tags</Text>
            <View style={styles.tagSelector}>
              {AVAILABLE_TAGS.map((tag) => {
                const selected = selectedTags.includes(tag);
                const colours = TAG_COLOURS[tag] ?? TAG_COLOURS["General"];
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagOption,
                      {
                        backgroundColor: selected ? colours.bg : "#f9fafb",
                        borderColor: selected ? colours.border : "#e5e7eb",
                      },
                    ]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text
                      style={[
                        styles.tagOptionText,
                        { color: selected ? colours.text : "#9ca3af" },
                      ]}
                    >
                      {selected ? "✓ " : ""}{tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, creating && styles.btnDisabled]}
              onPress={handleCreatePost}
              disabled={creating}
            >
              <Text style={styles.submitBtnText}>
                {creating ? "Posting..." : "Publish Post"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* filter bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterBarContent}
        >
          {["All", ...AVAILABLE_TAGS].map((tag) => {
            const isActive = activeFilter === tag;
            const colours = tag !== "All"
              ? (TAG_COLOURS[tag] ?? TAG_COLOURS["General"])
              : { bg: "#111827", text: "#fff", border: "#111827" };
            return (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? colours.bg : "#f3f4f6",
                    borderColor: isActive ? colours.border : "#e5e7eb",
                  },
                ]}
                onPress={() => handleFilterChange(tag)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isActive ? colours.text : "#6b7280", fontWeight: isActive ? "700" : "500" },
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* post list */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" size="large" />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>No posts yet</Text>
                <Text style={styles.emptySubtitle}>
                  {activeFilter !== "All"
                    ? `No posts tagged "${activeFilter}"`
                    : "Be the first to start a discussion!"}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.postCard}
                onPress={() => openPost(item)}
              >
                <Text style={styles.postTitle}>{item.title}</Text>

                {/* tags on the card */}
                {item.tags?.length > 0 && (
                  <View style={styles.tagsRow}>
                    {item.tags.map((tag) => (
                      <TagPill key={tag} tag={tag} small />
                    ))}
                  </View>
                )}

                <Text style={styles.postPreview} numberOfLines={2}>
                  {item.content}
                </Text>

                <View style={styles.postFooter}>
                  <Text style={styles.postMeta}>
                    👤 {displayName(item.author_email)}
                  </Text>
                  <View style={styles.postStats}>
                    <Text style={styles.statText}>💬 {item.reply_count}</Text>
                    <TouchableOpacity
                      onPress={() => handleUpvote(item.id)}
                      style={styles.upvoteInline}
                    >
                      <Text style={styles.statText}>👍 {item.upvote_count}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.postDate}>{formatDate(item.created_at)}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },
  container: { flex: 1, padding: 16 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  header: { fontSize: 22, fontWeight: "700", color: "#111827" },
  newPostBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newPostBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  // create form
  createCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  createTitle: { fontWeight: "700", fontSize: 15, marginBottom: 10, color: "#111827" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
    marginBottom: 10,
  },
  multilineInput: { minHeight: 100, textAlignVertical: "top" },

  // tag selector in create form
  tagSelectorLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  tagSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  tagOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagOptionText: { fontSize: 12, fontWeight: "600" },

  submitBtn: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.6 },

  // filter bar
  filterBar: { maxHeight: 44, marginBottom: 12 },
  filterBarContent: { flexDirection: "row", gap: 8, paddingHorizontal: 2 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12 },

  // tag pills on cards
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagPillSmall: { paddingHorizontal: 8, paddingVertical: 2 },
  tagPillText: { fontSize: 11, fontWeight: "600" },
  tagPillTextSmall: { fontSize: 10 },

  // post cards
  postCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  postTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 6 },
  postPreview: { fontSize: 13, color: "#6b7280", lineHeight: 18, marginBottom: 10 },
  postFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postMeta: { fontSize: 12, color: "#6b7280" },
  postStats: { flexDirection: "row", gap: 12 },
  statText: { fontSize: 12, color: "#6b7280" },
  upvoteInline: { padding: 2 },
  postDate: { fontSize: 11, color: "#9ca3af", marginTop: 6 },

  // empty state
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151" },
  emptySubtitle: { fontSize: 14, color: "#9ca3af", marginTop: 4, textAlign: "center" },

  // detail view
  detailContainer: { padding: 16, paddingBottom: 40 },
  backBtn: { marginBottom: 14 },
  backBtnText: { color: "#2563eb", fontWeight: "600", fontSize: 14 },

  postDetailCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  postDetailTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 10 },
  metaRow: { flexDirection: "row", gap: 14, marginBottom: 14, flexWrap: "wrap" },
  metaText: { fontSize: 12, color: "#6b7280" },
  postDetailContent: { fontSize: 15, color: "#374151", lineHeight: 22 },
  postActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  upvoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  upvoteBtnText: { color: "#2563eb", fontWeight: "600", fontSize: 14 },
  deleteBtn: {
    backgroundColor: "#fef2f2",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  deleteBtnText: { color: "#ef4444", fontWeight: "600", fontSize: 13 },

  // replies
  repliesHeader: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 },
  emptyText: { color: "#9ca3af", fontSize: 14, textAlign: "center", marginBottom: 20 },
  replyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#2563eb",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  replyHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  replyAvatarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  replyAuthor: { fontWeight: "600", fontSize: 13, color: "#111827" },
  replyDate: { fontSize: 11, color: "#9ca3af" },
  replyDelete: { color: "#ef4444", fontSize: 12, fontWeight: "600" },
  replyContent: { fontSize: 14, color: "#374151", lineHeight: 20 },
  replyInputBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  replyInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 10,
  },
});