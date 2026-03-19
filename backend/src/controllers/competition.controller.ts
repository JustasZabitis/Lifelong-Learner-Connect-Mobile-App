import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================
   GET ALL COMPETITIONS
========================= */
export const getCompetitions = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;
    const isStaff = role === "educator" || role === "admin";

    let result;

    if (isStaff) {
      result = await pool.query(
        `SELECT c.*,
                u.email AS created_by_email,
                (SELECT COUNT(*) FROM competition_questions cq WHERE cq.competition_id = c.id) AS question_count,
                (SELECT COUNT(*) FROM competition_words cw WHERE cw.competition_id = c.id) AS word_count,
                (SELECT COUNT(*) FROM competition_attempts ca WHERE ca.competition_id = c.id) AS attempt_count
         FROM competitions c
         LEFT JOIN users u ON u.id = c.created_by
         ORDER BY c.created_at DESC`
      );
    } else {
      result = await pool.query(
        `SELECT c.*,
                u.email AS created_by_email,
                (SELECT COUNT(*) FROM competition_questions cq WHERE cq.competition_id = c.id) AS question_count,
                (SELECT COUNT(*) FROM competition_words cw WHERE cw.competition_id = c.id) AS word_count,
                (SELECT COUNT(*) FROM competition_attempts ca WHERE ca.competition_id = c.id) AS attempt_count,
                (SELECT ca.score FROM competition_attempts ca WHERE ca.competition_id = c.id AND ca.user_id = $1) AS my_score,
                (SELECT ca.id FROM competition_attempts ca WHERE ca.competition_id = c.id AND ca.user_id = $1) AS my_attempt_id
         FROM competitions c
         LEFT JOIN users u ON u.id = c.created_by
         WHERE c.status = 'active'
           AND (c.student_group IS NULL OR c.student_group = 'all' OR c.student_group = $2 OR c.programme_name IS NOT NULL)
           AND (c.starts_at IS NULL OR c.starts_at <= NOW())
           AND (c.ends_at IS NULL OR c.ends_at >= NOW())
         ORDER BY c.created_at DESC`,
        [userId, role]
      );
    }

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch competitions" });
  }
};

/* =========================
   GET SINGLE COMPETITION
========================= */
export const getCompetition = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;
    const isStaff = role === "educator" || role === "admin";
    const compId = req.params.id;

    const comp = await pool.query(`SELECT * FROM competitions WHERE id = $1`, [compId]);
    if (comp.rows.length === 0) {
      return res.status(404).json({ error: "Competition not found" });
    }

    const attempt = await pool.query(
      `SELECT * FROM competition_attempts WHERE competition_id = $1 AND user_id = $2`,
      [compId, userId]
    );

    const competition = comp.rows[0];
    let questions: any[] = [];
    let words: any[] = [];

    if (competition.type === "quiz") {
      const qResult = isStaff
        ? await pool.query(
            `SELECT * FROM competition_questions WHERE competition_id = $1 ORDER BY sort_order ASC, id ASC`,
            [compId]
          )
        : await pool.query(
            `SELECT id, competition_id, question_text, option_a, option_b, option_c, option_d, sort_order
             FROM competition_questions WHERE competition_id = $1 ORDER BY sort_order ASC, id ASC`,
            [compId]
          );
      questions = qResult.rows;
    } else {
      // crossword or wordsearch — return words (and clues for crossword)
      const wResult = await pool.query(
        `SELECT * FROM competition_words WHERE competition_id = $1 ORDER BY sort_order ASC, id ASC`,
        [compId]
      );
      words = wResult.rows;
    }

    res.json({
      ...competition,
      questions,
      words,
      already_attempted: attempt.rows.length > 0,
      my_attempt: attempt.rows[0] || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch competition" });
  }
};

