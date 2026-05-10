import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  title: string;
  description: string;
  onPress?: () => void;
  accentColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function DashboardCard({
  title,
  description,
  onPress,
  accentColor = "#A39461",
  icon,
}: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={styles.content}>
        {icon && (
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={18} color={accentColor} />
          </View>
        )}
        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>

      {/* Chevron affordance */}
      {onPress && (
        <View style={styles.chevron}>
          <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  // Coloured left rail
  accentBar: {
    width: 4,
    alignSelf: "stretch",
  },

  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#f4f6f8",
    justifyContent: "center",
    alignItems: "center",
  },

  textWrap: {
    flex: 1,
  },

  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 3,
  },

  description: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 16,
  },

  chevron: {
    paddingRight: 14,
  },
});
