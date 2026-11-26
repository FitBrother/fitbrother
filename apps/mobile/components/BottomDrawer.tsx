import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Motion } from "@/lib/motion";
import { shadows } from "@/lib/shadows";

const OVERLAY_Z_INDEX = 1000;
const EXIT_FALLBACK_MS = Motion.duration.base + 100;

export function BottomDrawer({
  visible,
  onClose,
  children,
  accessibilityLabel,
  maxHeightRatio = 0.88,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  accessibilityLabel: string;
  maxHeightRatio?: number;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);
  const visibleRef = useRef(visible);

  useEffect(() => {
    visibleRef.current = visible;
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: Motion.duration.base,
        easing: Motion.easing.decelerate,
      });
      return;
    }
    const unmount = () => {
      if (!visibleRef.current) setMounted(false);
    };
    progress.value = withTiming(
      0,
      { duration: Motion.duration.base, easing: Motion.easing.accelerate },
      (finished) => {
        if (finished) runOnJS(unmount)();
      },
    );
    const fallback = setTimeout(unmount, EXIT_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [visible, progress]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => ({
    flexShrink: 1,
    transform: [{ translateY: (1 - progress.value) * height }],
  }));

  if (!visible && !mounted) return null;

  return (
    <View
      testID="bottom-drawer-overlay"
      style={[
        StyleSheet.absoluteFill,
        { zIndex: OVERLAY_Z_INDEX, pointerEvents: visible ? "box-none" : "none" },
      ]}
      accessibilityViewIsModal
      aria-modal
    >
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          className="flex-1 bg-black/40"
        />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ pointerEvents: "box-none" }}
        className="flex-1 justify-end"
      >
        <Animated.View testID="bottom-drawer-wrapper" style={panelStyle}>
          <View
            role="dialog"
            accessibilityLabel={accessibilityLabel}
            style={[shadows.floating, { maxHeight: height * maxHeightRatio }]}
            className="w-full shrink rounded-t-[26px] bg-white md:mx-auto md:w-full md:max-w-[640px]"
          >
            <View className="items-center pb-2 pt-2">
              <View className="h-1 w-9 rounded-full bg-neutral-300" />
            </View>
            {/* Height is content-sized: a flex-1 child collapses to 0, use a plain ScrollView. */}
            <View
              testID="bottom-drawer-content"
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
              className="shrink"
            >
              {children}
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
