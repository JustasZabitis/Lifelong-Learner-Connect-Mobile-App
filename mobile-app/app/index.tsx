import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";

export default function FrontPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"none" | "login" | "register">("none");

  const [role, setRole] = useState<string>("");
  const [rolePassword, setRolePassword] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const validateEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  // 🔹 REGISTER
  const handleRegister = async () => {
    console.log("🔥 HANDLE REGISTER FIRED");

    console.log("ROLE:", role);
    console.log("EMAIL:", email);
    console.log("PASSWORD:", password);
    console.log("CONFIRM:", confirmPassword);
    console.log("ROLE PASSWORD:", rolePassword);

    if (!role) {
      alert("Please select an account type.");
      return;
    }

    if (!email) {
      alert("Please enter your email address.");
      return;
    }

    if (!validateEmail(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (!password) {
      alert("Please enter a password.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    if (role === "educator") {
      if (!rolePassword) {
        alert("Educators must enter the educator access password.");
        return;
      }

      if (rolePassword !== "TeacherTus2026") {
        alert("Educator access password is incorrect.");
        return;
      }
    }

    if (role === "admin") {
      if (!rolePassword) {
        alert("Administrators must enter the admin access password.");
        return;
      }

      if (rolePassword !== "Admins2026") {
        alert("Admin access password is incorrect.");
        return;
      }
    }

    try {
      console.log("📡 Sending register request...");

      const response = await fetch(
        "http://192.168.0.246:5000/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, role }),
        }
      );

      const data = await response.json();
      console.log("📩 Register response:", data);

      if (!response.ok) {
        alert(data.error || "Registration failed.");
        return;
      }

      alert("Account created successfully!");

      setMode("login");
      setRole("");
      setRolePassword("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.log("❌ Register error:", error);
      alert("Unable to connect to server.");
    }
  };

  // 🔹 LOGIN
  const handleLogin = async () => {
    console.log("🔥 HANDLE LOGIN FIRED");

    if (!email) {
      alert("Please enter your email.");
      return;
    }

    if (!password) {
      alert("Please enter your password.");
      return;
    }

    try {
      console.log("📡 Sending login request...");

      const response = await fetch(
        "http://192.168.0.246:5000/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();
      console.log("📩 Login response:", data);

      if (!response.ok) {
        alert(data.error || "Invalid credentials.");
        return;
      }

      alert("Login successful!");
      router.replace("/dashboard");
    } catch (error) {
      console.log("❌ Login error:", error);
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

          <View style={styles.roleContainer}>
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
          </View>

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
            autoCapitalize="none"
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

          <TouchableOpacity onPress={() => setMode("none")}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === "login" && (
        <View style={styles.formContainer}>
          <TextInput
            placeholder="Email"
            style={styles.input}
            autoCapitalize="none"
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

          <TouchableOpacity onPress={() => setMode("none")}>
            <Text style={styles.backText}>Back</Text>
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
    textAlign: "center",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 30,
  },
  formContainer: {
    width: "100%",
  },
  label: {
    fontWeight: "600",
    marginBottom: 12,
    fontSize: 16,
  },
  roleContainer: {
    width: "100%",
    marginBottom: 20,
  },
  roleCard: {
    backgroundColor: "#f3f4f6",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  roleCardSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  roleText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
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
  backText: {
    textAlign: "center",
    color: "#6b7280",
  },
});