/* =========================
   CREATE COMPETITION
   Supports quiz, crossword, wordsearch
========================= */
export const createCompetition = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Not authorized" });
  }

  const {
    title, description, type, student_group, programme_name, time_limit,
    prize_description, points_per_question, speed_bonus,
    starts_at, ends_at, questions, words,
  } = req.body;

  if (!title) return res.status(400).json({ error: "Title is required" });

  const compType = type || "quiz";

  if (compType === "quiz") {
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "At least one question is required" });
    }
  } else {
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: "At least one word is required" });
    }
  }

  try {
    const comp = await pool.query(
      `INSERT INTO competitions
         (title, description, type, student_group, programme_name, time_limit, prize_description,
          points_per_question, speed_bonus, starts_at, ends_at, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12)
       RETURNING *`,
      [
        title,
        description || null,
        compType,
        student_group || null,
        programme_name || null,
        time_limit || (compType === "quiz" ? 30 : 300),
        prize_description || null,
        points_per_question || 10,
        speed_bonus !== false,
        starts_at || null,
        ends_at || null,
        req.user.id,
      ]
    );

    const compId = comp.rows[0].id;

    if (compType === "quiz" && questions) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await pool.query(
          `INSERT INTO competition_questions
             (competition_id, question_text, option_a, option_b, option_c, option_d, correct_option, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [compId, q.question_text, q.option_a, q.option_b, q.option_c || null, q.option_d || null, q.correct_option, i]
        );
      }
    } else if (words) {
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        await pool.query(
          `INSERT INTO competition_words (competition_id, word, clue, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [compId, w.word.toUpperCase().trim(), w.clue || null, i]
        );
      }
    }

    res.status(201).json(comp.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create competition" });
  }
};

/* =========================
   UPDATE COMPETITION STATUS
========================= */
export const updateCompetitionStatus = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { status } = req.body;
  const compId = req.params.id;

  if (!["draft", "active", "closed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const result = await pool.query(
      `UPDATE competitions SET status = $1 WHERE id = $2 RETURNING *`,
      [status, compId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Competition not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update status" });
  }
};

/* =========================
   DELETE COMPETITION
========================= */
export const deleteCompetition = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Not authorized" });
  }

  try {
    await pool.query(`DELETE FROM competitions WHERE id = $1`, [req.params.id]);
    res.json({ message: "Competition deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete competition" });
  }
};

