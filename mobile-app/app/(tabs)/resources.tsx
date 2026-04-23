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
  ActivityIndicator,
  Linking,
  ScrollView,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";
import { useToast } from "../../components/Toast";
import { BASE_URL } from "../../config";
import { useAccessibility } from "../../contexts/AccessibilityContext";

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
  const { showToast, confirm } = useToast();
  const { colors, t } = useAccessibility();
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
    else showToast("Cannot open this file type on this device", "error");
  };

  // on web we use a hidden file input element
  const handleUpload = async () => {
    if (!uploadTitle.trim()) {
      showToast("Title is required", "warning");
      return;
    }
    if (Platform.OS === "web") {
      const input = document.getElementById("file-input") as HTMLInputElement;
      if (input) input.click();
    }
  };

  // runs after the user picks a file on web
  const handleFileSelected = async (file: File) => {
    if (!uploadTitle.trim()) {
      showToast("Title is required", "warning");
      return;
    }
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
        showToast("Resource uploaded successfully", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Upload failed", "error", "Upload failed");
      }
    } catch {
      showToast("Upload failed", "error", "Error");
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
    const confirmed = await confirm("Are you sure you want to delete this resource?", {
      title: "Delete Resource",
      confirmText: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    const token = await getToken();
    await fetch(`${BASE_URL}/api/resources/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchResources();
    showToast("Resource deleted", "success");
  };

  // ── Render each resource card ──
  const renderItem = ({ item }: { item: Resource }) => {
    const icon = getFileIcon(item.file_type);
    const canDelete = (isEducator && item.created_by === userId) || isAdmin;

    return (
      <View style={styles.cardWrapper}>
        <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => handleOpen(item)} activeOpacity={0.7}>
          <View style={[styles.iconBox, { backgroundColor: icon.color + "15" }]}>
            <Ionicons name={icon.name as any} size={24} color={icon.color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
            {item.description ? <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={1}>{item.description}</Text> : null}
            <View style={styles.cardMeta}>
              <View style={[styles.catBadge, { backgroundColor: icon.color + "20" }]}>
                <Text style={[styles.catBadgeText, { color: icon.color }]}>{item.category}</Text>
              </View>
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
              <Text style={[styles.metaText, { color: colors.textMuted }]}>{formatFileSize(item.file_size)}</Text>
            </View>
          </View>
          <Ionicons name="download-outline" size={20} color={colors.primary} />
        </TouchableOpacity>

        {canDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <AppHeader />

      {/* header bar */}
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("resources_title")}</Text>
        {(isEducator || isAdmin) && (
          <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: colors.primary }]} onPress={() => setUploadModal(true)}>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.uploadBtnText}>{t("resources_upload")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* search by title/filename */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t("resources_search")}
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, filterMode === "all" && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => { setFilterMode("all"); setFilterGroup(""); setFilterCourse(""); setShowFilterCourseSuggestions(false); }}
        >
          <Text style={[styles.chipText, { color: colors.textMuted }, filterMode === "all" && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>

        {STUDENT_GROUPS.map((g) => {
          const isActive = filterMode === "group" && filterGroup === g;
          return (
            <TouchableOpacity
              key={g}
              style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, isActive && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => { setFilterMode("group"); setFilterGroup(g); setFilterCourse(""); setShowFilterCourseSuggestions(false); }}
            >
              <Text style={[styles.chipText, { color: colors.textMuted }, isActive && styles.chipTextActive]}>{g}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* course filter */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="school-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Or filter by course name..."
          placeholderTextColor={colors.textMuted}
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
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {showFilterCourseSuggestions && filterCourseSuggestions.length > 0 && (
        <View style={[styles.suggestionsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView style={{ maxHeight: 150 }}>
            {filterCourseSuggestions.slice(0, 8).map((p) => (
              <TouchableOpacity key={p} style={[styles.suggestionRow, { borderBottomColor: colors.border }]} onPress={() => { setFilterCourse(p); setShowFilterCourseSuggestions(false); }}>
                <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={1}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={filteredResources}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={60} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t("resources_no_resources")}</Text>
              {(isEducator || isAdmin) && <Text style={[styles.emptySubText, { color: colors.textMuted }]}>{t("resources_upload_hint")}</Text>}
            </View>
          }
        />
      )}

      {Platform.OS === "web" && (
        <input id="file-input" type="file" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelected(file); }} />
      )}

      {/* ══════ UPLOAD MODAL ══════ */}
      <Modal visible={uploadModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setUploadModal(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t("resources_upload_title")}</Text>
            <TouchableOpacity onPress={() => { setUploadModal(false); resetUploadForm(); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="e.g. Week 3 Lecture Notes"
              placeholderTextColor={colors.textMuted}
              value={uploadTitle}
              onChangeText={setUploadTitle}
            />

            <Text style={[styles.fieldLabel, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[styles.input, { height: 60, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Optional..."
              placeholderTextColor={colors.textMuted}
              multiline
              value={uploadDesc}
              onChangeText={setUploadDesc}
            />

            <Text style={[styles.fieldLabel, { color: colors.text }]}>Category</Text>
            <View style={styles.optionRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.optionChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, uploadCategory === c && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setUploadCategory(c)}
                >
                  <Text style={[styles.optionChipText, { color: colors.text }, uploadCategory === c && styles.optionChipTextActive]}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.text }]}>Visible To</Text>
            <View style={styles.optionRow}>
              {(["all", "group", "course"] as TargetMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.optionChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, uploadTargetMode === mode && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => {
                    setUploadTargetMode(mode);
                    if (mode !== "group") setUploadGroup("");
                    if (mode !== "course") { setUploadProgramme(""); setShowUploadCourseSuggestions(false); }
                  }}
                >
                  <Text style={[styles.optionChipText, { color: colors.text }, uploadTargetMode === mode && styles.optionChipTextActive]}>
                    {mode === "all" ? "Everyone" : mode === "group" ? "Student Group" : "Specific Course"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {uploadTargetMode === "group" && (
              <View style={[styles.optionRow, { marginTop: 10 }]}>
                {STUDENT_GROUPS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.optionChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, uploadGroup === g && { backgroundColor: "#10b981", borderColor: "#10b981" }]}
                    onPress={() => setUploadGroup(g)}
                  >
                    <Text style={[styles.optionChipText, { color: colors.text }, uploadGroup === g && { color: "#fff" }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {uploadTargetMode === "course" && (
              <>
                <TextInput
                  style={[styles.input, { marginTop: 10, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                  placeholder="Search for a course name..."
                  placeholderTextColor={colors.textMuted}
                  value={uploadProgramme}
                  onChangeText={(v) => { setUploadProgramme(v); setShowUploadCourseSuggestions(v.length > 0); }}
                  autoCapitalize="none"
                />
                {showUploadCourseSuggestions && uploadCourseSuggestions.length > 0 && (
                  <View style={[styles.suggestionsBoxModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ScrollView style={{ maxHeight: 120 }}>
                      {uploadCourseSuggestions.slice(0, 6).map((p) => (
                        <TouchableOpacity key={p} style={[styles.suggestionRow, { borderBottomColor: colors.border }]} onPress={() => { setUploadProgramme(p); setShowUploadCourseSuggestions(false); }}>
                          <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={1}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }, uploading && { opacity: 0.6 }]} onPress={handleUpload} disabled={uploading}>
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
  safeArea: { flex: 1 },
  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  uploadBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  uploadBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  searchBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },

  suggestionsBox: { marginHorizontal: 12, borderRadius: 10, borderWidth: 1, marginTop: 2 },
  suggestionsBoxModal: { borderRadius: 10, borderWidth: 1, marginTop: 4, marginBottom: 8 },
  suggestionRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  suggestionText: { fontSize: 13 },

  chipScroll: { flexGrow: 0, maxHeight: 48, marginTop: 8 },
  chipRow: { flexDirection: "row", paddingHorizontal: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipActive: { },
  chipText: { fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  listContent: { padding: 12, paddingBottom: 20 },
  cardWrapper: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  card: { flex: 1, flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, gap: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "600" },
  cardDesc: { fontSize: 12, marginTop: 2 },
  cardMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  catBadgeText: { fontSize: 10, fontWeight: "600" },
  groupBadge: { backgroundColor: "#eff6ff", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  groupBadgeText: { fontSize: 10, fontWeight: "600", color: "#2563eb" },
  programmeBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#f5f3ff", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, gap: 3, maxWidth: 180 },
  programmeBadgeText: { fontSize: 10, color: "#8b5cf6", fontWeight: "500" },
  metaText: { fontSize: 11 },
  deleteBtn: { padding: 10 },

  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptySubText: { fontSize: 13, marginTop: 6 },

  // upload modal
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { padding: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  optionChipActive: { },
  optionChipText: { fontSize: 12, fontWeight: "600" },
  optionChipTextActive: { color: "#fff" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 14, marginTop: 24, gap: 8 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});