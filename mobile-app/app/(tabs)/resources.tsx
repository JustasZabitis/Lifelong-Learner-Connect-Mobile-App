/**
 * Resource Hub tab — browse, filter, and download course materials.
 * Educators and admins can upload files (PDFs, Word docs, videos, etc.)
 * and target them at everyone, a specific student group, or a specific course.
 * All users can search by title/filename and filter by student group or course.
 * Tapping a resource triggers a download/open via the device's default handler.
 * Educators can only delete their own uploads; admins can delete any resource.
 */

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
  ScrollView,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";
import { BASE_URL } from "../../config";

// ─── Types ────────────────────────────────────────────────────────────
interface Resource {
  id: number;
  title: string;
  description: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  category: string;
  role_target: string;
  student_group: string | null;
  programme_name: string | null;
  created_by: number;
  created_by_email: string;
  created_at: string;
}

interface TokenPayload { id: number; email: string; role: string; }

// ─── Helpers ──────────────────────────────────────────────────────────
const getToken = async (): Promise<string | null> =>
  Platform.OS === "web" ? localStorage.getItem("token") : SecureStore.getItemAsync("token");

// work out a nice icon based on the file mime type
const getFileIcon = (fileType: string): { name: string; color: string } => {
  if (fileType.includes("pdf")) return { name: "document-text", color: "#ef4444" };
  if (fileType.includes("image")) return { name: "image", color: "#8b5cf6" };
  if (fileType.includes("video")) return { name: "play-circle", color: "#f59e0b" };
  if (fileType.includes("audio")) return { name: "musical-notes", color: "#ec4899" };
  if (fileType.includes("word") || fileType.includes("document")) return { name: "document", color: "#2563eb" };
  if (fileType.includes("spreadsheet") || fileType.includes("excel")) return { name: "grid", color: "#16a34a" };
  if (fileType.includes("presentation") || fileType.includes("powerpoint")) return { name: "easel", color: "#f97316" };
  return { name: "attach", color: "#6b7280" };
};

// convert bytes to something readable
const formatFileSize = (bytes: number): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const CATEGORIES = ["general", "lecture", "assignment", "recording"];

// these match the student_group values in the programmes table
const STUDENT_GROUPS = ["Ireland-Midlands", "Ireland-SUSI", "SB+", "Middle East", "India", "China"];

// the three mutually exclusive targeting modes
type TargetMode = "all" | "group" | "course";

