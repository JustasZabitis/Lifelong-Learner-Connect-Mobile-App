import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";
import FeatureManager from "../../components/FeatureManager";
import {
  useAccessibility,
  LANGUAGE_LABELS,
  FontSize,
} from "../../contexts/AccessibilityContext";
import type { Language } from "../../translations";

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

const FONT_OPTIONS: { key: FontSize; label: string }[] = [
  { key: "small", label: "settings_font_small" },
  { key: "medium", label: "settings_font_medium" },
  { key: "large", label: "settings_font_large" },
  { key: "xl", label: "settings_font_xl" },
];

const LANGUAGES: Language[] = ["en", "ga", "ar", "zh", "hi", "fr"];

const getToken = async (): Promise<string | null> =>
  Platform.OS === "web"
    ? localStorage.getItem("token")
    : SecureStore.getItemAsync("token");

export default function Settings() {
  const router = useRouter();
  const [role, setRole] = useState("");

  const {
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
    colors,
    scaled,
    t,
    isRTL,
  } = useAccessibility();

  useEffect(() => {
    const loadRole = async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const decoded = jwtDecode<TokenPayload>(token);
        setRole(decoded.role);
      } catch (err) {
        console.error("Failed to decode token:", err);
      }
    };
    loadRole();
  }, []);

  const handleSignOut = async () => {
    if (Platform.OS === "web") {
      localStorage.removeItem("token");
    } else {
      await SecureStore.deleteItemAsync("token");
    }
    router.replace("/");
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    if ((lang === "ar" && !isRTL) || (lang !== "ar" && isRTL)) {
      const msg =
        Platform.OS === "web"
          ? "Language changed. Refresh the page to apply layout direction."
          : "Language changed. Please restart the app to apply the layout direction.";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert(t("settings_language"), msg);
      }
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <AppHeader />

      <ScrollView contentContainerStyle={styles.container}>
        <Text
          style={[styles.screenTitle, { color: colors.text, fontSize: scaled(22) }]}
          accessibilityRole="header"
        >
          {t("settings_title")}
        </Text>

        {/* ══════════════════════════════════════════════
            FEATURE MANAGEMENT (Admin only)
           ══════════════════════════════════════════════ */}
        {role === "admin" && (
          <>
            <Text
              style={[styles.sectionHeader, { color: colors.primary, fontSize: scaled(13) }]}
              accessibilityRole="header"
            >
              Feature Management
            </Text>
            <FeatureManager />
          </>
        )}

        {/* ══════════════════════════════════════════════
            DISPLAY SECTION
           ══════════════════════════════════════════════ */}
        <Text
          style={[styles.sectionHeader, { color: colors.primary, fontSize: scaled(13) }]}
          accessibilityRole="header"
        >
          {t("settings_display")}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {/* Font Size */}
          <Text
            style={[styles.settingLabel, { color: colors.text, fontSize: scaled(15) }]}
            accessibilityRole="text"
          >
            {t("settings_font_size")}
          </Text>
          <View style={styles.fontRow}>
            {FONT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.fontChip,
                  {
                    backgroundColor:
                      fontSize === opt.key ? colors.primary : colors.surfaceAlt,
                    borderColor:
                      fontSize === opt.key ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFontSize(opt.key)}
                accessibilityLabel={`${t(opt.label)} font size`}
                accessibilityRole="button"
                accessibilityState={{ selected: fontSize === opt.key }}
              >
                <Text
                  style={[
                    styles.fontChipText,
                    {
                      color: fontSize === opt.key ? "#fff" : colors.text,
                      fontSize: scaled(12),
                    },
                  ]}
                >
                  {t(opt.label)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Font preview */}
          <View
            style={[styles.previewBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontSize: scaled(14) }}>
              Aa — {t("settings_font_size")} {t(`settings_font_${fontSize}`)}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Dark Mode */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="moon-outline" size={scaled(20)} color={colors.text} />
              <Text style={[styles.toggleLabel, { color: colors.text, fontSize: scaled(15) }]}>
                {t("settings_dark_mode")}
              </Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              accessibilityLabel={t("settings_dark_mode")}
              accessibilityRole="switch"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* High Contrast */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="contrast-outline" size={scaled(20)} color={colors.text} />
              <Text style={[styles.toggleLabel, { color: colors.text, fontSize: scaled(15) }]}>
                {t("settings_high_contrast")}
              </Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={setHighContrast}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              accessibilityLabel={t("settings_high_contrast")}
              accessibilityRole="switch"
            />
          </View>
        </View>

        {/* ══════════════════════════════════════════════
            ACCESSIBILITY SECTION
           ══════════════════════════════════════════════ */}
        <Text
          style={[styles.sectionHeader, { color: colors.primary, fontSize: scaled(13) }]}
          accessibilityRole="header"
        >
          {t("settings_accessibility")}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {/* Read Aloud */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="volume-high-outline" size={scaled(20)} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleLabel, { color: colors.text, fontSize: scaled(15) }]}>
                  {t("settings_read_aloud")}
                </Text>
                <Text style={[styles.toggleDesc, { color: colors.textMuted, fontSize: scaled(12) }]}>
                  {t("settings_read_aloud_desc")}
                </Text>
              </View>
            </View>
            <Switch
              value={readAloud}
              onValueChange={setReadAloud}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              accessibilityLabel={t("settings_read_aloud")}
              accessibilityRole="switch"
            />
          </View>
        </View>

        {/* ══════════════════════════════════════════════
            LANGUAGE SECTION
           ══════════════════════════════════════════════ */}
        <Text
          style={[styles.sectionHeader, { color: colors.primary, fontSize: scaled(13) }]}
          accessibilityRole="header"
        >
          {t("settings_language")}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.settingDesc, { color: colors.textMuted, fontSize: scaled(13) }]}>
            {t("settings_language_desc")}
          </Text>

          <View style={styles.languageGrid}>
            {LANGUAGES.map((lang) => {
              const isActive = language === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.languageCard,
                    {
                      backgroundColor: isActive ? colors.primary : colors.surfaceAlt,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => handleLanguageChange(lang)}
                  accessibilityLabel={`Select ${LANGUAGE_LABELS[lang]} language`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text
                    style={[
                      styles.languageNative,
                      {
                        color: isActive ? "#fff" : colors.text,
                        fontSize: scaled(16),
                      },
                    ]}
                  >
                    {LANGUAGE_LABELS[lang]}
                  </Text>
                  <Text
                    style={[
                      styles.languageEnglish,
                      {
                        color: isActive ? "rgba(255,255,255,0.7)" : colors.textMuted,
                        fontSize: scaled(11),
                      },
                    ]}
                  >
                    {lang === "en"
                      ? "Default"
                      : lang === "ga"
                      ? "Irish"
                      : lang === "ar"
                      ? "Arabic · RTL"
                      : lang === "zh"
                      ? "Chinese"
                      : lang === "hi"
                      ? "Hindi"
                      : "French"}
                  </Text>

                  {isActive && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#fff"
                      style={styles.langCheck}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ══════════════════════════════════════════════
            ACCOUNT SECTION
           ══════════════════════════════════════════════ */}
        <Text
          style={[styles.sectionHeader, { color: colors.primary, fontSize: scaled(13) }]}
          accessibilityRole="header"
        >
          {t("settings_account")}
        </Text>

        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: colors.danger }]}
          onPress={handleSignOut}
          accessibilityLabel={t("settings_sign_out")}
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={scaled(20)} color="#fff" />
          <Text style={[styles.signOutText, { fontSize: scaled(15) }]}>
            {t("settings_sign_out")}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 16, paddingBottom: 40 },

  screenTitle: {
    fontWeight: "700",
    marginBottom: 20,
  },

  sectionHeader: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },

  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  settingLabel: {
    fontWeight: "600",
    marginBottom: 10,
  },
  settingDesc: {
    marginBottom: 12,
  },
  fontRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  fontChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  fontChipText: {
    fontWeight: "600",
  },
  previewBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 4,
  },

  divider: {
    height: 1,
    marginVertical: 12,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
  },
  toggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontWeight: "500",
  },
  toggleDesc: {
    marginTop: 2,
  },

  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  languageCard: {
    width: "47%" as any,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    position: "relative",
  },
  languageNative: {
    fontWeight: "700",
  },
  languageEnglish: {
    marginTop: 2,
  },
  langCheck: {
    position: "absolute",
    top: 10,
    right: 10,
  },

  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  signOutText: {
    color: "#fff",
    fontWeight: "700",
  },
});