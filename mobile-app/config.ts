import { Platform } from "react-native";

// ─── Central config ───────────────────────────────────────────────────────────
// This detects where the app is running and points to the right backend.
//
// On Render (production): the web app is served from onrender.com, so we
// check the current URL. If it contains "onrender.com" we know we're deployed.
//
// Locally: falls back to localhost (web) or your machine's IP (mobile).

const MOBILE_IP = "192.168.0.246"; // update this when your IP changes

// ── Your Render backend URL — update this after deploying ──
const RENDER_BACKEND_URL = "https://lifelong-learner-connect-mobile-app.onrender.com";

// figure out if we're running on Render or locally
const isRendered = Platform.OS === "web" &&
  typeof window !== "undefined" &&
  window.location?.hostname?.includes("onrender.com");

export const BASE_URL = isRendered
  ? RENDER_BACKEND_URL
  : Platform.OS === "web"
    ? "http://localhost:5000"
    : `http://${MOBILE_IP}:5000`;

// token helpers
export { default as SecureStore } from "expo-secure-store";