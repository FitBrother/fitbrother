import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Camera, Loader2, Mic, Send, Square, ScanLine } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import {
  cancelRecording,
  startRecording,
  stopRecording,
  type RecorderHandle,
} from "@/lib/audio/recorder";
import { MealRecorder, type RecorderState } from "./MealRecorder";
import { RecorderLockHint } from "./RecorderLockHint";

type Props = {
  onSend: (text: string) => void;
  onAudioReady: (params: { fileUri: string; durationMs: number; ext: "m4a" | "opus" }) => void;
  onPhotoPress?: () => void;
  onScanPress?: () => void;
  disabled?: boolean;
  processing?: boolean;
  // When false, omits the bottom-fading LinearGradient. Useful inside sheets
  // where there's no scrollable list behind the composer to fade.
  showBackdropFade?: boolean;
};

type ComposerMode =
  | { kind: "idle" }
  | { kind: "recording-pressing"; handle: RecorderHandle }
  | { kind: "cancel-hint"; handle: RecorderHandle }
  | { kind: "recording-locked"; handle: RecorderHandle };

const MULTILINE_THRESHOLD = 40;
const HOLD_MS = 200;
const CANCEL_PX = 80;
const LOCK_PX = 60;
const MIN_RECORDING_MS = 500;
const MAX_RECORDING_MS = 600_000;

function recorderStateOf(mode: ComposerMode): RecorderState | null {
  switch (mode.kind) {
    case "recording-pressing":
      return "pressing";
    case "cancel-hint":
      return "cancel-hint";
    case "recording-locked":
      return "locked";
    default:
      return null;
  }
}

