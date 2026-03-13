import { Platform } from "react-native";

// ─── Central config ───────────────────────────────────────────────────────────
// This is the single place to change the backend URL.
// On web it hits localhost. On a physical device it needs your machine's
// local IP address — run `ipconfig` (Windows) or `ipconfig getifaddr en0` (Mac)
// to find it, then update MOBILE_IP below.

const MOBILE_IP = "192.168.0.246"; // update this when your IP changes

export const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:5000"
    : `http://${MOBILE_IP}:5000`;

// Token helpers — imported here so every screen uses the same pattern
// instead of duplicating the Platform.OS check everywhere.
export { default as SecureStore } from "expo-secure-store";