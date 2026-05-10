import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
import { useAccessibility } from "../../contexts/AccessibilityContext";

export default function TabsLayout() {
  const { isEnabled } = useFeatureFlags();
  const { colors, t } = useAccessibility();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("tab_home"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="announcements"
        options={{
          title: t("tab_announcements"),
          href: isEnabled("announcements") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="megaphone-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: t("tab_messages"),
          href: isEnabled("messages") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="competitions"
        options={{
          title: t("competitions_title"),
          href: isEnabled("competitions") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="progress"
        options={{
          title: t("tab_progress"),
          href: isEnabled("progress") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="resources"
        options={{
          title: t("tab_resources"),
          href: isEnabled("resources") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: t("tab_calendar"),
          href: isEnabled("calendar") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: t("tab_settings"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="forum"
        options={{
          title: t("tab_forum"),
          href: isEnabled("forum") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
