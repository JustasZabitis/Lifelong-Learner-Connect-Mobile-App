import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const MOODLE_WEB_URL = "https://moodle.midlands.tus.ie";
const OUTLOOK_WEB_URL = "https://outlook.office.com";
const MOODLE_APP_URL = "moodlemobile://moodle.midlands.tus.ie";
const OUTLOOK_APP_URL = "ms-outlook://";

const openLink = async (appUrl: string, webUrl: string) => {
  if (Platform.OS === "web") {
    // Web: always open in a new browser tab
    window.open(webUrl, "_blank");
    return;
  }

  // Mobile: try opening the app directly, fall back to browser on failure
  try {
    await Linking.openURL(appUrl);
  } catch {
    // App not installed or scheme not handled — open in browser
    Linking.openURL(webUrl);
  }
};

export default function QuickLinks() {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>Quick Links</Text>
      <View style={styles.row}>
        {/* Moodle Button */}
        <TouchableOpacity
          style={[styles.button, styles.moodleButton]}
          onPress={() => openLink(MOODLE_APP_URL, MOODLE_WEB_URL)}
          activeOpacity={0.7}
        >
          <Ionicons name="school-outline" size={24} color="#fff" />
          <Text style={styles.buttonText}>Moodle</Text>
        </TouchableOpacity>

        {/* Outlook Button */}
        <TouchableOpacity
          style={[styles.button, styles.outlookButton]}
          onPress={() => openLink(OUTLOOK_APP_URL, OUTLOOK_WEB_URL)}
          activeOpacity={0.7}
        >
          <Ionicons name="mail-outline" size={24} color="#fff" />
          <Text style={styles.buttonText}>Outlook</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  moodleButton: {
    backgroundColor: "#f48024",
  },
  outlookButton: {
    backgroundColor: "#0078d4",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});