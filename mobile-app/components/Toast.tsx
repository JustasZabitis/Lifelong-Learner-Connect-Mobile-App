/**
 * Toast.tsx — Global in-app notification system
 *
 * Replaces all native Alert.alert / window.alert / window.confirm calls with
 * polished, on-brand toasts and confirmation sheets that feel native to the app.
 *
 * USAGE
 * ─────
 * 1. Wrap your root layout with <ToastProvider> (already done in _layout.tsx)
 * 2. In any component:
 *      const { showToast, confirm } = useToast();
 *      showToast("Saved!", "success");
 *      await confirm("Delete this item?", { danger: true });
 *
 * TYPES
 * ─────
 *  showToast(message, type?, title?)
 *    type: "success" | "error" | "warning" | "info"   (default: "info")
 *
 *  confirm(message, options?) → Promise<boolean>
 *    options.title      — modal heading      (default: "Confirm")
 *    options.confirmText — confirm button    (default: "Confirm")
 *    options.cancelText  — cancel button     (default: "Cancel")
 *    options.danger      — red confirm btn   (default: false)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { authColors } from "../constants/auth-theme";

// ─── Theme tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:      authColors.white,
  black:   authColors.black,
  charcoal:authColors.charcoal,
  gold:    authColors.gold,
  muted:   authColors.mutedText,
  border:  authColors.cardBorder,

  success: "#16A34A",
  successBg:"#F0FDF4",
  successBorder:"#BBF7D0",

  error:   "#DC2626",
  errorBg: "#FEF2F2",
  errorBorder:"#FECACA",

  warning: "#D97706",
  warningBg:"#FFFBEB",
  warningBorder:"#FDE68A",

  info:    "#2563EB",
  infoBg:  "#EFF6FF",
  infoBorder:"#BFDBFE",

  overlayBg:"rgba(10,10,12,0.45)",
  sheetBg: authColors.white,
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info";

interface ToastEntry {
  id: number;
  message: string;
  title?: string;
  type: ToastType;
}

interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, title?: string) => void;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ─── Toast item visual config ─────────────────────────────────────────────────

const TYPE_CONFIG: Record<ToastType, {
  icon: string; color: string; bg: string; border: string;
}> = {
  success: { icon: "✓", color: C.success, bg: C.successBg, border: C.successBorder },
  error:   { icon: "✕", color: C.error,   bg: C.errorBg,   border: C.errorBorder   },
  warning: { icon: "!", color: C.warning, bg: C.warningBg, border: C.warningBorder },
  info:    { icon: "i", color: C.info,    bg: C.infoBg,    border: C.infoBorder    },
};

// ─── Single animated toast item ───────────────────────────────────────────────

function ToastItem({
  entry,
  onDismiss,
}: {
  entry: ToastEntry;
  onDismiss: (id: number) => void;
}) {
  const cfg = TYPE_CONFIG[entry.type];
  const translateY = useRef(new Animated.Value(-20)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const progress   = useRef(new Animated.Value(1)).current;

  // Animate in
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar drains over 4 seconds, then animate out
    Animated.timing(progress, {
      toValue: 0,
      duration: 4000,
      easing: Easing.linear,
      useNativeDriver: false, // width animation can't use native driver
    }).start(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -16,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss(entry.id));
    });
  }, []);

  const dismiss = () => {
    progress.stopAnimation();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -16,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(entry.id));
  };

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      {/* Icon badge */}
      <View style={[styles.toastIconWrap, { backgroundColor: cfg.color }]}>
        <Text style={styles.toastIconText}>{cfg.icon}</Text>
      </View>

      {/* Content */}
      <View style={styles.toastContent}>
        {entry.title ? (
          <Text style={[styles.toastTitle, { color: cfg.color }]}>
            {entry.title}
          </Text>
        ) : null}
        <Text style={styles.toastMessage}>{entry.message}</Text>
      </View>

      {/* Dismiss ✕ */}
      <Pressable onPress={dismiss} style={styles.toastClose} hitSlop={12}>
        <Text style={[styles.toastCloseText, { color: cfg.color }]}>✕</Text>
      </Pressable>

      {/* Progress bar */}
      <Animated.View
        style={[
          styles.toastProgress,
          { backgroundColor: cfg.color, width: progressWidth },
        ]}
      />
    </Animated.View>
  );
}

// ─── Confirmation sheet ────────────────────────────────────────────────────────

interface ConfirmState {
  visible: boolean;
  message: string;
  options: Required<ConfirmOptions>;
  resolve: ((v: boolean) => void) | null;
}

