import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { I18nManager, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Speech from "expo-speech";
import translations, { Language, RTL_LANGUAGES, LANGUAGE_LABELS } from "../translations";

// ─── Font Scale Map ───────────────────────────────────────────────────
export type FontSize = "small" | "medium" | "large" | "xl";

const FONT_SCALES: Record<FontSize, number> = {
  small: 0.85,
  medium: 1,
  large: 1.2,
  xl: 1.45,
};

// ─── Theme Colours ────────────────────────────────────────────────────
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryLight: string;
  danger: string;
  success: string;
  warning: string;
  inputBg: string;
  inputBorder: string;
}

const LIGHT_THEME: ThemeColors = {
  background: "#f4f6f8",
  surface: "#ffffff",
  surfaceAlt: "#f9fafb",
  text: "#111827",
  textSecondary: "#555555",
  textMuted: "#9ca3af",
  border: "#e5e7eb",
  primary: "#2563eb",
  primaryLight: "#eff6ff",
  danger: "#ef4444",
  success: "#10b981",
  warning: "#f59e0b",
  inputBg: "#fafafa",
  inputBorder: "#dddddd",
};

const DARK_THEME: ThemeColors = {
  background: "#0f172a",
  surface: "#1e293b",
  surfaceAlt: "#334155",
  text: "#f1f5f9",
  textSecondary: "#cbd5e1",
  textMuted: "#64748b",
  border: "#334155",
  primary: "#3b82f6",
  primaryLight: "#1e3a5f",
  danger: "#f87171",
  success: "#34d399",
  warning: "#fbbf24",
  inputBg: "#1e293b",
  inputBorder: "#475569",
};

const HIGH_CONTRAST_THEME: ThemeColors = {
  background: "#000000",
  surface: "#1a1a1a",
  surfaceAlt: "#2a2a2a",
  text: "#ffffff",
  textSecondary: "#ffffff",
  textMuted: "#cccccc",
  border: "#ffffff",
  primary: "#00aaff",
  primaryLight: "#003366",
  danger: "#ff4444",
  success: "#00ff88",
  warning: "#ffdd00",
  inputBg: "#1a1a1a",
  inputBorder: "#ffffff",
};

// ─── Speech Language Codes ────────────────────────────────────────────
const SPEECH_LANG: Record<Language, string> = {
  en: "en-IE",
  ga: "ga-IE",
  ar: "ar-SA",
  zh: "zh-CN",
  hi: "hi-IN",
  fr: "fr-FR",
};

// ─── Context Type ─────────────────────────────────────────────────────
interface AccessibilityContextType {
  // Settings
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  darkMode: boolean;
  setDarkMode: (on: boolean) => void;
  highContrast: boolean;
  setHighContrast: (on: boolean) => void;
  readAloud: boolean;
  setReadAloud: (on: boolean) => void;
  language: Language;
  setLanguage: (lang: Language) => void;

  // Computed
  fontScale: number;
  colors: ThemeColors;
  isRTL: boolean;
  t: (key: string) => string;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  scaled: (baseSize: number) => number;
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

// ─── Storage helpers ──────────────────────────────────────────────────
const STORAGE_KEY = "accessibility_settings";

const saveSettings = async (settings: {
  fontSize: FontSize;
  darkMode: boolean;
  highContrast: boolean;
  readAloud: boolean;
  language: Language;
}) => {
  try {
    const json = JSON.stringify(settings);
    if (Platform.OS === "web") {
      localStorage.setItem(STORAGE_KEY, json);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, json);
    }
  } catch (err) {
    console.error("Failed to save accessibility settings:", err);
  }
};

const loadSettings = async () => {
  try {
    let json: string | null = null;
    if (Platform.OS === "web") {
      json = localStorage.getItem(STORAGE_KEY);
    } else {
      json = await SecureStore.getItemAsync(STORAGE_KEY);
    }
    if (json) return JSON.parse(json);
  } catch (err) {
    console.error("Failed to load accessibility settings:", err);
  }
  return null;
};

