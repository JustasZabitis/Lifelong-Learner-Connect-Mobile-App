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
  ActivityIndicator,
  Linking,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";

// types for what comes back from the API
interface Resource {
  id: number;
  title: string;
  description: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  category: string;
  role_target: string;
  created_by: number;
  created_by_email: string;
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

const getToken = async (): Promise<string | null> =>
  Platform.OS === "web"
    ? localStorage.getItem("token")
    : SecureStore.getItemAsync("token");

// work out a nice icon based on the file mime type
const getFileIcon = (fileType: string): { name: string; color: string } => {
  if (fileType.includes("pdf"))
    return { name: "document-text", color: "#ef4444" };
  if (fileType.includes("image"))
    return { name: "image", color: "#8b5cf6" };
  if (fileType.includes("video"))
    return { name: "play-circle", color: "#f59e0b" };
  if (fileType.includes("audio"))
    return { name: "musical-notes", color: "#ec4899" };
  if (fileType.includes("word") || fileType.includes("document"))
    return { name: "document", color: "#2563eb" };
  if (fileType.includes("spreadsheet") || fileType.includes("excel"))
    return { name: "grid", color: "#16a34a" };
  if (fileType.includes("presentation") || fileType.includes("powerpoint"))
    return { name: "easel", color: "#f97316" };
  return { name: "attach", color: "#6b7280" };
};

// convert bytes to a readable size string
const formatFileSize = (bytes: number): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const CATEGORIES = ["general", "lecture", "assignment", "recording"];
const TARGETS = ["all", "working", "returning", "parttime"];

export default function ResourceHubScreen() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState<number | null>(null);

