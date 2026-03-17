import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, ScrollView, Alert, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL } from "../../config";

interface WordEntry { id: number; word: string; clue: string | null; }
interface Competition { id: number; title: string; description: string | null; time_limit: number; prize_description: string | null; words: WordEntry[]; already_attempted: boolean; my_attempt: any; }

type Direction = [number, number];
const DIRS: Direction[] = [[0,1],[1,0],[1,1],[0,-1],[-1,0],[-1,-1],[1,-1],[-1,1]];
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const getToken = async (): Promise<string | null> =>
  Platform.OS === "web" ? localStorage.getItem("token") : SecureStore.getItemAsync("token");

// ── Generate word search grid ──
function generateGrid(words: string[], size: number): { grid: string[][]; placements: Map<string, number[][]> } {
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(""));
  const placements = new Map<string, number[][]>();

  const sorted = [...words].sort((a, b) => b.length - a.length);

  for (const word of sorted) {
    let placed = false;
    for (let attempt = 0; attempt < 100 && !placed; attempt++) {
      const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
      const maxR = size - (dir[0] > 0 ? word.length : dir[0] < 0 ? 0 : 0);
      const minR = dir[0] < 0 ? word.length - 1 : 0;
      const maxC = size - (dir[1] > 0 ? word.length : dir[1] < 0 ? 0 : 0);
      const minC = dir[1] < 0 ? word.length - 1 : 0;

      if (maxR < minR || maxC < minC) continue;

      const startR = minR + Math.floor(Math.random() * (maxR - minR + 1));
      const startC = minC + Math.floor(Math.random() * (maxC - minC + 1));

      let canPlace = true;
      const cells: number[][] = [];
      for (let i = 0; i < word.length; i++) {
        const r = startR + dir[0] * i;
        const c = startC + dir[1] * i;
        if (r < 0 || r >= size || c < 0 || c >= size) { canPlace = false; break; }
        if (grid[r][c] !== "" && grid[r][c] !== word[i]) { canPlace = false; break; }
        cells.push([r, c]);
      }

      if (canPlace) {
        for (let i = 0; i < word.length; i++) {
          grid[cells[i][0]][cells[i][1]] = word[i];
        }
        placements.set(word, cells);
        placed = true;
      }
    }
  }

  // Fill empty cells
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!grid[r][c]) grid[r][c] = ALPHA[Math.floor(Math.random() * 26)];
    }
  }

  return { grid, placements };
}

type Screen = "loading" | "intro" | "playing" | "results" | "already_done";

