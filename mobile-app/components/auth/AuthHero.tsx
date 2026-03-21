import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { authColors, authTypography } from "@/constants/auth-theme";

type AuthHeroProps = {
  title: string;
  subtitle: string;
};

export function AuthHero({ title, subtitle }: AuthHeroProps) {
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[authColors.black, authColors.charcoal]}
        start={{ x: 0.2, y: 0.05 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.noiseOverlay} />

        <View style={styles.patternBlock}>
          <View style={styles.patternRow}>
            <View style={[styles.patternCell, styles.patternGold]} />
            <View style={[styles.patternCell, styles.patternBlack]} />
            <View style={[styles.patternCell, styles.patternGold]} />
            <View style={[styles.patternCell, styles.patternBlack]} />
          </View>
          <View style={styles.patternRow}>
            <View style={[styles.patternCell, styles.patternBlack]} />
            <View style={[styles.patternCell, styles.patternGold]} />
            <View style={[styles.patternCell, styles.patternBlack]} />
            <View style={[styles.patternCell, styles.patternGold]} />
          </View>
        </View>

        <Image
          source={require("../../assets/images/tus.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={authTypography.heroHeadline}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </LinearGradient>
      <View style={styles.goldDivider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "stretch",
    marginHorizontal: -24,
    marginBottom: 24,
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 42,
    minHeight: 300,
    position: "relative",
    overflow: "hidden",
  },
  noiseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: authColors.heroOverlay,
  },
  patternBlock: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 120,
    height: 96,
  },
  patternRow: {
    flexDirection: "row",
  },
  patternCell: {
    width: 30,
    height: 48,
  },
  patternGold: {
    backgroundColor: authColors.gold,
  },
  patternBlack: {
    backgroundColor: "#000000",
  },
  logo: {
    width: 86,
    height: 86,
    marginBottom: 18,
  },
  subtitle: {
    ...authTypography.heroSubtitle,
    marginTop: 14,
    maxWidth: 320,
  },
  goldDivider: {
    height: 4,
    marginHorizontal: -24,
    backgroundColor: authColors.gold,
  },
});