function ConfirmSheet({
  state,
  onResolve,
}: {
  state: ConfirmState;
  onResolve: (v: boolean) => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (state.visible) {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 140,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [state.visible]);

  const { title, confirmText, cancelText, danger } = state.options;

  // Render nothing when not visible — no Modal so no touch interception
  if (!state.visible) return null;

  return (
    // Absolutely-positioned overlay inside the root View wrapper
    <View style={styles.overlay} pointerEvents="auto">
      <Animated.View
        style={[
          styles.sheet,
          { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Gold accent bar */}
        <View style={styles.sheetAccent} />

        {/* Icon */}
        <View style={[
          styles.sheetIconWrap,
          { backgroundColor: danger ? C.errorBg : C.infoBg },
        ]}>
          <Text style={[
            styles.sheetIconText,
            { color: danger ? C.error : C.info },
          ]}>
            {danger ? "⚠" : "?"}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.sheetTitle}>{title}</Text>

        {/* Message */}
        <Text style={styles.sheetMessage}>{state.message}</Text>

        {/* Divider */}
        <View style={styles.sheetDivider} />

        {/* Buttons */}
        <View style={styles.sheetButtons}>
          <Pressable
            style={({ pressed }) => [
              styles.sheetBtn,
              styles.sheetBtnCancel,
              pressed && styles.sheetBtnPressed,
            ]}
            onPress={() => onResolve(false)}
          >
            <Text style={styles.sheetBtnCancelText}>{cancelText}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.sheetBtn,
              styles.sheetBtnConfirm,
              { backgroundColor: danger ? C.error : C.charcoal },
              pressed && styles.sheetBtnPressed,
            ]}
            onPress={() => onResolve(true)}
          >
            <Text style={styles.sheetBtnConfirmText}>{confirmText}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

let _nextId = 1;

const DEFAULT_CONFIRM_OPTIONS: Required<ConfirmOptions> = {
  title: "Confirm",
  confirmText: "Confirm",
  cancelText: "Cancel",
  danger: false,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    visible: false,
    message: "",
    options: DEFAULT_CONFIRM_OPTIONS,
    resolve: null,
  });

  const showToast = useCallback(
    (message: string, type: ToastType = "info", title?: string) => {
      const id = _nextId++;
      setToasts((prev) => [...prev.slice(-3), { id, message, title, type }]);
    },
    []
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirm = useCallback(
    (message: string, options?: ConfirmOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmState({
          visible: true,
          message,
          options: { ...DEFAULT_CONFIRM_OPTIONS, ...options },
          resolve,
        });
      });
    },
    []
  );

  const handleConfirmResolve = useCallback((value: boolean) => {
    setConfirmState((prev) => {
      prev.resolve?.(value);
      return { ...prev, visible: false, resolve: null };
    });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, confirm }}>
      {/*
        Root wrapper — flex:1 fills the screen.
        Everything (children, toasts, confirm sheet) is stacked inside here
        using position:absolute so NO Modal is ever used (Modals block touch on native).
      */}
      <View style={styles.root}>
        {children}

        {/* Toast stack — floats above content, doesn't block touches on empty areas */}
        <View style={styles.toastStack} pointerEvents="box-none">
          {toasts.map((t) => (
            <ToastItem key={t.id} entry={t} onDismiss={dismiss} />
          ))}
        </View>

        {/* Confirm sheet — full-screen overlay inside root, only rendered when visible */}
        <ConfirmSheet state={confirmState} onResolve={handleConfirmResolve} />
      </View>
    </ToastContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Root wrapper — fills the entire screen, all overlays are children of this
  root: {
    flex: 1,
  },

  // ── Toast stack — absolutely positioned at top, passes touches through to children
  toastStack: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 32,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 10,
    pointerEvents: "box-none",
  } as any,

  // ── Toast card
  toast: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    overflow: "hidden",
    shadowColor: "rgba(0,0,0,0.12)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },

  toastIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  toastIconText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  toastContent: {
    flex: 1,
    gap: 1,
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  toastMessage: {
    fontSize: 13,
    color: authColors.bodyText,
    lineHeight: 18,
  },

  toastClose: {
    padding: 4,
    flexShrink: 0,
  },
  toastCloseText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Progress bar — sits at the very bottom of the toast card
  toastProgress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 2,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    opacity: 0.55,
  },

  // ── Confirm sheet overlay — absolutely fills the root View, sits above everything
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.overlayBg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 99999,
  },

  sheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: C.sheetBg,
    borderRadius: 20,
    overflow: "hidden",
    paddingBottom: 20,
    shadowColor: "rgba(0,0,0,0.22)",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 12,
  },

  sheetAccent: {
    height: 3,
    backgroundColor: C.gold,
    width: "100%",
  },

  sheetIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 24,
    marginBottom: 14,
  },
  sheetIconText: {
    fontSize: 24,
    fontWeight: "700",
  },

  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: authColors.black,
    textAlign: "center",
    letterSpacing: 0.2,
    paddingHorizontal: 24,
  },
  sheetMessage: {
    fontSize: 14,
    color: authColors.mutedText,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 24,
  },

  sheetDivider: {
    height: 1,
    backgroundColor: authColors.cardBorder,
    marginTop: 20,
    marginHorizontal: 0,
  },

  sheetButtons: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  sheetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBtnPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },

  sheetBtnCancel: {
    backgroundColor: authColors.inputBg,
    borderWidth: 1,
    borderColor: authColors.cardBorder,
  },
  sheetBtnCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: authColors.bodyText,
  },

  sheetBtnConfirm: {
    backgroundColor: authColors.charcoal,
  },
  sheetBtnConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
});