  // filter state
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // upload modal state
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadCategory, setUploadCategory] = useState("general");
  const [uploadTarget, setUploadTarget] = useState("all");
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // load user from token on mount
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

  // pull all resources from the API
  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/resources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setResources(await res.json());
    } catch (err) {
      console.error("Failed to fetch resources:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // filter resources by category chip and search text
  const filteredResources = resources.filter((r) => {
    const matchesCategory =
      activeCategory === "all" || r.category === activeCategory;
    const matchesSearch =
      searchQuery === "" ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // open the file in browser — just hits the download endpoint
  const handleOpen = async (resource: Resource) => {
    const token = await getToken();
    const url = `${BASE_URL}/api/resources/${resource.id}/download?token=${token}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Cannot open this file type on this device");
    }
  };

  // upload — on web we use a file picker via an input element
  // on mobile this sends a URL-based resource instead
  const handleUpload = async () => {
    if (!uploadTitle.trim()) return Alert.alert("Title is required");
    if (Platform.OS === "web") {
      // on web trigger the hidden file input
      const input = document.getElementById("file-input") as HTMLInputElement;
      if (input) input.click();
    }
  };

  // this runs after the user picks a file on web
  const handleFileSelected = async (file: File) => {
    if (!uploadTitle.trim()) return Alert.alert("Title is required");
    setUploading(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", uploadTitle);
      formData.append("description", uploadDesc);
      formData.append("category", uploadCategory);
      formData.append("role_target", uploadTarget);

      const res = await fetch(`${BASE_URL}/api/resources`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        setUploadModal(false);
        resetUploadForm();
        fetchResources();
      } else {
        const err = await res.json();
        Alert.alert("Upload failed", err.error);
      }
    } catch {
      Alert.alert("Error", "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadTitle("");
    setUploadDesc("");
    setUploadCategory("general");
    setUploadTarget("all");
    setUploadUrl("");
  };

  // delete a resource — Alert.alert doesn't work on web so we use window.confirm there
  const handleDelete = async (id: number) => {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm("Are you sure you want to delete this resource?")
        : await new Promise<boolean>((resolve) => {
            Alert.alert("Delete Resource", "Are you sure?", [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Delete", style: "destructive", onPress: () => resolve(true) },
            ]);
          });

    if (!confirmed) return;

    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api/resources/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchResources();
  };

  const isEducator = role === "educator";
  const isAdmin = role === "admin";

  // render each resource card
  const renderItem = ({ item }: { item: Resource }) => {
    const icon = getFileIcon(item.file_type);
    const canDelete = isAdmin || (isEducator && item.created_by === userId);

    return (
      <View style={styles.card}>
        {/* the left/main area opens the file */}
        <TouchableOpacity
          style={styles.cardPressable}
          onPress={() => handleOpen(item)}
        >
          <View style={[styles.iconBox, { backgroundColor: icon.color + "20" }]}>
            <Ionicons name={icon.name as any} size={28} color={icon.color} />
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.cardMeta}>
              <View style={[styles.catBadge, { backgroundColor: icon.color + "20" }]}>
                <Text style={[styles.catBadgeText, { color: icon.color }]}>
                  {item.category}
                </Text>
              </View>
              <Text style={styles.metaText}>
                {formatFileSize(item.file_size)}
              </Text>
              <Text style={styles.metaText}>· {item.created_by_email}</Text>
            </View>
          </View>

          <Ionicons name="download-outline" size={20} color="#2563eb" />
        </TouchableOpacity>

        {/* delete sits completely outside the open press area */}
        {canDelete && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader />

      {/* header bar with title and upload button */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Resource Hub</Text>
        {isEducator && (
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => setUploadModal(true)}
          >
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.uploadBtnText}>Upload</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search resources..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* category filter chips */}
      <View style={styles.chipRow}>
        {["all", ...CATEGORIES].map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, activeCategory === cat && styles.chipActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text
              style={[
                styles.chipText,
                activeCategory === cat && styles.chipTextActive,
              ]}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* resource list */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
      ) : (
        <FlatList
          data={filteredResources}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>No resources found</Text>
              {isEducator && (
                <Text style={styles.emptySubText}>
                  Tap Upload to add the first resource
                </Text>
              )}
            </View>
          }
        />
      )}

      {/* hidden file input for web uploads */}
      {Platform.OS === "web" && (
        <input
          id="file-input"
          type="file"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
          }}
        />
      )}

      {/* upload modal - educators only */}
      <Modal
        visible={uploadModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUploadModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload Resource</Text>
            <TouchableOpacity
              onPress={() => {
                setUploadModal(false);
                resetUploadForm();
              }}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Week 3 Lecture Notes"
              value={uploadTitle}
              onChangeText={setUploadTitle}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              placeholder="Optional short description..."
              multiline
              value={uploadDesc}
              onChangeText={setUploadDesc}
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chip,
                    uploadCategory === cat && styles.chipActive,
                  ]}
                  onPress={() => setUploadCategory(cat)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      uploadCategory === cat && styles.chipTextActive,
                    ]}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Visible to</Text>
            <View style={styles.chipRow}>
              {TARGETS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.chip,
                    uploadTarget === t && styles.chipActive,
                  ]}
                  onPress={() => setUploadTarget(t)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      uploadTarget === t && styles.chipTextActive,
                    ]}
                  >
                    {t === "all" ? "Everyone" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, uploading && { opacity: 0.6 }]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>Choose File & Upload</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

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
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  uploadBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 13, color: "#555", fontWeight: "500" },
  chipTextActive: { color: "#fff" },

  listContent: { padding: 12, paddingTop: 4 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    overflow: "hidden",
  },
  cardPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  cardDesc: { fontSize: 13, color: "#777", marginBottom: 4 },
  cardMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  catBadgeText: { fontSize: 11, fontWeight: "600" },
  metaText: { fontSize: 11, color: "#999" },
  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: "#f0f0f0",
  },

  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyText: { fontSize: 17, fontWeight: "600", color: "#999", marginTop: 16 },
  emptySubText: { fontSize: 13, color: "#bbb", marginTop: 8, textAlign: "center" },

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
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#fafafa",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});