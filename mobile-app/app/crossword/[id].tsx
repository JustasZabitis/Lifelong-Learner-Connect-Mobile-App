import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, ScrollView, TextInput, Alert, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL } from "../../config";

interface WordEntry { id: number; word: string; clue: string | null; }
interface Competition { id: number; title: string; description: string | null; time_limit: number; prize_description: string | null; words: WordEntry[]; already_attempted: boolean; my_attempt: any; }

interface Placement { word: string; clue: string; row: number; col: number; dir: "across" | "down"; number: number; }

const getToken = async (): Promise<string | null> =>
  Platform.OS === "web" ? localStorage.getItem("token") : SecureStore.getItemAsync("token");

// ── Simple crossword generator ──
function generateCrossword(wordsInput: { word: string; clue: string }[]): { grid: string[][]; placements: Placement[]; size: number } {
  const sorted = [...wordsInput].sort((a, b) => b.word.length - a.word.length);
  const size = Math.max(15, sorted[0].word.length + 4);
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(""));
  const placements: Placement[] = [];
  let num = 1;

  // Place first word horizontally in the middle
  const first = sorted[0];
  const startR = Math.floor(size / 2);
  const startC = Math.floor((size - first.word.length) / 2);
  for (let i = 0; i < first.word.length; i++) grid[startR][startC + i] = first.word[i];
  placements.push({ word: first.word, clue: first.clue, row: startR, col: startC, dir: "across", number: num++ });

  // Try to place remaining words intersecting existing ones
  for (let wi = 1; wi < sorted.length; wi++) {
    const entry = sorted[wi];
    const word = entry.word;
    let placed = false;

    for (const existing of placements) {
      if (placed) break;
      for (let ei = 0; ei < existing.word.length; ei++) {
        if (placed) break;
        for (let wi2 = 0; wi2 < word.length; wi2++) {
          if (word[wi2] !== existing.word[ei]) continue;

          // Try perpendicular placement
          const newDir = existing.dir === "across" ? "down" : "across";
          let newR: number, newC: number;

          if (newDir === "down") {
            newR = existing.row - wi2;
            newC = existing.col + ei;
          } else {
            newR = existing.row + ei;
            newC = existing.col - wi2;
          }

          // Check bounds and conflicts
          let canPlace = true;
          for (let i = 0; i < word.length; i++) {
            const r = newDir === "down" ? newR + i : newR;
            const c = newDir === "across" ? newC + i : newC;
            if (r < 0 || r >= size || c < 0 || c >= size) { canPlace = false; break; }
            if (grid[r][c] !== "" && grid[r][c] !== word[i]) { canPlace = false; break; }
          }

          // Check no adjacent parallel words
          if (canPlace) {
            for (let i = 0; i < word.length; i++) {
              const r = newDir === "down" ? newR + i : newR;
              const c = newDir === "across" ? newC + i : newC;
              if (grid[r][c] === word[i]) continue; // Intersection is fine

              // Check perpendicular neighbors
              if (newDir === "down") {
                if (c > 0 && grid[r][c - 1] !== "" && !(r === newR - 1 + i)) { /* ok if intersection */ }
                if (c < size - 1 && grid[r][c + 1] !== "") canPlace = false;
                if (c > 0 && grid[r][c - 1] !== "") canPlace = false;
              } else {
                if (r > 0 && grid[r - 1][c] !== "") canPlace = false;
                if (r < size - 1 && grid[r + 1][c] !== "") canPlace = false;
              }
            }
          }

          if (canPlace) {
            for (let i = 0; i < word.length; i++) {
              const r = newDir === "down" ? newR + i : newR;
              const c = newDir === "across" ? newC + i : newC;
              grid[r][c] = word[i];
            }
            placements.push({ word: word, clue: entry.clue, row: newR, col: newC, dir: newDir, number: num++ });
            placed = true;
          }
        }
      }
    }

    // Fallback: place isolated
    if (!placed) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const dir = attempt % 2 === 0 ? "across" : "down";
        const r = Math.floor(Math.random() * (size - (dir === "down" ? word.length : 1)));
        const c = Math.floor(Math.random() * (size - (dir === "across" ? word.length : 1)));
        let ok = true;
        for (let i = 0; i < word.length; i++) {
          const cr = dir === "down" ? r + i : r;
          const cc = dir === "across" ? c + i : c;
          if (grid[cr][cc] !== "" && grid[cr][cc] !== word[i]) { ok = false; break; }
        }
        if (ok) {
          for (let i = 0; i < word.length; i++) {
            const cr = dir === "down" ? r + i : r;
            const cc = dir === "across" ? c + i : c;
            grid[cr][cc] = word[i];
          }
          placements.push({ word, clue: entry.clue, row: r, col: c, dir, number: num++ });
          break;
        }
      }
    }
  }

  // Trim grid to used area
  let minR = size, maxR = 0, minC = size, maxC = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (grid[r][c]) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
  }

  const pad = 1;
  const trimR = Math.max(0, minR - pad);
  const trimC = Math.max(0, minC - pad);
  const trimH = Math.min(size, maxR + pad + 1) - trimR;
  const trimW = Math.min(size, maxC + pad + 1) - trimC;

  const trimmedGrid = Array.from({ length: trimH }, (_, r) =>
    Array.from({ length: trimW }, (_, c) => grid[r + trimR]?.[c + trimC] || "")
  );

  const trimmedPlacements = placements.map(p => ({ ...p, row: p.row - trimR, col: p.col - trimC }));

  return { grid: trimmedGrid, placements: trimmedPlacements, size: Math.max(trimH, trimW) };
}