// ─── Component ────────────────────────────────────────────────────────
export default function ResourceHubScreen() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState<number | null>(null);

  // filter state — one active filter at a time
  const [filterMode, setFilterMode] = useState<TargetMode>("all");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterCourseSuggestions, setShowFilterCourseSuggestions] = useState(false);

  // programme names pulled from the DB for autocomplete suggestions
  const [programmeNames, setProgrammeNames] = useState<string[]>([]);

  // upload modal state
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadCategory, setUploadCategory] = useState("general");
  const [uploadTargetMode, setUploadTargetMode] = useState<TargetMode>("all");
  const [uploadGroup, setUploadGroup] = useState("");
  const [uploadProgramme, setUploadProgramme] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showUploadCourseSuggestions, setShowUploadCourseSuggestions] = useState(false);

  const isEducator = role === "educator";
  const isAdmin = role === "admin";

  // grab the user's role from the token on mount
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

  // fetch the list of all programme names for the autocomplete dropdowns
  useEffect(() => {
    const fetchProgrammes = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${BASE_URL}/api/resources/programmes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setProgrammeNames(await res.json());
      } catch (err) {
        console.error("Failed to fetch programmes:", err);
      }
    };
    fetchProgrammes();
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

  useEffect(() => { fetchResources(); }, [fetchResources]);

  // filter resources locally based on which targeting mode is active
  const filteredResources = resources.filter((r) => {
    // text search always applies
    const matchesSearch = searchQuery === "" ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.file_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // then apply the active targeting filter
    if (filterMode === "all") return true;
    if (filterMode === "group") return r.student_group === filterGroup;
    if (filterMode === "course") return r.programme_name && r.programme_name.toLowerCase().includes(filterCourse.toLowerCase());
    return true;
  });

  // autocomplete suggestions filtered by what the user has typed
  const filterCourseSuggestions = programmeNames.filter((p) =>
    filterCourse && p.toLowerCase().includes(filterCourse.toLowerCase())
  );
  const uploadCourseSuggestions = programmeNames.filter((p) =>
    uploadProgramme && p.toLowerCase().includes(uploadProgramme.toLowerCase())
  );

  // open the file in browser
  const handleOpen = async (resource: Resource) => {
    const token = await getToken();
    const url = `${BASE_URL}/api/resources/${resource.id}/download?token=${token}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert("Cannot open this file type on this device");
  };

  // on web we use a hidden file input element
  const handleUpload = async () => {
    if (!uploadTitle.trim()) return Alert.alert("Title is required");
    if (Platform.OS === "web") {
      const input = document.getElementById("file-input") as HTMLInputElement;
      if (input) input.click();
    }
  };

  // runs after the user picks a file on web
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
      formData.append("role_target", "all");

      // only send the relevant targeting field based on what mode was picked
      if (uploadTargetMode === "group" && uploadGroup) {
        formData.append("student_group", uploadGroup);
      } else if (uploadTargetMode === "course" && uploadProgramme) {
        formData.append("programme_name", uploadProgramme);
      }

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
    setUploadTitle(""); setUploadDesc(""); setUploadCategory("general");
    setUploadTargetMode("all"); setUploadGroup(""); setUploadProgramme("");
  };

  // delete with platform-appropriate confirm dialog
  const handleDelete = async (id: number) => {
    const confirmed = Platform.OS === "web"
      ? window.confirm("Are you sure you want to delete this resource?")
      : await new Promise<boolean>((resolve) => {
          Alert.alert("Delete Resource", "Are you sure?", [
            { text: "Cancel", onPress: () => resolve(false) },
            { text: "Delete", style: "destructive", onPress: () => resolve(true) },
          ]);
        });
    if (!confirmed) return;
    const token = await getToken();
    await fetch(`${BASE_URL}/api/resources/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchResources();
  };

  // ── Render each resource card ──
  const renderItem = ({ item }: { item: Resource }) => {
    const icon = getFileIcon(item.file_type);
    const canDelete = (isEducator && item.created_by === userId) || isAdmin;

    return (
      <View style={styles.cardWrapper}>
        <TouchableOpacity style={styles.card} onPress={() => handleOpen(item)} activeOpacity={0.7}>
          <View style={[styles.iconBox, { backgroundColor: icon.color + "15" }]}>
            <Ionicons name={icon.name as any} size={24} color={icon.color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {item.description ? <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text> : null}
            <View style={styles.cardMeta}>
              <View style={[styles.catBadge, { backgroundColor: icon.color + "20" }]}>
                <Text style={[styles.catBadgeText, { color: icon.color }]}>{item.category}</Text>
              </View>
              {/* show what this resource is targeted to */}
              {item.programme_name ? (
                <View style={styles.programmeBadge}>
                  <Ionicons name="school-outline" size={10} color="#8b5cf6" />
                  <Text style={styles.programmeBadgeText} numberOfLines={1}>{item.programme_name}</Text>
                </View>
              ) : item.student_group && item.student_group !== "all" ? (
                <View style={styles.groupBadge}>
                  <Text style={styles.groupBadgeText}>{item.student_group}</Text>
                </View>
              ) : null}
              <Text style={styles.metaText}>{formatFileSize(item.file_size)}</Text>
            </View>
          </View>
          <Ionicons name="download-outline" size={20} color="#2563eb" />
        </TouchableOpacity>

        {/* delete button — only shows for educators who created it or admins */}
        {canDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
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
        {(isEducator || isAdmin) && (
          <TouchableOpacity style={styles.uploadBtn} onPress={() => setUploadModal(true)}>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.uploadBtnText}>Upload</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* search by title/filename */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#999" />
        <TextInput style={styles.searchInput} placeholder="Search resources..." value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="none" />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* filter mode — mutually exclusive: All, a Group, or a Course */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
        {/* "All" chip */}
        <TouchableOpacity
          style={[styles.chip, filterMode === "all" && styles.chipActive]}
          onPress={() => { setFilterMode("all"); setFilterGroup(""); setFilterCourse(""); setShowFilterCourseSuggestions(false); }}
        >
          <Text style={[styles.chipText, filterMode === "all" && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>

        {/* student group chips */}
        {STUDENT_GROUPS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, filterMode === "group" && filterGroup === g && styles.chipActive]}
            onPress={() => { setFilterMode("group"); setFilterGroup(g); setFilterCourse(""); setShowFilterCourseSuggestions(false); }}
          >
            <Text style={[styles.chipText, filterMode === "group" && filterGroup === g && styles.chipTextActive]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* course search — only visible when not already filtered by group */}
      <View style={styles.searchBar}>
        <Ionicons name="school-outline" size={18} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Or filter by course name..."
          value={filterCourse}
          onChangeText={(v) => {
            setFilterCourse(v);
            if (v.length > 0) { setFilterMode("course"); setFilterGroup(""); setShowFilterCourseSuggestions(true); }
            else { setFilterMode("all"); setShowFilterCourseSuggestions(false); }
          }}
          autoCapitalize="none"
        />
        {filterCourse.length > 0 && (
          <TouchableOpacity onPress={() => { setFilterCourse(""); setFilterMode("all"); setShowFilterCourseSuggestions(false); }}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* autocomplete dropdown for course filter */}
      {showFilterCourseSuggestions && filterCourseSuggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          <ScrollView style={{ maxHeight: 150 }}>
            {filterCourseSuggestions.slice(0, 8).map((p) => (
              <TouchableOpacity key={p} style={styles.suggestionRow} onPress={() => { setFilterCourse(p); setShowFilterCourseSuggestions(false); }}>
                <Text style={styles.suggestionText} numberOfLines={1}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* resource list */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
      ) : (
        <FlatList data={filteredResources} keyExtractor={(item) => item.id.toString()} renderItem={renderItem} contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>No resources found</Text>
              {(isEducator || isAdmin) && <Text style={styles.emptySubText}>Tap Upload to add the first resource</Text>}
            </View>
          }
        />
      )}

      {/* hidden file input for web uploads */}
      {Platform.OS === "web" && (
        <input id="file-input" type="file" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelected(file); }} />
      )}

      {/* ══════ UPLOAD MODAL ══════ */}
      <Modal visible={uploadModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setUploadModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload Resource</Text>
            <TouchableOpacity onPress={() => { setUploadModal(false); resetUploadForm(); }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput style={styles.input} placeholder="e.g. Week 3 Lecture Notes" value={uploadTitle} onChangeText={setUploadTitle} />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput style={[styles.input, { height: 60 }]} placeholder="Optional..." multiline value={uploadDesc} onChangeText={setUploadDesc} />

            {/* category picker */}
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.optionRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.optionChip, uploadCategory === c && styles.optionChipActive]} onPress={() => setUploadCategory(c)}>
                  <Text style={[styles.optionChipText, uploadCategory === c && styles.optionChipTextActive]}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* targeting — mutually exclusive: All, Student Group, or Course */}
            <Text style={styles.fieldLabel}>Visible To</Text>
            <View style={styles.optionRow}>
              <TouchableOpacity
                style={[styles.optionChip, uploadTargetMode === "all" && styles.optionChipActive]}
                onPress={() => { setUploadTargetMode("all"); setUploadGroup(""); setUploadProgramme(""); setShowUploadCourseSuggestions(false); }}
              >
                <Text style={[styles.optionChipText, uploadTargetMode === "all" && styles.optionChipTextActive]}>Everyone</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionChip, uploadTargetMode === "group" && styles.optionChipActive]}
                onPress={() => { setUploadTargetMode("group"); setUploadProgramme(""); setShowUploadCourseSuggestions(false); }}
              >
                <Text style={[styles.optionChipText, uploadTargetMode === "group" && styles.optionChipTextActive]}>Student Group</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionChip, uploadTargetMode === "course" && styles.optionChipActive]}
                onPress={() => { setUploadTargetMode("course"); setUploadGroup(""); }}
              >
                <Text style={[styles.optionChipText, uploadTargetMode === "course" && styles.optionChipTextActive]}>Specific Course</Text>
              </TouchableOpacity>
            </View>

            {/* show student group picker only when "Student Group" is selected */}
            {uploadTargetMode === "group" && (
              <View style={[styles.optionRow, { marginTop: 10 }]}>
                {STUDENT_GROUPS.map((g) => (
                  <TouchableOpacity key={g} style={[styles.optionChip, uploadGroup === g && { backgroundColor: "#10b981", borderColor: "#10b981" }]} onPress={() => setUploadGroup(g)}>
                    <Text style={[styles.optionChipText, uploadGroup === g && { color: "#fff" }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* show course search only when "Specific Course" is selected */}
            {uploadTargetMode === "course" && (
              <>
                <TextInput
                  style={[styles.input, { marginTop: 10 }]}
                  placeholder="Search for a course name..."
                  value={uploadProgramme}
                  onChangeText={(v) => { setUploadProgramme(v); setShowUploadCourseSuggestions(v.length > 0); }}
                  autoCapitalize="none"
                />
                {showUploadCourseSuggestions && uploadCourseSuggestions.length > 0 && (
                  <View style={styles.suggestionsBoxModal}>
                    <ScrollView style={{ maxHeight: 120 }}>
                      {uploadCourseSuggestions.slice(0, 6).map((p) => (
                        <TouchableOpacity key={p} style={styles.suggestionRow} onPress={() => { setUploadProgramme(p); setShowUploadCourseSuggestions(false); }}>
                          <Text style={styles.suggestionText} numberOfLines={1}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity style={[styles.submitBtn, uploading && { opacity: 0.6 }]} onPress={handleUpload} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>Choose File & Upload</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },
  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  uploadBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#2563eb", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  uploadBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  searchBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#eee", gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },

  suggestionsBox: { marginHorizontal: 12, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", marginTop: 2 },
  suggestionsBoxModal: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", marginTop: 4, marginBottom: 8 },
  suggestionRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  suggestionText: { fontSize: 13, color: "#374151" },

  chipScroll: { flexGrow: 0, maxHeight: 48, marginTop: 8 },
  chipRow: { flexDirection: "row", paddingHorizontal: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb" },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  chipTextActive: { color: "#fff" },

  listContent: { padding: 12, paddingBottom: 20 },
  cardWrapper: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  card: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 14, borderRadius: 14, gap: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  cardDesc: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  cardMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  catBadgeText: { fontSize: 10, fontWeight: "600" },
  groupBadge: { backgroundColor: "#eff6ff", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  groupBadgeText: { fontSize: 10, fontWeight: "600", color: "#2563eb" },
  programmeBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#f5f3ff", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, gap: 3, maxWidth: 180 },
  programmeBadgeText: { fontSize: 10, color: "#8b5cf6", fontWeight: "500" },
  metaText: { fontSize: 11, color: "#9ca3af" },
  deleteBtn: { padding: 10 },

  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#9ca3af", marginTop: 12 },
  emptySubText: { fontSize: 13, color: "#d1d5db", marginTop: 6 },

  // upload modal
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { padding: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#fafafa" },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fafafa" },
  optionChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  optionChipText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  optionChipTextActive: { color: "#fff" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#2563eb", padding: 16, borderRadius: 14, marginTop: 24, gap: 8 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});