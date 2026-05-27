import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Check, Info, X } from "lucide-react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";

export type ToastVariant = "success" | "error" | "info";
type ToastInput = { variant: ToastVariant; message: string };
type ToastState = (ToastInput & { id: number }) | null;

// Auto-dismiss window (§12.12).
const DISMISS_MS = 3000;

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const VARIANT_BG: Record<ToastVariant, string> = {
  success: colors.success[500],
  error: colors.danger[500],
  info: colors.neutral[800],
};

function ToastView({ variant, message }: ToastInput) {
  const insets = useSafeAreaInsets();
  const Icon = variant === "success" ? Check : variant === "error" ? X : Info;

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      style={[
        shadows.floating,
        {
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          right: 16,
          backgroundColor: VARIANT_BG[variant],
          borderRadius: 16,
        },
      ]}
    >
      <View className="flex-row items-center gap-2 p-4">
        <Icon size={20} color="#FFFFFF" />
        <Text className="flex-1 font-sans-medium text-sm text-white">{message}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * App-wide toast (§12.12). Mounted once at the root; trigger from anywhere via
 * `const toast = useToast(); toast({ variant, message })`. One toast at a time —
 * a new call replaces the current one and resets the 3s timer.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);

  const show = useCallback((t: ToastInput) => {
    const id = Date.now();
    setToast({ ...t, id });
    setTimeout(() => {
      // Only clear if this is still the active toast (a newer one may have
      // replaced it and armed its own timer).
      setToast((cur) => (cur?.id === id ? null : cur));
    }, DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? <ToastView key={toast.id} variant={toast.variant} message={toast.message} /> : null}
    </ToastContext.Provider>
  );
}