type Screen = "loading" | "intro" | "playing" | "results" | "already_done";

export default function CrosswordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const compId = Number(id);
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("loading");
  const [comp, setComp] = useState<Competition | null>(null);
  const [grid, setGrid] = useState<string[][]>([]);
  const [userGrid, setUserGrid] = useState<string[][]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [activeCell, setActiveCell] = useState<number[] | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [results, setResults] = useState<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<TextInput>(null);

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
    const wordsData = comp.words.map(w => ({ word: w.word.toUpperCase(), clue: w.clue || "" }));
    const { grid: g, placements: p } = generateCrossword(wordsData);
    setGrid(g);
    setPlacements(p);
    setUserGrid(g.map(row => row.map(cell => cell ? "" : "")));
    setTimeLeft(comp.time_limit);
    setStartTime(Date.now());
    setScreen("playing");

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { if (timerRef.current) clearInterval(timerRef.current); submitGame(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCellInput = (r: number, c: number, value: string) => {
    if (!grid[r][c]) return; // Empty cell
    const letter = value.toUpperCase().slice(-1);
    setUserGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = letter;
      return next;
    });
  };

  const checkWordsCompleted = (): string[] => {
    const found: string[] = [];
    for (const p of placements) {
      let word = "";
      for (let i = 0; i < p.word.length; i++) {
        const r = p.dir === "down" ? p.row + i : p.row;
        const c = p.dir === "across" ? p.col + i : p.col;
        word += userGrid[r]?.[c] || "";
      }
      if (word.toUpperCase() === p.word.toUpperCase()) found.push(p.word);
    }
    return found;
  };

  const submitGame = async (override?: string[]) => {
    if (!comp) return;
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const found = override || checkWordsCompleted();

    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/competitions/${compId}/submit-words`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ found_words: found, time_taken: timeTaken }),
      });
      if (res.ok) { setResults(await res.json()); setScreen("results"); }
    } catch (err) { console.error(err); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ── Number map for cells ──
  const numberMap: Record<string, number> = {};
  placements.forEach(p => { numberMap[`${p.row},${p.col}`] = p.number; });

  if (screen === "loading") return <SafeAreaView style={st.safe}><ActivityIndicator style={{ marginTop: 60 }} size="large" color="#8b5cf6" /></SafeAreaView>;

  if (screen === "intro" && comp) {
    const across = comp.words.filter((_, i) => i % 2 === 0);
    const down = comp.words.filter((_, i) => i % 2 !== 0);
    return (
      <SafeAreaView style={st.safe}>
        <View style={st.nav}><TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#8b5cf6" /></TouchableOpacity><Text style={st.navTitle}>Crossword</Text><View style={{ width: 32 }} /></View>
        <ScrollView contentContainerStyle={st.intro}>
          <View style={[st.introIcon, { backgroundColor: "#ede9fe" }]}><Ionicons name="grid" size={48} color="#8b5cf6" /></View>
          <Text style={st.introTitle}>{comp.title}</Text>
          {comp.description && <Text style={st.introDesc}>{comp.description}</Text>}
          {comp.prize_description && <View style={st.prizeCard}><Ionicons name="gift" size={20} color="#92400e" /><Text style={st.prizeCardText}>{comp.prize_description}</Text></View>}
          <View style={st.rulesCard}>
            <Text style={st.rulesTitle}>How to Play</Text>
            <View style={st.rule}><Ionicons name="grid-outline" size={18} color="#6b7280" /><Text style={st.ruleText}>{comp.words.length} words to solve</Text></View>
            <View style={st.rule}><Ionicons name="finger-print-outline" size={18} color="#6b7280" /><Text style={st.ruleText}>Tap a cell and type the letter</Text></View>
            <View style={st.rule}><Ionicons name="timer-outline" size={18} color="#6b7280" /><Text style={st.ruleText}>{formatTime(comp.time_limit)} time limit</Text></View>
          </View>
          <TouchableOpacity style={[st.startBtn, { backgroundColor: "#8b5cf6" }]} onPress={startGame}><Ionicons name="play" size={22} color="#fff" /><Text style={st.startBtnText}>Start</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === "playing" && comp) {
    const rows = grid.length;
    const cols = grid[0]?.length || 0;
    const cellSize = Math.min(36, Math.floor(340 / Math.max(rows, cols)));
    const timerColor = timeLeft <= 30 ? "#ef4444" : timeLeft <= 60 ? "#f59e0b" : "#8b5cf6";

    const acrossClues = placements.filter(p => p.dir === "across").sort((a, b) => a.number - b.number);
    const downClues = placements.filter(p => p.dir === "down").sort((a, b) => a.number - b.number);

    return (
      <SafeAreaView style={st.safe}>
        <View style={st.playHeader}>
          <Text style={st.foundCount}>Crossword</Text>
          <View style={[st.timerBadge, { backgroundColor: timerColor + "15" }]}>
            <Ionicons name="timer-outline" size={16} color={timerColor} />
            <Text style={[st.timerText, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={st.gridContainer}>
          {/* Grid */}
          <View style={[st.gridWrapper, { width: cols * cellSize + 4 }]}>
            {grid.map((row, r) => (
              <View key={r} style={st.gridRow}>
                {row.map((letter, c) => {
                  const isActive = grid[r][c] !== "";
                  const cellNum = numberMap[`${r},${c}`];
                  const isSelected = activeCell && activeCell[0] === r && activeCell[1] === c;
                  const userLetter = userGrid[r]?.[c] || "";
                  const isCorrect = userLetter && userLetter === letter;

                  return (
                    <TouchableOpacity
                      key={`${r},${c}`}
                      style={[
                        st.cell,
                        { width: cellSize, height: cellSize },
                        !isActive && st.cellBlocked,
                        isSelected && st.cellActive,
                        isCorrect && st.cellCorrect,
                      ]}
                      onPress={() => {
                        if (isActive) {
                          setActiveCell([r, c]);
                          inputRef.current?.focus();
                        }
                      }}
                      disabled={!isActive}
                    >
                      {cellNum && <Text style={st.cellNumber}>{cellNum}</Text>}
                      <Text style={[st.cellLetter, { fontSize: cellSize * 0.5 }]}>
                        {userLetter}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Hidden input */}
          <TextInput
            ref={inputRef}
            style={st.hiddenInput}
            value=""
            onChangeText={(v) => {
              if (activeCell && v) {
                handleCellInput(activeCell[0], activeCell[1], v);
                // Auto-advance to next cell in current direction
                const r = activeCell[0];
                const c = activeCell[1];
                // Try right first, then down
                if (c + 1 < cols && grid[r][c + 1]) setActiveCell([r, c + 1]);
                else if (r + 1 < rows && grid[r + 1][c]) setActiveCell([r + 1, c]);
              }
            }}
            autoCapitalize="characters"
            maxLength={1}
          />

          {/* Clues */}
          <View style={st.cluesContainer}>
            {acrossClues.length > 0 && (
              <View style={st.clueSection}>
                <Text style={st.clueHeader}>Across</Text>
                {acrossClues.map(p => (
                  <Text key={p.number} style={st.clueText}>{p.number}. {p.clue}</Text>
                ))}
              </View>
            )}
            {downClues.length > 0 && (
              <View style={st.clueSection}>
                <Text style={st.clueHeader}>Down</Text>
                {downClues.map(p => (
                  <Text key={p.number} style={st.clueText}>{p.number}. {p.clue}</Text>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity style={[st.submitBtn, { backgroundColor: "#8b5cf6" }]} onPress={() => { if (timerRef.current) clearInterval(timerRef.current); submitGame(); }}>
            <Text style={st.submitBtnText}>Submit Answers</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if ((screen === "results" || screen === "already_done") && results) {
    const pct = results.total_questions > 0 ? Math.round((results.correct_answers / results.total_questions) * 100) : 0;
    return (
      <SafeAreaView style={st.safe}>
        <ScrollView contentContainerStyle={st.resultsContainer}>
          <Text style={st.emoji}>{pct >= 80 ? "🏆" : pct >= 50 ? "👏" : "💪"}</Text>
          <Text style={st.resultsTitle}>{screen === "already_done" ? "Your Result" : "Complete!"}</Text>
          <View style={[st.scoreCircle, { backgroundColor: "#8b5cf6" }]}>
            <Text style={st.scoreNum}>{results.score}</Text>
            <Text style={st.scoreLbl}>points</Text>
          </View>
          <View style={st.statsRow}>
            <View style={st.statBox}><Text style={st.statNum}>{results.correct_answers}/{results.total_questions}</Text><Text style={st.statLbl}>Words</Text></View>
            <View style={st.statBox}><Text style={st.statNum}>{pct}%</Text><Text style={st.statLbl}>Accuracy</Text></View>
            <View style={st.statBox}><Text style={st.statNum}>{results.time_taken}s</Text><Text style={st.statLbl}>Time</Text></View>
          </View>
          <TouchableOpacity style={st.backBtn} onPress={() => router.back()}><Text style={[st.backBtnText, { color: "#8b5cf6" }]}>Back to Competitions</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f6f8" },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  navTitle: { fontSize: 17, fontWeight: "700" },

  intro: { padding: 20, alignItems: "center" },
  introIcon: { width: 90, height: 90, borderRadius: 45, justifyContent: "center", alignItems: "center", marginTop: 20, marginBottom: 16 },
  introTitle: { fontSize: 22, fontWeight: "800", color: "#111827", textAlign: "center" },
  introDesc: { fontSize: 14, color: "#6b7280", textAlign: "center", marginTop: 8, marginBottom: 16 },
  prizeCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fef3c7", padding: 14, borderRadius: 12, gap: 10, width: "100%", marginBottom: 16 },
  prizeCardText: { fontSize: 14, fontWeight: "600", color: "#92400e", flex: 1 },
  rulesCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, width: "100%", marginBottom: 20 },
  rulesTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  rule: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  ruleText: { fontSize: 14, color: "#374151" },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 14, width: "100%", gap: 8 },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },

  playHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  foundCount: { fontSize: 15, fontWeight: "700", color: "#111827" },
  timerBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  timerText: { fontSize: 18, fontWeight: "800" },

  gridContainer: { alignItems: "center", paddingVertical: 16 },
  gridWrapper: { backgroundColor: "#fff", borderRadius: 12, padding: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  gridRow: { flexDirection: "row" },
  cell: { justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff", position: "relative" },
  cellBlocked: { backgroundColor: "#1e1e1e" },
  cellActive: { backgroundColor: "#ede9fe", borderColor: "#8b5cf6", borderWidth: 2 },
  cellCorrect: { backgroundColor: "#f0fdf4" },
  cellNumber: { position: "absolute", top: 1, left: 2, fontSize: 8, fontWeight: "700", color: "#6b7280" },
  cellLetter: { fontWeight: "700", color: "#111827" },

  hiddenInput: { position: "absolute", top: -100, left: -100, width: 1, height: 1, opacity: 0 },

  cluesContainer: { width: "100%", paddingHorizontal: 16, marginTop: 16 },
  clueSection: { marginBottom: 16 },
  clueHeader: { fontSize: 15, fontWeight: "700", color: "#8b5cf6", marginBottom: 8 },
  clueText: { fontSize: 14, color: "#374151", marginBottom: 4, lineHeight: 20 },

  submitBtn: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, marginTop: 16 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

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
  backBtnText: { fontWeight: "600", fontSize: 15 },
});