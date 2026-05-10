/**
 * Competitions tab — displays and runs quiz, crossword, and word-search competitions.
 * Students can browse active competitions, play them, and see their scores.
 * Educators and admins can create new competitions with questions/words,
 * set a time limit and prize, target a student group or specific course,
 * and delete competitions they no longer want.
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
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";
import { BASE_URL } from "../../config";
import { useToast } from "../../components/Toast";
import { useAccessibility } from "../../contexts/AccessibilityContext";

// Shape of a competition record returned by the API
interface Competition {
  id: number;
  title: string;
  description: string | null;
  type: string;
  student_group: string | null;
  time_limit: number;
  prize_description: string | null;
  points_per_question: number;
  speed_bonus: boolean;
  status: string;
  question_count: number;
  word_count: number;
  attempt_count: number;
  my_score?: number | null;
  my_attempt_id?: number | null;
  created_by_email: string;
}

interface TokenPayload { id: number; email: string; role: string; }
interface QuestionInput { question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; }
interface WordInput { word: string; clue: string; }

type CompType = "quiz" | "crossword" | "wordsearch";

const TYPE_CONFIG: Record<CompType, { label: string; icon: string; color: string }> = {
  quiz: { label: "Quiz", icon: "help-circle", color: "#2563eb" },
  crossword: { label: "Crossword", icon: "grid", color: "#8b5cf6" },
  wordsearch: { label: "Word Search", icon: "search", color: "#10b981" },
};

const STUDENT_GROUPS = ["all", "Ireland-Midlands", "Ireland-SUSI", "SB+", "Middle East", "India", "China"];

const getToken = async (): Promise<string | null> =>
  Platform.OS === "web" ? localStorage.getItem("token") : SecureStore.getItemAsync("token");

export default function CompetitionsScreen() {
  const router = useRouter();
  const { showToast, confirm } = useToast();
  const { colors, speak, t } = useAccessibility();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");

  // Create modal
  const [createModal, setCreateModal] = useState(false);
  const [compType, setCompType] = useState<CompType>("quiz");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "group" | "course">("all");
  const [targetGroup, setTargetGroup] = useState("");
  const [targetProgramme, setTargetProgramme] = useState("");
  const [showCourseSuggestions, setShowCourseSuggestions] = useState(false);
  const [programmeNames, setProgrammeNames] = useState<string[]>([]);
  const [timeLimit, setTimeLimit] = useState("30");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Quiz questions
  const [questions, setQuestions] = useState<QuestionInput[]>([
    { question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A" },
  ]);

  // Word entries (crossword + wordsearch)
  const [words, setWords] = useState<WordInput[]>([
    { word: "", clue: "" },
  ]);

  useEffect(() => {
    const init = async () => {
      const token = await getToken();
      if (!token) return;
      const decoded = jwtDecode<TokenPayload>(token);
      setRole(decoded.role);
    };
    init();
  }, []);

  const isStaff = role === "educator" || role === "admin";

  // fetch programme names for the course targeting autocomplete
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

  const courseSuggestions = programmeNames.filter((p) => targetProgramme && p.toLowerCase().includes(targetProgramme.toLowerCase()));

  const fetchCompetitions = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/competitions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCompetitions(await res.json());
    } catch (err) {
      console.error("Failed to fetch competitions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompetitions(); }, [fetchCompetitions]);

  // ── Question management ──
  const addQuestion = () => setQuestions(p => [...p, { question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A" }]);
  const removeQuestion = (i: number) => { if (questions.length > 1) setQuestions(p => p.filter((_, idx) => idx !== i)); };
  const updateQuestion = (i: number, field: keyof QuestionInput, value: string) => {
    setQuestions(p => { const u = [...p]; u[i] = { ...u[i], [field]: value }; return u; });
  };

  // ── Word management ──
  const addWord = () => setWords(p => [...p, { word: "", clue: "" }]);
  const removeWord = (i: number) => { if (words.length > 1) setWords(p => p.filter((_, idx) => idx !== i)); };
  const updateWord = (i: number, field: keyof WordInput, value: string) => {
    setWords(p => { const u = [...p]; u[i] = { ...u[i], [field]: value }; return u; });
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setTargetMode("all"); setTargetGroup(""); setTargetProgramme(""); setShowCourseSuggestions(false);
    setTimeLimit("30"); setPrizeDescription(""); setCreating(false); setCompType("quiz");
    setQuestions([{ question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A" }]);
    setWords([{ word: "", clue: "" }]);
  };

  // ── Create ──
  const handleCreate = async () => {
    if (!title.trim()) { showToast("Title is required", "error"); return; }

    if (compType === "quiz") {
      const valid = questions.filter(q => q.question_text.trim() && q.option_a.trim() && q.option_b.trim());
      if (valid.length === 0) { showToast("Add at least one complete question", "error"); return; }
    } else {
      const valid = words.filter(w => w.word.trim().length >= 2);
      if (valid.length < 3) { showToast("Add at least 3 words (2+ letters each)", "error"); return; }
      if (compType === "crossword") {
        const noClue = words.filter(w => w.word.trim() && !w.clue.trim());
        if (noClue.length > 0) { showToast("Each crossword word needs a clue", "error"); return; }
      }
    }

    setCreating(true);
    try {
      const token = await getToken();
      const body: any = {
        title, type: compType,
        description: description || null,
        time_limit: parseInt(timeLimit) || (compType === "quiz" ? 30 : 300),
        prize_description: prizeDescription || null,
      };

      // only send the relevant targeting field
      if (targetMode === "group" && targetGroup) body.student_group = targetGroup;
      else if (targetMode === "course" && targetProgramme) body.programme_name = targetProgramme;

      if (compType === "quiz") {
        body.questions = questions.filter(q => q.question_text.trim() && q.option_a.trim() && q.option_b.trim());
      } else {
        body.words = words.filter(w => w.word.trim().length >= 2).map(w => ({
          word: w.word.trim(),
          clue: w.clue.trim() || null,
        }));
      }

      const res = await fetch(`${BASE_URL}/api/competitions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setCreateModal(false); resetForm(); fetchCompetitions();
        showToast("Competition is now live.", "success", "Published!");
      } else {
        const err = await res.json();
        showToast(err.error, "error", "Error");
      }
    } catch (err) {
      showToast("Failed to create competition", "error", "Error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm("Delete this competition?", {
      title: "Delete",
      confirmText: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    const token = await getToken();
    await fetch(`${BASE_URL}/api/competitions/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    fetchCompetitions();
  };

  // ── Navigate to the right player screen based on competition type ──
  const openCompetition = (item: Competition) => {
    if (item.type === "crossword") {
      router.push(`/crossword/${item.id}` as any);
    } else if (item.type === "wordsearch") {
      router.push(`/wordsearch/${item.id}` as any);
    } else {
      router.push(`/quiz/${item.id}` as any);
    }
  };

  // ── Card ──
  const renderCard = ({ item }: { item: Competition }) => {
    const hasAttempted = item.my_attempt_id != null;
    const isActive = item.status === "active";
    const isClosed = item.status === "closed";
    const config = TYPE_CONFIG[item.type as CompType] || TYPE_CONFIG.quiz;
    const itemCount = item.type === "quiz" ? item.question_count : item.word_count;
    const itemLabel = item.type === "quiz" ? "Qs" : "words";

    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => { speak(`${item.title}. ${item.description || ""}. ${itemCount} ${itemLabel}.`); openCompetition(item); }} activeOpacity={0.7}>
        {item.prize_description && (
          <View style={styles.prizeBanner}>
            <Ionicons name="gift-outline" size={14} color="#92400e" />
            <Text style={styles.prizeText} numberOfLines={1}>{item.prize_description}</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.typeRow}>
                <View style={[styles.typeBadge, { backgroundColor: config.color + "15" }]}>
                  <Ionicons name={config.icon as any} size={12} color={config.color} />
                  <Text style={[styles.typeText, { color: config.color }]}>{config.label}</Text>
                </View>
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
              {item.description && <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={2}>{item.description}</Text>}
            </View>
            <View style={[styles.statusBadge, {
              backgroundColor: isActive ? "#dcfce7" : isClosed ? "#fee2e2" : "#f3f4f6",
            }]}>
              <Text style={[styles.statusText, {
                color: isActive ? "#16a34a" : isClosed ? "#dc2626" : "#6b7280",
              }]}>{item.status.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name={config.icon as any} size={14} color="#6b7280" />
              <Text style={styles.metaText}>{itemCount} {itemLabel}</Text>
            </View>
            {item.type === "quiz" && (
              <View style={styles.metaItem}>
                <Ionicons name="timer-outline" size={14} color="#6b7280" />
                <Text style={styles.metaText}>{item.time_limit}s per Q</Text>
              </View>
            )}
            {item.type !== "quiz" && (
              <View style={styles.metaItem}>
                <Ionicons name="timer-outline" size={14} color="#6b7280" />
                <Text style={styles.metaText}>{Math.round(item.time_limit / 60)}min</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={14} color="#6b7280" />
              <Text style={styles.metaText}>{item.attempt_count} {t("competitions_played")}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            {hasAttempted ? (
              <View style={styles.scoreBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.scoreText}>{t("competitions_score")}: {item.my_score}</Text>
              </View>
            ) : isActive ? (
              <View style={[styles.playBadge, { backgroundColor: config.color + "12" }]}>
                <Ionicons name="play-circle" size={16} color={config.color} />
                <Text style={[styles.playText, { color: config.color }]}>{t("competitions_play")} {config.label}</Text>
              </View>
            ) : (
              <Text style={styles.closedText}>{isClosed ? t("competitions_ended") : t("competitions_coming_soon")}</Text>
            )}
            {isStaff && (
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <AppHeader />
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("competitions_title")}</Text>
        {isStaff && (
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={() => { resetForm(); setCreateModal(true); }}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.createBtnText}>{t("competitions_create")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : (
        <FlatList data={competitions} keyExtractor={i => i.id.toString()} renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={60} color="#d1d5db" />
              <Text style={styles.emptyText}>{t("competitions_none")}</Text>
              {isStaff && <Text style={styles.emptySubText}>{t("competitions_create_hint")}</Text>}
            </View>
          }
        />
      )}

      {/* ══════ CREATE MODAL ══════ */}
      <Modal visible={createModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateModal(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t("competitions_create_title")}</Text>
            <TouchableOpacity onPress={() => { setCreateModal(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            {/* Type picker */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Type</Text>
            <View style={styles.typePickerRow}>
              {(["quiz", "crossword", "wordsearch"] as CompType[]).map(t => {
                const c = TYPE_CONFIG[t];
                const active = compType === t;
                return (
                  <TouchableOpacity key={t} style={[styles.typePicker, { backgroundColor: active ? c.color : colors.surfaceAlt, borderColor: active ? c.color : colors.border }]}
                    onPress={() => { setCompType(t); setTimeLimit(t === "quiz" ? "30" : "300"); }}>
                    <Ionicons name={c.icon as any} size={18} color={active ? "#fff" : c.color} />
                    <Text style={[styles.typePickerText, { color: active ? "#fff" : colors.text }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Title *</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="e.g. Week 5 Business Law Challenge" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Description</Text>
            <TextInput style={[styles.input, { height: 60, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="Optional..." placeholderTextColor={colors.textMuted} multiline value={description} onChangeText={setDescription} />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Prize</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="e.g. Winner gets a €50 voucher!" placeholderTextColor={colors.textMuted} value={prizeDescription} onChangeText={setPrizeDescription} />

            {/* Time limit */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{compType === "quiz" ? "Seconds per Question" : "Time Limit (seconds)"}</Text>
            {compType === "quiz" ? (
              <View style={styles.timeRow}>
                {["15", "30", "45", "60"].map(t => (
                  <TouchableOpacity key={t} style={[styles.timeChip, { backgroundColor: timeLimit === t ? "#2563eb" : colors.surfaceAlt, borderColor: timeLimit === t ? "#2563eb" : colors.border }]} onPress={() => setTimeLimit(t)}>
                    <Text style={[styles.timeChipText, { color: timeLimit === t ? "#fff" : colors.text }]}>{t}s</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.timeRow}>
                {["120", "180", "300", "600"].map(t => (
                  <TouchableOpacity key={t} style={[styles.timeChip, { backgroundColor: timeLimit === t ? "#2563eb" : colors.surfaceAlt, borderColor: timeLimit === t ? "#2563eb" : colors.border }]} onPress={() => setTimeLimit(t)}>
                    <Text style={[styles.timeChipText, { color: timeLimit === t ? "#fff" : colors.text }]}>{parseInt(t) / 60}min</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* targeting — mutually exclusive: All, Student Group, or Course */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Visible To</Text>
            <View style={styles.groupScrollContent}>
              <TouchableOpacity style={[styles.groupChip, { backgroundColor: targetMode === "all" ? "#2563eb" : colors.surfaceAlt, borderColor: targetMode === "all" ? "#2563eb" : colors.border }]} onPress={() => { setTargetMode("all"); setTargetGroup(""); setTargetProgramme(""); setShowCourseSuggestions(false); }}>
                <Text style={[styles.groupChipText, { color: targetMode === "all" ? "#fff" : colors.text }]}>Everyone</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.groupChip, { backgroundColor: targetMode === "group" ? "#2563eb" : colors.surfaceAlt, borderColor: targetMode === "group" ? "#2563eb" : colors.border }]} onPress={() => { setTargetMode("group"); setTargetProgramme(""); setShowCourseSuggestions(false); }}>
                <Text style={[styles.groupChipText, { color: targetMode === "group" ? "#fff" : colors.text }]}>Student Group</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.groupChip, { backgroundColor: targetMode === "course" ? "#2563eb" : colors.surfaceAlt, borderColor: targetMode === "course" ? "#2563eb" : colors.border }]} onPress={() => { setTargetMode("course"); setTargetGroup(""); }}>
                <Text style={[styles.groupChipText, { color: targetMode === "course" ? "#fff" : colors.text }]}>Specific Course</Text>
              </TouchableOpacity>
            </View>

            {/* show group picker only when "Student Group" is selected */}
            {targetMode === "group" && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll} contentContainerStyle={styles.groupScrollContent}>
                {STUDENT_GROUPS.filter(g => g !== "all").map(g => (
                  <TouchableOpacity key={g} style={[styles.groupChip, { backgroundColor: targetGroup === g ? "#10b981" : colors.surfaceAlt, borderColor: targetGroup === g ? "#10b981" : colors.border }]} onPress={() => setTargetGroup(g)}>
                    <Text style={[styles.groupChipText, { color: targetGroup === g ? "#fff" : colors.text }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* show course search only when "Specific Course" is selected */}
            {targetMode === "course" && (
              <>
                <TextInput
                  style={[styles.input, { marginTop: 8, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                  placeholder="Search for a course name..."
                  placeholderTextColor={colors.textMuted}
                  value={targetProgramme}
                  onChangeText={(v) => { setTargetProgramme(v); setShowCourseSuggestions(v.length > 0); }}
                  autoCapitalize="none"
                />
                {showCourseSuggestions && courseSuggestions.length > 0 && (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 4, marginBottom: 8 }}>
                    <ScrollView style={{ maxHeight: 120 }}>
                      {courseSuggestions.slice(0, 6).map(p => (
                        <TouchableOpacity key={p} style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => { setTargetProgramme(p); setShowCourseSuggestions(false); }}>
                          <Text style={{ fontSize: 13, color: colors.text }} numberOfLines={1}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            {/* ── QUIZ QUESTIONS ── */}
            {compType === "quiz" && (
              <>
                <View style={styles.itemsHeader}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Questions ({questions.length})</Text>
                  <TouchableOpacity onPress={addQuestion} style={styles.addBtn}>
                    <Ionicons name="add" size={18} color="#2563eb" />
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
                {questions.map((q, i) => (
                  <View key={i} style={[styles.itemCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                    <View style={styles.itemCardHeader}>
                      <Text style={styles.itemNumber}>Q{i + 1}</Text>
                      {questions.length > 1 && (
                        <TouchableOpacity onPress={() => removeQuestion(i)}>
                          <Ionicons name="close-circle" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="Enter your question..." placeholderTextColor={colors.textMuted} value={q.question_text} onChangeText={v => updateQuestion(i, "question_text", v)} multiline />
                    {(["A", "B", "C", "D"] as const).map(letter => {
                      const field = `option_${letter.toLowerCase()}` as keyof QuestionInput;
                      const isCorrect = q.correct_option === letter;
                      return (
                        <View key={letter} style={styles.optionRow}>
                          <TouchableOpacity style={[styles.optionRadio, isCorrect && styles.optionRadioActive, !isCorrect && { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => updateQuestion(i, "correct_option", letter)}>
                            <Text style={[styles.optionRadioText, isCorrect && styles.optionRadioTextActive, !isCorrect && { color: colors.textMuted }]}>{letter}</Text>
                          </TouchableOpacity>
                          <TextInput style={[styles.optionInput, isCorrect && styles.optionInputActive, !isCorrect && { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder={`Option ${letter}${letter <= "B" ? " *" : ""}`} placeholderTextColor={colors.textMuted} value={q[field]} onChangeText={v => updateQuestion(i, field, v)} />
                        </View>
                      );
                    })}
                    <Text style={[styles.hint, { color: colors.textMuted }]}>Tap the letter to mark the correct answer</Text>
                  </View>
                ))}
              </>
            )}

            {/* ── CROSSWORD WORDS ── */}
            {compType === "crossword" && (
              <>
                <View style={styles.itemsHeader}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Words & Clues ({words.length})</Text>
                  <TouchableOpacity onPress={addWord} style={styles.addBtn}>
                    <Ionicons name="add" size={18} color="#8b5cf6" />
                    <Text style={[styles.addBtnText, { color: "#8b5cf6" }]}>Add</Text>
                  </TouchableOpacity>
                </View>
                {words.map((w, i) => (
                  <View key={i} style={[styles.itemCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                    <View style={styles.itemCardHeader}>
                      <Text style={[styles.itemNumber, { color: "#8b5cf6" }]}>#{i + 1}</Text>
                      {words.length > 1 && (
                        <TouchableOpacity onPress={() => removeWord(i)}>
                          <Ionicons name="close-circle" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="Word (e.g. ECONOMICS)" placeholderTextColor={colors.textMuted} value={w.word} onChangeText={v => updateWord(i, "word", v.toUpperCase())} autoCapitalize="characters" />
                    <TextInput style={[styles.input, { marginTop: 8, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="Clue (e.g. The study of production and consumption)" placeholderTextColor={colors.textMuted} value={w.clue} onChangeText={v => updateWord(i, "clue", v)} />
                  </View>
                ))}
                <Text style={[styles.hint, { color: colors.textMuted }]}>Minimum 3 words. The crossword grid is auto-generated.</Text>
              </>
            )}

            {/* ── WORD SEARCH WORDS ── */}
            {compType === "wordsearch" && (
              <>
                <View style={styles.itemsHeader}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Word List ({words.length})</Text>
                  <TouchableOpacity onPress={addWord} style={styles.addBtn}>
                    <Ionicons name="add" size={18} color="#10b981" />
                    <Text style={[styles.addBtnText, { color: "#10b981" }]}>Add</Text>
                  </TouchableOpacity>
                </View>
                {words.map((w, i) => (
                  <View key={i} style={[styles.wordRow]}>
                    <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder={`Word ${i + 1}`} placeholderTextColor={colors.textMuted} value={w.word} onChangeText={v => updateWord(i, "word", v.toUpperCase())} autoCapitalize="characters" />
                    {words.length > 1 && (
                      <TouchableOpacity onPress={() => removeWord(i)} style={{ padding: 8 }}>
                        <Ionicons name="close-circle" size={22} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <Text style={[styles.hint, { color: colors.textMuted }]}>Minimum 3 words. The word search grid is auto-generated.</Text>
              </>
            )}

            {/* Submit */}
            <TouchableOpacity style={[styles.publishBtn, creating && { opacity: 0.6 }]} onPress={handleCreate} disabled={creating}>
              <Ionicons name="rocket-outline" size={20} color="#fff" />
              <Text style={styles.publishBtnText}>{creating ? "Publishing..." : "Publish Competition"}</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },
  listContent: { padding: 12, paddingBottom: 20 },

  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  createBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#2563eb", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  createBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  card: { backgroundColor: "#fff", borderRadius: 16, marginBottom: 12, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  prizeBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#fef3c7", paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  prizeText: { fontSize: 12, fontWeight: "600", color: "#92400e", flex: 1 },
  cardBody: { padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  typeRow: { flexDirection: "row", marginBottom: 4 },
  typeBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4 },
  typeText: { fontSize: 11, fontWeight: "700" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardDesc: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" },
  statusText: { fontSize: 10, fontWeight: "700" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: "#6b7280" },
  actionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#dcfce7", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  scoreText: { fontSize: 13, fontWeight: "700", color: "#16a34a" },
  playBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  playText: { fontSize: 13, fontWeight: "700" },
  closedText: { fontSize: 13, color: "#9ca3af" },
  deleteBtn: { padding: 8 },

  emptyState: { alignItems: "center", paddingTop: 80 },
  emptyText: { fontSize: 17, fontWeight: "600", color: "#9ca3af", marginTop: 16 },
  emptySubText: { fontSize: 13, color: "#d1d5db", marginTop: 8 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { padding: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#fafafa" },

  // Type picker
  typePickerRow: { flexDirection: "row", gap: 8 },
  typePicker: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#ddd", gap: 6, backgroundColor: "#fafafa" },
  typePickerText: { fontSize: 13, fontWeight: "700", color: "#374151" },

  timeRow: { flexDirection: "row", gap: 8 },
  timeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#ddd", alignItems: "center", backgroundColor: "#fafafa" },
  timeChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  timeChipText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  timeChipTextActive: { color: "#fff" },

  groupScroll: { flexGrow: 0, height: 40, marginBottom: 4 },
  groupScrollContent: { flexDirection: "row", gap: 8 },
  groupChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fafafa", flexShrink: 0 },
  groupChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  groupChipText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  groupChipTextActive: { color: "#fff" },

  // Items
  itemsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 4 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addBtnText: { color: "#2563eb", fontWeight: "600", fontSize: 14 },

  itemCard: { backgroundColor: "#f9fafb", borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  itemCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  itemNumber: { fontSize: 14, fontWeight: "700", color: "#2563eb" },

  optionRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  optionRadio: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "#d1d5db", justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  optionRadioActive: { backgroundColor: "#10b981", borderColor: "#10b981" },
  optionRadioText: { fontSize: 13, fontWeight: "700", color: "#9ca3af" },
  optionRadioTextActive: { color: "#fff" },
  optionInput: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: "#fff" },
  optionInputActive: { borderColor: "#10b981", backgroundColor: "#f0fdf4" },
  hint: { fontSize: 11, color: "#9ca3af", marginTop: 8, textAlign: "center" },

  wordRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 4 },

  publishBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#2563eb", padding: 16, borderRadius: 14, marginTop: 20, gap: 8 },
  publishBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});