import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, Platform, Pressable, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { BASE_URL } from "../config";
import { AuthHero } from "@/components/auth/AuthHero";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthButton } from "@/components/auth/AuthButton";
import { authColors, authTypography } from "@/constants/auth-theme";

export default function FrontPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [mode, setMode] = useState<"none" | "login" | "register">("none");
  const showWebSideImage = Platform.OS === "web" && width >= 960 && mode === "none";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const validateEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

  // 🔹 REGISTER — always creates a student account
  const handleRegister = async () => {
    if (!email) return alert("Please enter your email.");
    if (!validateEmail(email)) return alert("Invalid email format.");
    if (!password) return alert("Please enter a password.");
    if (password.length < 6)
      return alert("Password must be at least 6 characters.");
    if (password !== confirmPassword)
      return alert("Passwords do not match.");

    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: "working" }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Registration failed.");
        return;
      }

      alert("Account created successfully!");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("REGISTER ERROR:", error);
      alert("Unable to connect to server.");
    }
  };

  // 🔹 LOGIN
  const handleLogin = async () => {
    if (!email) return alert("Please enter your email.");
    if (!password) return alert("Please enter your password.");

    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Invalid credentials.");
        return;
      }

      if (Platform.OS === "web") {
        localStorage.setItem("token", data.token);
      } else {
        await SecureStore.setItemAsync("token", data.token);
      }

      alert("Login successful!");
      router.replace("./(tabs)/dashboard");
    } catch (error) {
      console.error("LOGIN ERROR:", error);
      alert("Unable to connect to server.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AuthHero
        title="Lifelong Learner Connect"
        subtitle="Stay connected. Stay learning. Anytime, anywhere."
      />

      <View style={styles.contentSection}>
        {mode === "none" && (
          <View style={styles.webNoneRow}>
            <View style={styles.webCardColumn}>
              <AuthCard
                title="Premium learning, simplified."
                subtitle="Access your account and continue where you left off."
              >
                <AuthButton label="Sign In" onPress={() => setMode("login")} />
                <View style={styles.buttonSpacer} />
                <AuthButton
                  label="Create Account"
                  variant="secondary"
                  onPress={() => setMode("register")}
                />
              </AuthCard>
            </View>

            {showWebSideImage && (
              <View style={styles.webImageColumn}>
                <video
                  src="/videos/TUS_CAO_web_video_2-720p.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  style={styles.sideVideo as never}
                />
                <View style={styles.sideImageOverlay} />
              </View>
            )}
          </View>
        )}

        {mode === "register" && (
          <AuthCard
            title="Create account"
            subtitle="Join Lifelong Learner Connect and start exploring."
          >
            <TextInput
              placeholder="Email"
              placeholderTextColor="#80808A"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              placeholder="Password"
              placeholderTextColor="#80808A"
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TextInput
              placeholder="Confirm Password"
              placeholderTextColor="#80808A"
              style={styles.input}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <AuthButton label="Register" onPress={handleRegister} />
            <Pressable
              onPress={() => {
                setMode("none");
                setPassword("");
                setConfirmPassword("");
              }}
              style={styles.backPressable}
            >
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </AuthCard>
        )}

        {mode === "login" && (
          <AuthCard
            title="Welcome back"
            subtitle="Sign in to continue your learning journey."
          >
            <TextInput
              placeholder="Email"
              placeholderTextColor="#80808A"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              placeholder="Password"
              placeholderTextColor="#80808A"
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <AuthButton label="Sign In" onPress={handleLogin} />
            <Pressable
              onPress={() => {
                setMode("none");
                setPassword("");
              }}
              style={styles.backPressable}
            >
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </AuthCard>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 0,
    paddingHorizontal: 24,
    paddingBottom: 32,
    backgroundColor: authColors.offWhite,
  },
  contentSection: {
    width: "100%",
    marginTop: -4,
  },
  webNoneRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 22,
  },
  webCardColumn: {
    width: 500,
    maxWidth: "100%",
  },
  webImageColumn: {
    flex: 1,
    height: 500,
    minHeight: 500,
    maxHeight: 500,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E4E4E8",
    backgroundColor: "#DADDE2",
    position: "relative",
  },
  sideVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  sideImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  input: {
    borderWidth: 1,
    borderColor: authColors.inputBorder,
    borderRadius: 13,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    color: authColors.black,
    backgroundColor: authColors.inputBg,
  },
  buttonSpacer: {
    height: 2,
  },
  backPressable: {
    alignItems: "center",
    marginTop: 2,
    paddingVertical: 4,
  },
  backText: {
    ...authTypography.body,
    color: authColors.mutedText,
    fontWeight: "600",
  },
});