// ─── Provider Component ───────────────────────────────────────────────
export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>("medium");
  const [darkMode, setDarkModeState] = useState(false);
  const [highContrast, setHighContrastState] = useState(false);
  const [readAloud, setReadAloudState] = useState(false);
  const [language, setLanguageState] = useState<Language>("en");
  const [loaded, setLoaded] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    (async () => {
      const saved = await loadSettings();
      if (saved) {
        if (saved.fontSize) setFontSizeState(saved.fontSize);
        if (saved.darkMode !== undefined) setDarkModeState(saved.darkMode);
        if (saved.highContrast !== undefined) setHighContrastState(saved.highContrast);
        if (saved.readAloud !== undefined) setReadAloudState(saved.readAloud);
        if (saved.language) {
          setLanguageState(saved.language);
          const shouldBeRTL = RTL_LANGUAGES.includes(saved.language);
          if (I18nManager.isRTL !== shouldBeRTL) {
            I18nManager.allowRTL(shouldBeRTL);
            I18nManager.forceRTL(shouldBeRTL);
          }
        }
      }
      setLoaded(true);
    })();
  }, []);

  // Persist on change
  useEffect(() => {
    if (!loaded) return;
    saveSettings({ fontSize, darkMode, highContrast, readAloud, language });
  }, [fontSize, darkMode, highContrast, readAloud, language, loaded]);

  // Setters that update state
  const setFontSize = useCallback((size: FontSize) => setFontSizeState(size), []);
  const setDarkMode = useCallback((on: boolean) => {
    setDarkModeState(on);
    if (on) setHighContrastState(false); // mutual exclusion
  }, []);
  const setHighContrast = useCallback((on: boolean) => {
    setHighContrastState(on);
    if (on) setDarkModeState(false); // mutual exclusion
  }, []);
  const setReadAloud = useCallback((on: boolean) => {
    setReadAloudState(on);
    if (!on) {
      if (Platform.OS === "web") {
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      } else {
        Speech.stop();
      }
    }
  }, []);
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    const shouldBeRTL = RTL_LANGUAGES.includes(lang);
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      // RTL change requires a restart on native
    }
  }, []);

  // Computed values
  const fontScale = FONT_SCALES[fontSize];
  const colors = highContrast ? HIGH_CONTRAST_THEME : darkMode ? DARK_THEME : LIGHT_THEME;
  const isRTL = RTL_LANGUAGES.includes(language);

  const t = useCallback(
    (key: string): string => {
      return translations[language]?.[key] || translations.en[key] || key;
    },
    [language]
  );

  const speak = useCallback(
    (text: string) => {
      if (!readAloud) return;
      if (Platform.OS === "web") {
        // Use Web Speech API directly — expo-speech on web can silently fail
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = SPEECH_LANG[language] || "en-IE";
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        // Pick a matching voice if available
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) => v.lang.startsWith(utterance.lang.split("-")[0]));
        if (match) utterance.voice = match;
        window.speechSynthesis.speak(utterance);
      } else {
        Speech.stop();
        Speech.speak(text, {
          language: SPEECH_LANG[language] || "en-IE",
          rate: 0.9,
          pitch: 1.0,
        });
      }
    },
    [readAloud, language]
  );

  const stopSpeaking = useCallback(() => {
    if (Platform.OS === "web") {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } else {
      Speech.stop();
    }
  }, []);

  const scaled = useCallback(
    (baseSize: number) => Math.round(baseSize * fontScale),
    [fontScale]
  );

  return (
    <AccessibilityContext.Provider
      value={{
        fontSize,
        setFontSize,
        darkMode,
        setDarkMode,
        highContrast,
        setHighContrast,
        readAloud,
        setReadAloud,
        language,
        setLanguage,
        fontScale,
        colors,
        isRTL,
        t,
        speak,
        stopSpeaking,
        scaled,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────
export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return ctx;
}

export { LANGUAGE_LABELS, translations };
export type { Language };