/* =========================
   SUBMIT QUIZ ATTEMPT
========================= */
export const submitAttempt = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const compId = req.params.id;
    const { answers, time_taken } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: "Answers array is required" });
    }

    const existing = await pool.query(
      `SELECT id FROM competition_attempts WHERE competition_id = $1 AND user_id = $2`,
      [compId, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Already attempted this quiz" });
    }

    const comp = await pool.query(`SELECT * FROM competitions WHERE id = $1`, [compId]);
    if (comp.rows.length === 0) return res.status(404).json({ error: "Competition not found" });

    const competition = comp.rows[0];
    const pointsPerQ = competition.points_per_question || 10;
    const hasSpeedBonus = competition.speed_bonus;
    const timeLimit = competition.time_limit || 30;

    const questions = await pool.query(
      `SELECT id, correct_option FROM competition_questions WHERE competition_id = $1`,
      [compId]
    );

    const correctMap: Record<number, string> = {};
    questions.rows.forEach((q: any) => {
      correctMap[q.id] = q.correct_option.trim().toUpperCase();
    });

    const attempt = await pool.query(
      `INSERT INTO competition_attempts (competition_id, user_id, total_questions, time_taken)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [compId, userId, questions.rows.length, time_taken || 0]
    );

    const attemptId = attempt.rows[0].id;
    let totalScore = 0;
    let correctCount = 0;

    for (const ans of answers) {
      const correct = correctMap[ans.question_id];
      const isCorrect = correct === (ans.selected_option || "").trim().toUpperCase();

      if (isCorrect) {
        correctCount++;
        let questionScore = pointsPerQ;
        if (hasSpeedBonus && ans.time_taken !== undefined) {
          const timeRatio = Math.max(0, 1 - ans.time_taken / timeLimit);
          const bonus = Math.round(pointsPerQ * 0.5 * timeRatio);
          questionScore += bonus;
        }
        totalScore += questionScore;
      }

      await pool.query(
        `INSERT INTO competition_answers (attempt_id, question_id, selected_option, is_correct, time_taken)
         VALUES ($1, $2, $3, $4, $5)`,
        [attemptId, ans.question_id, ans.selected_option || null, isCorrect, ans.time_taken || 0]
      );
    }

    await pool.query(
      `UPDATE competition_attempts SET score = $1, correct_answers = $2 WHERE id = $3`,
      [totalScore, correctCount, attemptId]
    );

    res.status(201).json({
      attempt_id: attemptId,
      score: totalScore,
      correct_answers: correctCount,
      total_questions: questions.rows.length,
      time_taken: time_taken || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to submit attempt" });
  }
};

/* =========================
   SUBMIT WORD GAME ATTEMPT
   For crossword and wordsearch
========================= */
export const submitWordAttempt = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const compId = req.params.id;
    const { found_words, time_taken } = req.body;
    // found_words: ["HELLO", "WORLD", ...]

    if (!found_words || !Array.isArray(found_words)) {
      return res.status(400).json({ error: "found_words array is required" });
    }

    const existing = await pool.query(
      `SELECT id FROM competition_attempts WHERE competition_id = $1 AND user_id = $2`,
      [compId, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Already attempted" });
    }

    const comp = await pool.query(`SELECT * FROM competitions WHERE id = $1`, [compId]);
    if (comp.rows.length === 0) return res.status(404).json({ error: "Competition not found" });

    const competition = comp.rows[0];
    const pointsPerWord = competition.points_per_question || 10;

    // Get all words for this competition
    const wordsResult = await pool.query(
      `SELECT word FROM competition_words WHERE competition_id = $1`,
      [compId]
    );

    const allWords = wordsResult.rows.map((w: any) => w.word.trim().toUpperCase());
    const normalizedFound = found_words.map((w: string) => w.trim().toUpperCase());

    let correctCount = 0;
    for (const w of normalizedFound) {
      if (allWords.includes(w)) correctCount++;
    }

    let totalScore = correctCount * pointsPerWord;

    // Speed bonus for word games: bonus if finished faster than time limit
    if (competition.speed_bonus && time_taken && competition.time_limit) {
      const timeRatio = Math.max(0, 1 - time_taken / competition.time_limit);
      const bonus = Math.round(totalScore * 0.3 * timeRatio);
      totalScore += bonus;
    }

    const attempt = await pool.query(
      `INSERT INTO competition_attempts
         (competition_id, user_id, score, total_questions, correct_answers, time_taken)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [compId, userId, totalScore, allWords.length, correctCount, time_taken || 0]
    );

    res.status(201).json({
      attempt_id: attempt.rows[0].id,
      score: totalScore,
      correct_answers: correctCount,
      total_questions: allWords.length,
      time_taken: time_taken || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to submit attempt" });
  }
};

/* =========================
   GET LEADERBOARD
========================= */
export const getLeaderboard = async (req: AuthRequest, res: Response) => {
  try {
    const compId = req.params.id;
    const result = await pool.query(
      `SELECT ca.score, ca.correct_answers, ca.total_questions, ca.time_taken, ca.completed_at,
              u.email, u.id AS user_id
       FROM competition_attempts ca
       JOIN users u ON u.id = ca.user_id
       WHERE ca.competition_id = $1
       ORDER BY ca.score DESC, ca.time_taken ASC
       LIMIT 50`,
      [compId]
    );

    const leaderboard = result.rows.map((row: any, index: number) => ({
      rank: index + 1,
      ...row,
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
};