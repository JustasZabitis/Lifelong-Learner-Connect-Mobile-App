import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL } from "../../config";
import { useToast } from "../../components/Toast";

interface Question {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string | null;
  option_d: string | null;
}

interface Competition {
  id: number;
  title: string;
  description: string | null;
  time_limit: number;
  prize_description: string | null;
  points_per_question: number;
  speed_bonus: boolean;
  questions: Question[];
  already_attempted: boolean;
  my_attempt: {
    score: number;
    correct_answers: number;
    total_questions: number;
    time_taken: number;
  } | null;
}

interface LeaderboardEntry {
  rank: number;
  email: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  time_taken: number;
}

interface AnswerRecord {
  question_id: number;
  selected_option: string;
  time_taken: number;
}

type ScreenState = "loading" | "intro" | "playing" | "results" | "leaderboard" | "already_done";

const getToken = async (): Promise<string | null> =>
  Platform.OS === "web"
    ? localStorage.getItem("token")
    : SecureStore.getItemAsync("token");

export default function QuizPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const compId = Number(id);
  const router = useRouter();
  const { showToast } = useToast();

  const [screen, setScreen] = useState<ScreenState>("loading");
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Quiz state
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [totalStartTime, setTotalStartTime] = useState(0);

  // Results
  const [results, setResults] = useState<{
    score: number;
    correct_answers: number;
    total_questions: number;
    time_taken: number;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load competition ──
  const fetchCompetition = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/competitions/${compId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCompetition(data);
        if (data.already_attempted) {
          setResults({
            score: data.my_attempt.score,
            correct_answers: data.my_attempt.correct_answers,
            total_questions: data.my_attempt.total_questions,
            time_taken: data.my_attempt.time_taken,
          });
          setScreen("already_done");
        } else {
          setScreen("intro");
        }
      }
    } catch (err) {
      console.error("Failed to fetch competition:", err);
    }
  }, [compId]);

  useEffect(() => {
    fetchCompetition();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCompetition]);

  // ── Fetch leaderboard ──
  const fetchLeaderboard = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/competitions/${compId}/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setLeaderboard(await res.json());
        setScreen("leaderboard");
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    }
  };

  // ── Start quiz ──
  const startQuiz = () => {
    if (!competition) return;
    setCurrentQ(0);
    setAnswers([]);
    setSelectedOption(null);
    setTimeLeft(competition.time_limit);
    setQuestionStartTime(Date.now());
    setTotalStartTime(Date.now());
    setScreen("playing");

    // Start countdown
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up for this question — auto-advance
          handleNextQuestion(true);
          return competition.time_limit;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Select an option ──
  const selectOption = (option: string) => {
    if (selectedOption) return; // Already picked
    setSelectedOption(option);

    // Auto-advance after brief delay — pass option directly to avoid stale closure
    setTimeout(() => {
      handleNextQuestion(false, option);
    }, 600);
  };

  // ── Next question or submit ──
  const handleNextQuestion = (timedOut: boolean, pickedOption?: string) => {
    if (!competition) return;

    const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);
    const question = competition.questions[currentQ];

    const answer: AnswerRecord = {
      question_id: question.id,
      selected_option: timedOut ? "" : (pickedOption || selectedOption || ""),
      time_taken: timeTaken,
    };

    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (currentQ + 1 >= competition.questions.length) {
      // Quiz complete — submit
      if (timerRef.current) clearInterval(timerRef.current);
      submitQuiz(newAnswers);
    } else {
      // Next question
      setCurrentQ(currentQ + 1);
      setSelectedOption(null);
      setTimeLeft(competition.time_limit);
      setQuestionStartTime(Date.now());
    }
  };

  // ── Submit all answers ──
  const submitQuiz = async (allAnswers: AnswerRecord[]) => {
    if (!competition) return;
    const totalTime = Math.round((Date.now() - totalStartTime) / 1000);

    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/competitions/${compId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answers: allAnswers, time_taken: totalTime }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setScreen("results");
      } else {
        const err = await res.json();
        showToast(err.error, "error", "Submission Failed");
      }
    } catch (err) {
      showToast("Failed to submit quiz. Please try again.", "error", "Error");
    }
  };

  if (!competition && screen === "loading") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  // ── INTRO SCREEN ──
  if (screen === "intro" && competition) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#2563eb" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Quiz</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.introContainer}>
          <View style={styles.introIcon}>
            <Ionicons name="trophy" size={48} color="#f59e0b" />
          </View>

          <Text style={styles.introTitle}>{competition.title}</Text>
          {competition.description && <Text style={styles.introDesc}>{competition.description}</Text>}

          {competition.prize_description && (
            <View style={styles.prizeCard}>
              <Ionicons name="gift" size={20} color="#92400e" />
              <Text style={styles.prizeCardText}>{competition.prize_description}</Text>
            </View>
          )}

          <View style={styles.rulesCard}>
            <Text style={styles.rulesTitle}>Rules</Text>
            <View style={styles.ruleRow}>
              <Ionicons name="help-circle-outline" size={18} color="#6b7280" />
              <Text style={styles.ruleText}>{competition.questions.length} questions</Text>
            </View>
            <View style={styles.ruleRow}>
              <Ionicons name="timer-outline" size={18} color="#6b7280" />
              <Text style={styles.ruleText}>{competition.time_limit} seconds per question</Text>
            </View>
            <View style={styles.ruleRow}>
              <Ionicons name="star-outline" size={18} color="#6b7280" />
              <Text style={styles.ruleText}>{competition.points_per_question} points per correct answer</Text>
            </View>
            {competition.speed_bonus && (
              <View style={styles.ruleRow}>
                <Ionicons name="flash-outline" size={18} color="#6b7280" />
                <Text style={styles.ruleText}>Speed bonus — faster = more points</Text>
              </View>
            )}
            <View style={styles.ruleRow}>
              <Ionicons name="alert-circle-outline" size={18} color="#6b7280" />
              <Text style={styles.ruleText}>One attempt only — no retakes</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.startBtn} onPress={startQuiz}>
            <Ionicons name="play" size={22} color="#fff" />
            <Text style={styles.startBtnText}>Start Quiz</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── PLAYING SCREEN ──
  if (screen === "playing" && competition) {
    const question = competition.questions[currentQ];
    const progress = ((currentQ + 1) / competition.questions.length) * 100;
    const timerColor = timeLeft <= 5 ? "#ef4444" : timeLeft <= 10 ? "#f59e0b" : "#2563eb";
    const options = [
      { letter: "A", text: question.option_a },
      { letter: "B", text: question.option_b },
      ...(question.option_c ? [{ letter: "C", text: question.option_c }] : []),
      ...(question.option_d ? [{ letter: "D", text: question.option_d }] : []),
    ];

    return (
      <SafeAreaView style={styles.safeArea}>
        {/* Progress bar */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>

        {/* Timer + counter */}
        <View style={styles.playHeader}>
          <Text style={styles.questionCounter}>
            {currentQ + 1} / {competition.questions.length}
          </Text>
          <View style={[styles.timerBadge, { backgroundColor: timerColor + "15" }]}>
            <Ionicons name="timer-outline" size={16} color={timerColor} />
            <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}</Text>
          </View>
        </View>

        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{question.question_text}</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {options.map((opt) => {
            const isSelected = selectedOption === opt.letter;
            return (
              <TouchableOpacity
                key={opt.letter}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => selectOption(opt.letter)}
                disabled={!!selectedOption}
                activeOpacity={0.7}
              >
                <View style={[styles.optionLetter, isSelected && styles.optionLetterSelected]}>
                  <Text style={[styles.optionLetterText, isSelected && styles.optionLetterTextSelected]}>
                    {opt.letter}
                  </Text>
                </View>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {opt.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    );
  }

  // ── RESULTS SCREEN ──
  if ((screen === "results" || screen === "already_done") && results) {
    const percentage = results.total_questions > 0
      ? Math.round((results.correct_answers / results.total_questions) * 100)
      : 0;
    const emoji = percentage >= 80 ? "🏆" : percentage >= 50 ? "👏" : "💪";

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.resultsContainer}>
          <Text style={styles.resultsEmoji}>{emoji}</Text>
          <Text style={styles.resultsTitle}>
            {screen === "already_done" ? "Your Result" : "Quiz Complete!"}
          </Text>

          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNumber}>{results.score}</Text>
            <Text style={styles.scoreLabel}>points</Text>
          </View>

          <View style={styles.resultsStats}>
            <View style={styles.resultStatBox}>
              <Text style={styles.resultStatNumber}>
                {results.correct_answers}/{results.total_questions}
              </Text>
              <Text style={styles.resultStatLabel}>Correct</Text>
            </View>
            <View style={styles.resultStatBox}>
              <Text style={styles.resultStatNumber}>{percentage}%</Text>
              <Text style={styles.resultStatLabel}>Accuracy</Text>
            </View>
            <View style={styles.resultStatBox}>
              <Text style={styles.resultStatNumber}>{results.time_taken}s</Text>
              <Text style={styles.resultStatLabel}>Time</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.leaderboardBtn} onPress={fetchLeaderboard}>
            <Ionicons name="podium-outline" size={20} color="#fff" />
            <Text style={styles.leaderboardBtnText}>View Leaderboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backToListBtn} onPress={() => router.back()}>
            <Text style={styles.backToListText}>Back to Competitions</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── LEADERBOARD SCREEN ──
  if (screen === "leaderboard") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => setScreen(results ? "results" : "already_done")} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#2563eb" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Leaderboard</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.lbContainer}>
          {leaderboard.map((entry) => {
            const isTop3 = entry.rank <= 3;
            const medalColors = ["#f59e0b", "#9ca3af", "#cd7f32"];
            return (
              <View key={entry.rank} style={[styles.lbRow, isTop3 && styles.lbRowTop]}>
                <View style={[styles.rankBadge, isTop3 && { backgroundColor: medalColors[entry.rank - 1] + "20" }]}>
                  <Text style={[styles.rankText, isTop3 && { color: medalColors[entry.rank - 1] }]}>
                    {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
                  </Text>
                </View>
                <View style={styles.lbInfo}>
                  <Text style={styles.lbEmail} numberOfLines={1}>{entry.email}</Text>
                  <Text style={styles.lbMeta}>
                    {entry.correct_answers}/{entry.total_questions} correct · {entry.time_taken}s
                  </Text>
                </View>
                <Text style={[styles.lbScore, isTop3 && styles.lbScoreTop]}>{entry.score}</Text>
              </View>
            );
          })}

          {leaderboard.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="podium-outline" size={50} color="#d1d5db" />
              <Text style={styles.emptyText}>No one has played yet</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4f6f8" },

  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  backBtn: { padding: 4 },
  navTitle: { fontSize: 17, fontWeight: "700" },

  // Intro
  introContainer: { padding: 20, alignItems: "center" },
  introIcon: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: "#fef3c7",
    justifyContent: "center", alignItems: "center", marginTop: 20, marginBottom: 16,
  },
  introTitle: { fontSize: 22, fontWeight: "800", color: "#111827", textAlign: "center" },
  introDesc: { fontSize: 14, color: "#6b7280", textAlign: "center", marginTop: 8, marginBottom: 16 },

  prizeCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fef3c7",
    padding: 14, borderRadius: 12, gap: 10, width: "100%", marginBottom: 16,
  },
  prizeCardText: { fontSize: 14, fontWeight: "600", color: "#92400e", flex: 1 },

  rulesCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, width: "100%", marginBottom: 20 },
  rulesTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 12 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  ruleText: { fontSize: 14, color: "#374151" },

  startBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#2563eb", padding: 16, borderRadius: 14, width: "100%", gap: 8,
  },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },

  // Playing
  progressBarBg: { height: 4, backgroundColor: "#e5e7eb" },
  progressBarFill: { height: 4, backgroundColor: "#2563eb", borderRadius: 2 },

  playHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14,
  },
  questionCounter: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  timerBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  timerText: { fontSize: 18, fontWeight: "800" },

  questionContainer: { paddingHorizontal: 20, paddingVertical: 10, minHeight: 100, justifyContent: "center" },
  questionText: { fontSize: 20, fontWeight: "700", color: "#111827", lineHeight: 28 },

  optionsContainer: { paddingHorizontal: 20, paddingTop: 10, gap: 10, flex: 1 },
  optionCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    padding: 16, borderRadius: 14, borderWidth: 2, borderColor: "#e5e7eb", gap: 12,
  },
  optionCardSelected: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  optionLetter: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3f4f6",
    justifyContent: "center", alignItems: "center",
  },
  optionLetterSelected: { backgroundColor: "#2563eb" },
  optionLetterText: { fontSize: 15, fontWeight: "700", color: "#6b7280" },
  optionLetterTextSelected: { color: "#fff" },
  optionText: { fontSize: 15, fontWeight: "500", color: "#374151", flex: 1 },
  optionTextSelected: { color: "#1e40af", fontWeight: "600" },

  // Results
  resultsContainer: { padding: 20, alignItems: "center" },
  resultsEmoji: { fontSize: 60, marginTop: 30 },
  resultsTitle: { fontSize: 24, fontWeight: "800", color: "#111827", marginTop: 12 },
  scoreCircle: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: "#2563eb",
    justifyContent: "center", alignItems: "center", marginTop: 24, marginBottom: 24,
  },
  scoreNumber: { fontSize: 36, fontWeight: "800", color: "#fff" },
  scoreLabel: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: -4 },

  resultsStats: { flexDirection: "row", gap: 16, marginBottom: 30 },
  resultStatBox: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 16,
    alignItems: "center", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  resultStatNumber: { fontSize: 20, fontWeight: "800", color: "#111827" },
  resultStatLabel: { fontSize: 12, color: "#6b7280", marginTop: 4 },

  leaderboardBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#f59e0b", padding: 14, borderRadius: 12, width: "100%", gap: 8,
  },
  leaderboardBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  backToListBtn: { marginTop: 14, padding: 12 },
  backToListText: { color: "#2563eb", fontWeight: "600", fontSize: 15 },

  // Leaderboard
  lbContainer: { padding: 16 },
  lbRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    padding: 14, borderRadius: 12, marginBottom: 8, gap: 12,
  },
  lbRowTop: { borderWidth: 1, borderColor: "#fde68a" },
  rankBadge: { width: 40, alignItems: "center", paddingVertical: 4, borderRadius: 8 },
  rankText: { fontSize: 16, fontWeight: "700", color: "#6b7280" },
  lbInfo: { flex: 1 },
  lbEmail: { fontSize: 14, fontWeight: "600", color: "#111827" },
  lbMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  lbScore: { fontSize: 18, fontWeight: "800", color: "#374151" },
  lbScoreTop: { color: "#f59e0b" },

  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#9ca3af", marginTop: 12 },
});