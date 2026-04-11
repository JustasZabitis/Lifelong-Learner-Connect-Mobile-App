import { TextStyle } from "react-native";

export const authColors = {
  gold: "#A39461",
  black: "#0E0E10",
  charcoal: "#1A1A1F",
  heroOverlay: "rgba(255,255,255,0.03)",
  white: "#FEFEFE",
  offWhite: "#F7F7F6",
  cardBorder: "#EAEAEA",
  cardShadow: "rgba(16, 24, 40, 0.08)",
  bodyText: "#2F2F33",
  mutedText: "#72727B",
  inputBorder: "#D8D8DE",
  inputBg: "#F4F4F6",
} as const;

export const authTypography: Record<string, TextStyle> = {
  heroHeadline: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: authColors.white,
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    color: "rgba(255,255,255,0.86)",
  },
  cardTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: authColors.black,
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
    color: authColors.mutedText,
  },
  buttonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
    color: authColors.bodyText,
  },
};

export const authShadows = {
  card: {
    shadowColor: authColors.cardShadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 5,
  },
  button: {
    shadowColor: "rgba(10, 10, 12, 0.18)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
} as const;

// Alias for components that reference these — keeps imports clean
export const roleBadgeColors: Record<string, { bg: string; text: string }> = {
  student:  { bg: "#E8F5E9", text: "#2E7D32" },
  educator: { bg: "#FFF8E1", text: "#F57F17" },
  admin:    { bg: "#E3F2FD", text: "#1565C0" },
};
