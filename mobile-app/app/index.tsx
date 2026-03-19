import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { BASE_URL } from "../config";

export default function FrontPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"none" | "login" | "register">("none");

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
      <Image
        source={require("../assets/images/tus.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>Lifelong Learner Connect</Text>
      <Text style={styles.tagline}>
        Stay connected. Stay learning. Anytime, anywhere.
      </Text>

      {mode === "none" && (
        <>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setMode("login")}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setMode("register")}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === "register" && (
        <View style={styles.formContainer}>
          <TextInput
            placeholder="Email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            placeholder="Password"
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TextInput
            placeholder="Confirm Password"
            style={styles.input}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleRegister}
          >
            <Text style={styles.primaryButtonText}>Register</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMode("none"); setPassword(""); setConfirmPassword(""); }}>
            <Text style={styles.linkText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === "login" && (
        <View style={styles.formContainer}>
          <TextInput
            placeholder="Email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            placeholder="Password"
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleLogin}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMode("none"); setPassword(""); }}>
            <Text style={styles.linkText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  tagline: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 6,
    marginBottom: 30,
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    backgroundColor: "#f9fafb",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontWeight: "700",
    fontSize: 16,
  },
  linkText: {
    color: "#2563eb",
    textAlign: "center",
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
  },
});