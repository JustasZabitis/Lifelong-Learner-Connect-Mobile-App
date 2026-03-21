import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
} from "react-native";

import { authColors, authShadows, authTypography } from "@/constants/auth-theme";

type AuthButtonProps = PressableProps & {
  label: string;
  variant?: "primary" | "secondary";
};

export function AuthButton({
  label,
  variant = "primary",
  style,
  ...props
}: AuthButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateScale = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      damping: 18,
      stiffness: 260,
      mass: 0.35,
      useNativeDriver: true,
    }).start();
  };

  const isPrimary = variant === "primary";

  return (
    <Animated.View style={[styles.shell, { transform: [{ scale }] }]}>
      <Pressable
        {...props}
        onPressIn={(event) => {
          animateScale(0.98);
          props.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animateScale(1);
          props.onPressOut?.(event);
        }}
        style={({ pressed }) => [
          styles.base,
          isPrimary ? styles.primary : styles.secondary,
          pressed && styles.pressed,
          style,
        ]}
      >
        <Text
          style={[
            authTypography.buttonText,
            isPrimary ? styles.primaryText : styles.secondaryText,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: "100%",
  },
  base: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: authColors.black,
    borderColor: "#121217",
    ...authShadows.button,
  },
  secondary: {
    backgroundColor: authColors.inputBg,
    borderColor: authColors.inputBorder,
  },
  primaryText: {
    color: authColors.gold,
  },
  secondaryText: {
    color: authColors.black,
  },
  pressed: {
    opacity: 0.88,
  },
});
