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

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:5000"
    : "http://192.168.0.246:5000"; // 🔥 CHANGE IF YOUR IP CHANGES

export default function FrontPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"none" | "login" | "register">("none");
  const [role, setRole] = useState<string>("");
  const [rolePassword, setRolePassword] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const validateEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

  // 🔹 REGISTER
  const handleRegister = async () => {
    if (!role) return alert("Please select an account type.");
    if (!email) return alert("Please enter your email.");
    if (!validateEmail(email)) return alert("Invalid email format.");
    if (!password) return alert("Please enter a password.");
    if (password.length < 6)
      return alert("Password must be at least 6 characters.");
    if (password !== confirmPassword)
      return alert("Passwords do not match.");

    if (role === "educator" && rolePassword !== "TeacherTus2026")
      return alert("Educator access password incorrect.");

    if (role === "admin" && rolePassword !== "Admins2026")
      return alert("Admin access password incorrect.");

    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Registration failed.");
        return;
      }

      alert("Account created successfully!");
      setMode("login");
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

      // ✅ Store token per platform
      if (Platform.OS === "web") {
        localStorage.setItem("token", data.token);
      } else {
        await SecureStore.setItemAsync("token", data.token);
      }

      alert("Login successful!");
      router.replace("/dashboard");
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
          <Text style={styles.label}>Select Account Type</Text>

          {[
            { key: "working", label: "Working Professionals" },
            { key: "returning", label: "Return to Learning Adults" },
            { key: "parttime", label: "Part Time Students" },
            { key: "educator", label: "Educators" },
            { key: "admin", label: "Administrators" },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.roleCard,
                role === item.key && styles.roleCardSelected,
              ]}
              onPress={() => setRole(item.key)}
            >
              <Text
                style={[
                  styles.roleText,
                  role === item.key && styles.roleTextSelected,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          {(role === "educator" || role === "admin") && (
            <TextInput
              placeholder="Enter Role Access Password"
              style={styles.input}
              secureTextEntry
              value={rolePassword}
              onChangeText={setRolePassword}
            />
          )}

          <TextInput
            placeholder="Email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
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
        </View>
      )}

      {mode === "login" && (
        <View style={styles.formContainer}>
          <TextInput
            placeholder="Email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
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
            <Text style={styles.primaryButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
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
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 30,
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
  },
  label: {
    fontWeight: "600",
    marginBottom: 12,
  },
  roleCard: {
    backgroundColor: "#f3f4f6",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  roleCardSelected: {
    backgroundColor: "#2563eb",
  },
  roleText: {
    color: "#374151",
  },
  roleTextSelected: {
    color: "#ffffff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  primaryButton: {
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
});