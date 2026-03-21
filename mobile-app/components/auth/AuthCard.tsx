import React, { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { authColors, authShadows, authTypography } from "@/constants/auth-theme";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <View style={styles.card}>
      <Text style={authTypography.cardTitle}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.cardBorder,
    backgroundColor: authColors.white,
    paddingHorizontal: 22,
    paddingVertical: 24,
    ...authShadows.card,
  },
  subtitle: {
    ...authTypography.cardSubtitle,
    marginTop: 10,
  },
  content: {
    marginTop: 24,
    gap: 14,
  },
});
