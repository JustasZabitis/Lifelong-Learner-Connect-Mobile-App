/**
 * Root layout — the outermost wrapper that Expo Router renders around every screen.
 * Wraps the whole app in the FeatureFlagsProvider (so any screen can check flags)
 * and AccessibilityProvider (for font-size and contrast preferences),
 * then applies the light/dark navigation theme based on the device's colour scheme.
 * The Stack navigator handles all screen transitions.
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AccessibilityProvider } from '../contexts/AccessibilityContext';
import { FeatureFlagsProvider } from '../contexts/FeatureFlagsContext';

// Tell Expo Router which group to treat as the default anchor (the tab bar)
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // Reads the device setting so we can switch between light and dark navigation themes
  const colorScheme = useColorScheme();
  return (
    // FeatureFlagsProvider fetches feature flags from the DB once at login
    // and makes them available to every screen via useFeatureFlags()
    <FeatureFlagsProvider>
      {/* AccessibilityProvider exposes font-size and high-contrast preferences */}
      <AccessibilityProvider>
        {/* ThemeProvider picks DarkTheme or DefaultTheme based on the device setting */}
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            {/* The (tabs) group renders the bottom tab bar — header is handled per-screen */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* The modal screen slides up from the bottom on iOS */}
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          {/* StatusBar adapts its colour (light/dark icons) automatically */}
          <StatusBar style="auto" />
        </ThemeProvider>
      </AccessibilityProvider>
    </FeatureFlagsProvider>
  );
}