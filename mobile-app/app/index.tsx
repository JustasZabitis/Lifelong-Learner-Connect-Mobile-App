import React from "react";
import {View,Text,TouchableOpacity,StyleSheet,Image,} from "react-native";

export default function FrontPage() {
  return (
    <View style={styles.container}>
      {/* Top-left logo */}
      <Image
        source={require("../assets/images/tus.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* App Title */}
      <Text style={styles.title}>Lifelong Learner Connect</Text>

      {/* Tagline */}
      <Text style={styles.tagline}>
        Stay connected. Stay learning. Anytime, anywhere.
      </Text>

      {/* Primary Actions */}
      <TouchableOpacity style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Sign In</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Create Account</Text>
      </TouchableOpacity>

      {/* Footer */}
      <Text style={styles.footerText}>
        Built for lifelong learners & educators
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  //  TUS logo (top-left)
  logo: {
    position: "absolute",
    top: 40,
    left: 20,
    width: 150,
    height: 150,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 40,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  secondaryButton: {
    width: "100%",
    backgroundColor: "#f3f4f6",
    paddingVertical: 16,
    borderRadius: 16,
  },
  secondaryButtonText: {
    color: "#2563eb",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  footerText: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 40,
  },
});