export function MealComposer({
  onSend,
  onAudioReady,
  onPhotoPress,
  onScanPress,
  disabled,
  processing,
  showBackdropFade = true,
}: Props) {
  const [text, setText] = useState("");
  const [contentHeight, setContentHeight] = useState(0);
  const [mode, setMode] = useState<ComposerMode>({ kind: "idle" });
  const [durationMs, setDurationMs] = useState(0);
  const meterLevel = useSharedValue<number>(-160);
  const hasText = text.trim().length > 0;
  const isMultiline = contentHeight > MULTILINE_THRESHOLD;
  const insets = useSafeAreaInsets();
  const rotation = useSharedValue(0);

  // Timer interval ref so we can clear it on stop/cancel without keeping
  // stale closures.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Pending hold-timer: cleared if user releases before 200ms threshold.
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Single source of truth for the current handle in JS callbacks. The mode
  // object also carries it, but a ref avoids stale closures inside the
  // gesture worklet → runOnJS bridge.
  const handleRef = useRef<RecorderHandle | null>(null);
  // Set true once the 200ms hold fires (and beginRecording is called).
  const holdFiredRef = useRef(false);

  // Spin animation for the processing state on the send button.
  useEffect(() => {
    if (processing) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      rotation.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) });
    }
  }, [processing, rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount: if the screen leaves while recording, drop the file.
  useEffect(() => {
    return () => {
      stopTimer();
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (handleRef.current) {
        cancelRecording(handleRef.current).catch(() => {});
        handleRef.current = null;
      }
    };
  }, [stopTimer]);

  const beginRecording = useCallback(async () => {
    try {
      const h = await startRecording((level) => {
        meterLevel.value = level;
      });
      handleRef.current = h;
      setMode({ kind: "recording-pressing", handle: h });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setDurationMs(0);
      const started = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - started;
        setDurationMs(elapsed);
        if (elapsed >= MAX_RECORDING_MS) {
          // Hard cap: force stop and ship.
          finishAndSend();
        }
      }, 100);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "PERMISSION_DENIED") {
        Alert.alert(
          "Microfone bloqueado",
          "Habilite o microfone nas configurações pra gravar refeições.",
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Abrir Configurações", onPress: () => Linking.openSettings() },
          ],
        );
      } else {
        // Anything else (audio mode setup, prepareToRecord) — surface it so
        // we don't fail silently like before.
        // eslint-disable-next-line no-console
        console.warn("[MealComposer] startRecording failed:", err);
      }
      handleRef.current = null;
      setMode({ kind: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meterLevel]);

  const finishAndSend = useCallback(async () => {
    const h = handleRef.current;
    handleRef.current = null;
    stopTimer();
    setMode({ kind: "idle" });
    if (!h) return;
    try {
      const result = await stopRecording(h);
      if (result.durationMs < MIN_RECORDING_MS) {
        // Too short — silently drop. User likely tapped instead of held.
        return;
      }
      onAudioReady({
        fileUri: result.fileUri,
        durationMs: result.durationMs,
        ext: result.ext,
      });
    } catch {
      // Recorder errors are non-fatal; UI returns to idle and user can retry.
    }
  }, [onAudioReady, stopTimer]);

  const finishAndCancel = useCallback(async () => {
    const h = handleRef.current;
    handleRef.current = null;
    stopTimer();
    setMode({ kind: "idle" });
    if (!h) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    await cancelRecording(h);
  }, [stopTimer]);

  // -- All gesture callbacks must be declared BEFORE `pan` --

  const scheduleHoldCheck = useCallback(() => {
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      holdFiredRef.current = true;
      beginRecording();
    }, HOLD_MS);
  }, [beginRecording]);

  const handlePanUpdate = useCallback((tx: number, ty: number) => {
    if (!handleRef.current) return;
    setMode((current) => {
      if (current.kind === "recording-locked") return current;

      // Slide up beyond threshold → lock.
      if (ty <= -LOCK_PX) {
        const h = "handle" in current ? current.handle : handleRef.current!;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return { kind: "recording-locked", handle: h };
      }

      // Slide left beyond threshold → cancel-hint. Slide back → pressing.
      const isCancelHint = current.kind === "cancel-hint";
      if (tx <= -CANCEL_PX && !isCancelHint) {
        const h = "handle" in current ? current.handle : handleRef.current!;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return { kind: "cancel-hint", handle: h };
      }
      if (tx > -CANCEL_PX && isCancelHint) {
        const h = "handle" in current ? current.handle : handleRef.current!;
        return { kind: "recording-pressing", handle: h };
      }
      return current;
    });
  }, []);

  const handlePanEnd = useCallback(() => {
    // Cancel the pending hold timer if user released BEFORE 200ms — this is
    // the tap-vs-hold disambiguation.
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    // If hold never fired, there's nothing to stop. Bail.
    if (!holdFiredRef.current) return;
    holdFiredRef.current = false;

    setMode((current) => {
      switch (current.kind) {
        case "recording-pressing":
          finishAndSend();
          return current;
        case "cancel-hint":
          finishAndCancel();
          return current;
        case "recording-locked":
          // Locked: ignore release entirely. Stop/cancel comes from taps.
          return current;
        case "idle":
        default:
          return current;
      }
    });
  }, [finishAndCancel, finishAndSend]);

  // Pan gesture lives on the mic button. minDistance(0) forces the gesture
  // to activate on touch-down — without it, iOS' default Pan threshold means
  // a static hold never fires `onBegin`/`onUpdate`. The mic button isn't
  // inside a scroll surface, so eager activation doesn't conflict with the
  // FlatList above it.
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      runOnJS(scheduleHoldCheck)();
    })
    .onUpdate((e) => {
      runOnJS(handlePanUpdate)(e.translationX, e.translationY);
    })
    .onEnd(() => {
      runOnJS(handlePanEnd)();
    })
    .onFinalize(() => {
      runOnJS(handlePanEnd)();
    });

  // Plain Pressable handlers for the typing path (send button).
  const handleSendText = () => {
    const value = text.trim();
    if (!value || disabled || processing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setText("");
    onSend(value);
  };

  const bottomPad = Math.max(insets.bottom - 10, 6);
  const recState = recorderStateOf(mode);
  const isRecording = recState !== null;

  // The mic button's icon changes by state:
  //   idle + no text  → Mic (held to record)
  //   idle + text     → Send
  //   processing      → spinner
  //   pressing/hint   → Mic (held)
  //   locked          → Square (tap to stop)
  const micIcon = (() => {
    if (processing)
      return (
        <Animated.View style={spinStyle}>
          <Loader2 size={22} color="#FFFFFF" />
        </Animated.View>
      );
    if (mode.kind === "recording-locked")
      return <Square size={20} color="#FFFFFF" fill="#FFFFFF" />;
    if (hasText && !isRecording) return <Send size={22} color="#FFFFFF" />;
    return <Mic size={22} color="#FFFFFF" />;
  })();

  const micAccessibilityLabel = (() => {
    if (mode.kind === "recording-pressing") return "Soltar para enviar gravação";
    if (mode.kind === "cancel-hint") return "Soltar para cancelar gravação";
    if (mode.kind === "recording-locked") return "Parar gravação";
    if (hasText) return "Enviar refeição";
    return "Gravar áudio — segure";
  })();

  return (
    <View pointerEvents="box-none">
      {showBackdropFade && (
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(248, 250, 252, 0)", "rgba(248, 250, 252, 0.85)", "rgba(248, 250, 252, 1)"]}
          locations={[0, 0.55, 1]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 120 + bottomPad,
          }}
        />
      )}

      <RecorderLockHint
        visible={mode.kind === "recording-pressing" || mode.kind === "cancel-hint"}
      />

      <View style={{ paddingBottom: bottomPad }} className="px-4 pt-3">
        <View className="flex-row items-end gap-3">
          {isRecording && recState ? (
            <MealRecorder
              state={recState}
              durationMs={durationMs}
              meterLevel={meterLevel}
              onCancel={mode.kind === "recording-locked" ? finishAndCancel : undefined}
            />
          ) : (
            <View
              style={shadows.floating}
              className={[
                "min-h-[64px] flex-1 justify-center rounded-[32px] bg-white px-5",
                isMultiline ? "py-3" : "",
              ].join(" ")}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                onContentSizeChange={(e) => setContentHeight(e.nativeEvent.contentSize.height)}
                placeholder="O que você comeu?"
                placeholderTextColor={colors.neutral[400]}
                multiline
                maxLength={2000}
                editable={!disabled && !processing}
                textAlignVertical="center"
                style={{ paddingTop: 0, paddingBottom: 0, includeFontPadding: false }}
                className="max-h-40 text-base font-sans text-neutral-800"
              />
            </View>
          )}

          {!hasText && !isRecording && onPhotoPress ? (
            <View className="flex-row items-center gap-2">
              {onScanPress && (
                <Pressable
                  onPress={onScanPress}
                  accessibilityLabel="Registrar por código de barras"
                  accessibilityRole="button"
                  disabled={disabled || processing}
                  style={shadows.floating}
                  className={[
                    "h-16 w-16 items-center justify-center rounded-full",
                    disabled || processing ? "bg-neutral-200" : "bg-white active:bg-neutral-100",
                  ].join(" ")}
                >
                  <ScanLine size={22} color={colors.neutral[800]} />
                </Pressable>
              )}
              <Pressable
                onPress={onPhotoPress}
                accessibilityLabel="Registrar por foto"
                accessibilityRole="button"
                disabled={disabled || processing}
                style={shadows.floating}
                className={[
                  "h-16 w-16 items-center justify-center rounded-full",
                  disabled || processing ? "bg-neutral-200" : "bg-white active:bg-neutral-100",
                ].join(" ")}
              >
                <Camera size={22} color={colors.neutral[800]} />
              </Pressable>
            </View>
          ) : null}

          {hasText && !isRecording ? (
            <Pressable
              onPress={processing ? undefined : handleSendText}
              accessibilityLabel="Enviar refeição"
              accessibilityRole="button"
              disabled={disabled || processing}
              style={shadows.floating}
              className={[
                "h-16 w-16 items-center justify-center rounded-full",
                disabled || processing ? "bg-neutral-200" : "bg-primary-400 active:bg-primary-500",
              ].join(" ")}
            >
              {micIcon}
            </Pressable>
          ) : mode.kind === "recording-locked" ? (
            <Pressable
              onPress={finishAndSend}
              accessibilityLabel={micAccessibilityLabel}
              accessibilityRole="button"
              style={shadows.floating}
              className="h-16 w-16 items-center justify-center rounded-full bg-danger-500 active:bg-danger-600"
            >
              {micIcon}
            </Pressable>
          ) : (
            <GestureDetector gesture={pan}>
              <Animated.View
                accessible
                accessibilityLabel={micAccessibilityLabel}
                accessibilityRole="button"
                style={shadows.floating}
                className={[
                  "h-16 w-16 items-center justify-center rounded-full",
                  isRecording ? "bg-danger-500" : "bg-primary-400 active:bg-primary-500",
                ].join(" ")}
              >
                {micIcon}
              </Animated.View>
            </GestureDetector>
          )}
        </View>
      </View>
    </View>
  );
}
