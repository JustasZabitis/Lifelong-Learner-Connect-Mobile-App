import React, { useEffect, useState } from "react";
import { Platform, ActivityIndicator, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";

import StudentDashboard from "../working-dashboard";
import EducatorDashboard from "../educator-dashboard";
import AdminDashboard from "../admin-dashboard";

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

export default function DashboardRouter() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        let token: string | null = null;

        if (Platform.OS === "web") {
          token = localStorage.getItem("token");
        } else {
          token = await SecureStore.getItemAsync("token");
        }

        if (!token) {
          setLoading(false);
          return;
        }

        const decoded = jwtDecode<TokenPayload>(token);
        setRole(decoded.role);
      } catch (error) {
        console.log("Dashboard decode error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  switch (role) {
    case "student":
      return <StudentDashboard />;
    case "educator":
      return <EducatorDashboard />;
    case "admin":
      return <AdminDashboard />;
    default:
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      );
  }
}