export default function WordSearchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const compId = Number(id);
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("loading");
  const [comp, setComp] = useState<Competition | null>(null);
  const [grid, setGrid] = useState<string[][]>([]);
  const [placements, setPlacements] = useState<Map<string, number[][]>>(new Map());
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [highlightedCells, setHighlightedCells] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [results, setResults] = useState<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Selecting cells ──
  const [selectStart, setSelectStart] = useState<number[] | null>(null);

  const fetchComp = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api/competitions/${compId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setComp(data);
      if (data.already_attempted) {
        setResults({ score: data.my_attempt.score, correct_answers: data.my_attempt.correct_answers, total_questions: data.my_attempt.total_questions, time_taken: data.my_attempt.time_taken });
        setScreen("already_done");
      } else {
        setScreen("intro");
      }
    }
  }, [compId]);

  useEffect(() => { fetchComp(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [fetchComp]);

  const startGame = () => {
    if (!comp) return;
    const wordList = comp.words.map(w => w.word.toUpperCase());
    const maxLen = Math.max(...wordList.map(w => w.length));
    const gridSize = Math.max(10, maxLen + 2, Math.ceil(Math.sqrt(wordList.join("").length * 2)));
    const { grid: g, placements: p } = generateGrid(wordList, gridSize);
    setGrid(g);
    setPlacements(p);
    setFoundWords(new Set());
    setSelectedCells(new Set());
    setHighlightedCells(new Set());
    setTimeLeft(comp.time_limit);
    setStartTime(Date.now());
    setScreen("playing");

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          submitGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Cell tap ──
  const handleCellTap = (r: number, c: number) => {
    if (!selectStart) {
      setSelectStart([r, c]);
      setSelectedCells(new Set([`${r},${c}`]));
    } else {
      // Second tap — check if a line between start and this cell matches a word
      const [sr, sc] = selectStart;
      const dr = Math.sign(r - sr);
      const dc = Math.sign(c - sc);
      const dist = Math.max(Math.abs(r - sr), Math.abs(c - sc));

      // Must be a straight line
      if ((r === sr || c === sc || Math.abs(r - sr) === Math.abs(c - sc)) && dist > 0) {
        let letters = "";
        const cells: string[] = [];
        for (let i = 0; i <= dist; i++) {
          const cr = sr + dr * i;
          const cc = sc + dc * i;
          letters += grid[cr][cc];
          cells.push(`${cr},${cc}`);
        }

        // Check forward and reverse
        const reversed = letters.split("").reverse().join("");
        let matchedWord: string | null = null;

        for (const [word] of placements) {
          if (!foundWords.has(word) && (word === letters || word === reversed)) {
            matchedWord = word;
            break;
          }
        }

        if (matchedWord) {
          const newFound = new Set(foundWords);
          newFound.add(matchedWord);
          setFoundWords(newFound);
          const newHighlighted = new Set(highlightedCells);
          cells.forEach(c => newHighlighted.add(c));
          setHighlightedCells(newHighlighted);

          // Check if all words found
          if (comp && newFound.size >= comp.words.length) {
            if (timerRef.current) clearInterval(timerRef.current);
            setTimeout(() => submitGame(Array.from(newFound)), 500);
          }
        }
      }

      setSelectStart(null);
      setSelectedCells(new Set());
    }
  };

  const submitGame = async (wordsOverride?: string[]) => {
    if (!comp) return;
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const found = wordsOverride || Array.from(foundWords);

    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/competitions/${compId}/submit-words`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ found_words: found, time_taken: timeTaken }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setScreen("results");
      }
    } catch (err) {
      console.error("Submit failed:", err);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (screen === "loading") return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 60 }} size="large" color="#10b981" /></SafeAreaView>;

  if (screen === "intro" && comp) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.nav}><TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#10b981" /></TouchableOpacity><Text style={s.navTitle}>Word Search</Text><View style={{ width: 32 }} /></View>
        <ScrollView contentContainerStyle={s.intro}>
          <View style={[s.introIcon, { backgroundColor: "#d1fae5" }]}><Ionicons name="search" size={48} color="#10b981" /></View>
          <Text style={s.introTitle}>{comp.title}</Text>
          {comp.description && <Text style={s.introDesc}>{comp.description}</Text>}
          {comp.prize_description && <View style={s.prizeCard}><Ionicons name="gift" size={20} color="#92400e" /><Text style={s.prizeCardText}>{comp.prize_description}</Text></View>}
          <View style={s.rulesCard}>
            <Text style={s.rulesTitle}>How to Play</Text>
            <View style={s.rule}><Ionicons name="search-outline" size={18} color="#6b7280" /><Text style={s.ruleText}>{comp.words.length} hidden words to find</Text></View>
            <View style={s.rule}><Ionicons name="finger-print-outline" size={18} color="#6b7280" /><Text style={s.ruleText}>Tap the first letter, then tap the last letter</Text></View>
            <View style={s.rule}><Ionicons name="timer-outline" size={18} color="#6b7280" /><Text style={s.ruleText}>{formatTime(comp.time_limit)} time limit</Text></View>
            <View style={s.rule}><Ionicons name="alert-circle-outline" size={18} color="#6b7280" /><Text style={s.ruleText}>One attempt only</Text></View>
          </View>
          <Text style={s.wordPreview}>Words to find:</Text>
          <View style={s.wordChips}>{comp.words.map(w => <View key={w.id} style={s.wordChip}><Text style={s.wordChipText}>{w.word}</Text></View>)}</View>
          <TouchableOpacity style={[s.startBtn, { backgroundColor: "#10b981" }]} onPress={startGame}><Ionicons name="play" size={22} color="#fff" /><Text style={s.startBtnText}>Start</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === "playing" && comp) {
    const gridSize = grid.length;
    const cellSize = Math.min(32, Math.floor(300 / gridSize));
    const timerColor = timeLeft <= 30 ? "#ef4444" : timeLeft <= 60 ? "#f59e0b" : "#10b981";

    return (
      <SafeAreaView style={s.safe}>
        <View style={s.playHeader}>
          <Text style={s.foundCount}>{foundWords.size}/{comp.words.length} found</Text>
          <View style={[s.timerBadge, { backgroundColor: timerColor + "15" }]}>
            <Ionicons name="timer-outline" size={16} color={timerColor} />
            <Text style={[s.timerText, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.gridContainer}>
          <View style={[s.gridWrapper, { width: gridSize * cellSize + 4 }]}>
            {grid.map((row, r) => (
              <View key={r} style={s.gridRow}>
                {row.map((letter, c) => {
                  const key = `${r},${c}`;
                  const isHighlighted = highlightedCells.has(key);
                  const isSelected = selectedCells.has(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        s.cell,
                        { width: cellSize, height: cellSize },
                        isHighlighted && s.cellFound,
                        isSelected && s.cellSelected,
                      ]}
                      onPress={() => handleCellTap(r, c)}
                      activeOpacity={0.6}
                    >
                      <Text style={[
                        s.cellText,
                        { fontSize: cellSize * 0.5 },
                        isHighlighted && s.cellTextFound,
                        isSelected && s.cellTextSelected,
                      ]}>
                        {letter}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Word list */}
          <View style={s.wordList}>
            {comp.words.map(w => {
              const found = foundWords.has(w.word.toUpperCase());
              return (
                <View key={w.id} style={[s.wordListItem, found && s.wordListItemFound]}>
                  <Ionicons name={found ? "checkmark-circle" : "ellipse-outline"} size={16} color={found ? "#10b981" : "#d1d5db"} />
                  <Text style={[s.wordListText, found && s.wordListTextFound]}>{w.word}</Text>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={s.submitEarlyBtn} onPress={() => { if (timerRef.current) clearInterval(timerRef.current); submitGame(); }}>
            <Text style={s.submitEarlyText}>Finish Early</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if ((screen === "results" || screen === "already_done") && results) {
    const pct = results.total_questions > 0 ? Math.round((results.correct_answers / results.total_questions) * 100) : 0;
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.resultsContainer}>
          <Text style={s.emoji}>{pct >= 80 ? "🏆" : pct >= 50 ? "👏" : "💪"}</Text>
          <Text style={s.resultsTitle}>{screen === "already_done" ? "Your Result" : "Complete!"}</Text>
          <View style={[s.scoreCircle, { backgroundColor: "#10b981" }]}>
            <Text style={s.scoreNum}>{results.score}</Text>
            <Text style={s.scoreLbl}>points</Text>
          </View>
          <View style={s.statsRow}>
            <View style={s.statBox}><Text style={s.statNum}>{results.correct_answers}/{results.total_questions}</Text><Text style={s.statLbl}>Found</Text></View>
            <View style={s.statBox}><Text style={s.statNum}>{pct}%</Text><Text style={s.statLbl}>Accuracy</Text></View>
            <View style={s.statBox}><Text style={s.statNum}>{results.time_taken}s</Text><Text style={s.statLbl}>Time</Text></View>
          </View>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}><Text style={s.backBtnText}>Back to Competitions</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f6f8" },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  navTitle: { fontSize: 17, fontWeight: "700" },

  intro: { padding: 20, alignItems: "center" },
  introIcon: { width: 90, height: 90, borderRadius: 45, justifyContent: "center", alignItems: "center", marginTop: 20, marginBottom: 16 },
  introTitle: { fontSize: 22, fontWeight: "800", color: "#111827", textAlign: "center" },
  introDesc: { fontSize: 14, color: "#6b7280", textAlign: "center", marginTop: 8, marginBottom: 16 },
  prizeCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fef3c7", padding: 14, borderRadius: 12, gap: 10, width: "100%", marginBottom: 16 },
  prizeCardText: { fontSize: 14, fontWeight: "600", color: "#92400e", flex: 1 },
  rulesCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, width: "100%", marginBottom: 16 },
  rulesTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  rule: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  ruleText: { fontSize: 14, color: "#374151" },
  wordPreview: { fontSize: 14, fontWeight: "600", color: "#374151", alignSelf: "flex-start", marginBottom: 8 },
  wordChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%", marginBottom: 20 },
  wordChip: { backgroundColor: "#d1fae5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  wordChipText: { fontSize: 13, fontWeight: "600", color: "#065f46" },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 14, width: "100%", gap: 8 },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },

  // Playing
  playHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  foundCount: { fontSize: 15, fontWeight: "700", color: "#111827" },
  timerBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  timerText: { fontSize: 18, fontWeight: "800" },

  gridContainer: { alignItems: "center", paddingVertical: 16 },
  gridWrapper: { backgroundColor: "#fff", borderRadius: 12, padding: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  gridRow: { flexDirection: "row" },
  cell: { justifyContent: "center", alignItems: "center", borderWidth: 0.5, borderColor: "#e5e7eb" },
  cellFound: { backgroundColor: "#d1fae5" },
  cellSelected: { backgroundColor: "#dbeafe" },
  cellText: { fontWeight: "700", color: "#374151" },
  cellTextFound: { color: "#065f46" },
  cellTextSelected: { color: "#1d4ed8" },

  wordList: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, marginTop: 16 },
  wordListItem: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb" },
  wordListItemFound: { backgroundColor: "#d1fae5", borderColor: "#a7f3d0" },
  wordListText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  wordListTextFound: { color: "#065f46", textDecorationLine: "line-through" },

  submitEarlyBtn: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, backgroundColor: "#f3f4f6" },
  submitEarlyText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },

  // Results
  resultsContainer: { padding: 20, alignItems: "center" },
  emoji: { fontSize: 60, marginTop: 30 },
  resultsTitle: { fontSize: 24, fontWeight: "800", marginTop: 12 },
  scoreCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: "center", alignItems: "center", marginTop: 24, marginBottom: 24 },
  scoreNum: { fontSize: 36, fontWeight: "800", color: "#fff" },
  scoreLbl: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: -4 },
  statsRow: { flexDirection: "row", gap: 16, marginBottom: 30 },
  statBox: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 16, alignItems: "center", elevation: 1 },
  statNum: { fontSize: 20, fontWeight: "800", color: "#111827" },
  statLbl: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  backBtn: { marginTop: 14, padding: 12 },
  backBtnText: { color: "#10b981", fontWeight: "600", fontSize: 15 },
});