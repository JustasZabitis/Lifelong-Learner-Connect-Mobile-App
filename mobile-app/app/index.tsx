/**
 * Main login and registration screen for Lifelong Learner Connect.
 * Handles user authentication and redirects to dashboard on success.
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, Platform, Pressable, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { BASE_URL } from "../config";
import { AuthHero } from "@/components/auth/AuthHero";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthButton } from "@/components/auth/AuthButton";
import { authColors, authTypography } from "@/constants/auth-theme";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";

export default function FrontPage() {
  const router = useRouter();
  const { refresh: refreshFlags } = useFeatureFlags();
  const { width } = useWindowDimensions();

  // Track which screen to show: none (welcome), login, or register
  const [mode, setMode] = useState<"none" | "login" | "register">("none");

  // On web with wide screen, show a promotional video next to the auth card
  const showWebSideImage = Platform.OS === "web" && width >= 960 && mode === "none";

  // Form fields for both login and registration
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Simple email validation using regex
  const validateEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

  // Handles user registration (creates a student account)
  const handleRegister = async () => {
    // Validate email field
    if (!email) return alert("Please enter your email.");
    if (!validateEmail(email)) return alert("Invalid email format.");

    // Validate password field
    if (!password) return alert("Please enter a password.");
    if (password.length < 6)
      return alert("Password must be at least 6 characters.");

    // Ensure passwords match
    if (password !== confirmPassword)
      return alert("Passwords do not match.");

    try {
      // Send registration request to backend
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: "student" }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Registration failed.");
        return;
      }

      alert("Account created successfully!");
      // Switch to login screen and clear password fields
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("REGISTER ERROR:", error);
      alert("Unable to connect to server.");
    }
  };

  // Handles user login with email and password
  const handleLogin = async () => {
    // Validate required fields
    if (!email) return alert("Please enter your email.");
    if (!password) return alert("Please enter your password.");

    try {
      // Send login request to backend
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Tell browser to accept httpOnly cookies from response
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Invalid credentials.");
        return;
      }

      // Store token for future authenticated requests
      if (Platform.OS === "web") {
        // On web, store in localStorage for UI to read user role/email.
        // The httpOnly cookie handles actual authentication.
        localStorage.setItem("token", data.token);
      } else {
        // On mobile, use SecureStore for secure token persistence
        await SecureStore.setItemAsync("token", data.token);
      }

      // Fetch feature flags to load admin toggles and feature settings
      await refreshFlags();

      alert("Login successful!");
      // Navigate to dashboard on successful login
      router.replace("./(tabs)/dashboard");
    } catch (error) {
      console.error("LOGIN ERROR:", error);
      alert("Unable to connect to server.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Hero section with app name and tagline */}
      <AuthHero
        title="Lifelong Learner Connect"
        subtitle="Stay connected. Stay learning. Anytime, anywhere."
      />

      <View style={styles.contentSection}>
        {/* Welcome screen: shows login/register buttons and optional promo video */}
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

            {/* Show promotional video on web with wide screens */}
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

        {/* Registration form */}
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

        {/* Login form */}
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