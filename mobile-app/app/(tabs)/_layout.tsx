import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";

export default function TabsLayout() {
  const { isEnabled } = useFeatureFlags();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="announcements"
        options={{
          title: "Announcements",
          href: isEnabled("announcements") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="megaphone-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          href: isEnabled("messages") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="competitions"
        options={{
          title: "Compete",
          href: isEnabled("competitions") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          href: isEnabled("progress") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="trending-up-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="resources"
        options={{
          title: "Resources",
          href: isEnabled("resources") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          href: isEnabled("calendar") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="forum"
        options={{
          title: "Forum",
          href: isEnabled("forum") ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
