import React, { useEffect } from "react";
import { Platform, ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
import * as SecureStore from "expo-secure-store";

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const redirectUser = async () => {
      let token;

      if (Platform.OS === "web") {
        token = localStorage.getItem("token");
      } else {
        token = await SecureStore.getItemAsync("token");
      }

      if (!token) {
        router.replace("/");
        return;
      }

      const decoded = jwtDecode<TokenPayload>(token);

      switch (decoded.role) {
        case "working":
          router.replace("/working-dashboard");
          break;
        case "returning":
          router.replace("/returning-dashboard");
          break;
        case "parttime":
          router.replace("/parttime-dashboard");
          break;
        case "educator":
          router.replace("/educator-dashboard");
          break;
        case "admin":
          router.replace("/admin-dashboard");
          break;
        default:
          router.replace("/");
      }
    };

    redirectUser();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}