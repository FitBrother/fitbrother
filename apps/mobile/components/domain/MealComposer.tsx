import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
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
import { Camera, Loader2, Mic, Plus, Send, Square, ScanLine } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import {
  cancelRecording,
  startRecording,
  stopRecording,
  type AudioExtension,
  type RecorderHandle,
} from "@/lib/audio/recorder";
import { MealRecorder, type RecorderState } from "./MealRecorder";
import { RecorderLockHint } from "./RecorderLockHint";

type Props = {
  onSend: (text: string) => void;
  onAudioReady: (params: { fileUri: string; durationMs: number; ext: AudioExtension }) => void;
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
  | { kind: "recording-starting" }
  | { kind: "recording-pressing" }
  | { kind: "cancel-hint" }
  | { kind: "recording-locked" };

type GestureIntent = "pressing" | "cancel" | "lock";
type PendingAction = "send" | "cancel" | "lock" | null;

const MULTILINE_THRESHOLD = 40;
const CANCEL_PX = 80;
const LOCK_PX = 60;
const MIN_RECORDING_MS = 500;
const MAX_RECORDING_MS = 600_000;

export function classifyAudioGesture(
  tx: number,
  ty: number,
  useVerticalLockLine = Platform.OS !== "web",
): GestureIntent {
  // Crossing the lock height is a horizontal activation line: the finger
  // does not need to hit the lock icon or remain centered over the mic.
  if (useVerticalLockLine) {
    if (ty <= -LOCK_PX) return "lock";
    if (tx <= -CANCEL_PX) return "cancel";
  } else {
    const horizontalDistance = Math.abs(tx);
    const verticalDistance = Math.abs(ty);
    if (tx <= -CANCEL_PX && horizontalDistance > verticalDistance) return "cancel";
    if (ty <= -LOCK_PX && verticalDistance >= horizontalDistance) return "lock";
  }
  return "pressing";
}

export function actionAfterRecordingStarts(params: {
  mounted: boolean;
  gestureActive: boolean;
  pendingAction: PendingAction;
  tx: number;
  ty: number;
  isWeb: boolean;
}): "send" | "cancel" | "lock" | "cancel-hint" | "pressing" {
  if (!params.mounted || params.pendingAction === "cancel") return "cancel";
  if (params.pendingAction === "send") return "send";
  const intent = classifyAudioGesture(params.tx, params.ty);
  if (params.isWeb || params.pendingAction === "lock" || intent === "lock") return "lock";
  if (!params.gestureActive) return "cancel";
  return intent === "cancel" ? "cancel-hint" : "pressing";
}

function recorderStateOf(mode: ComposerMode): RecorderState | null {
  switch (mode.kind) {
    case "recording-starting":
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
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const meterLevel = useSharedValue<number>(-160);
  const hasText = text.trim().length > 0;
  const isMultiline = contentHeight > MULTILINE_THRESHOLD;
  const textInputRef = useRef<TextInput>(null);

  // A <textarea>'s scrollHeight can never read below its current
  // clientHeight (DOM invariant) — so driving height off scrollHeight
  // directly ratchets upward forever from any one stray tall measurement
  // (e.g. the placeholder wrapping while the pill is momentarily narrow
  // before the photo/scan buttons hide). Resetting to "auto" before each
  // read is the standard auto-grow-textarea fix: it drops the previous
  // clamp so scrollHeight reflects only what the new content actually
  // needs. RN's onContentSizeChange doesn't give us that reset-first
  // control, so this bypasses it and measures the DOM node directly.
  function autosizeWeb() {
    if (Platform.OS !== "web") return;
    const node = textInputRef.current as unknown as HTMLTextAreaElement | null;
    if (!node) return;
    // "auto" isn't actually zero here: a <textarea> with no `rows` attribute
    // (RN Web never sets one) falls back to the UA default of 2 rows, so
    // "auto" floors scrollHeight at 48px even for one short line. "0px"
    // forces a true content-only measurement.
    node.style.height = "0px";
    const next = Math.min(160, Math.max(24, node.scrollHeight));
    node.style.height = `${next}px`;
    setContentHeight(next);
  }

  const handleChangeText = (value: string) => {
    setText(value);
    // The native <textarea>'s own value is already updated by the time this
    // fires, so measure synchronously for an instant response. But this can
    // still land mid-flight: e.g. the char that flips `hasText` also widens
    // the pill (hides the photo/scan buttons) via a React re-render that
    // hasn't painted yet, so this first measurement sees the old, narrower
    // width. A deferred correction pass, once that layout has settled, fixes
    // it — setTimeout rather than rAF, since rAF never fires on a backgrounded
    // tab and this needs to work either way.
    autosizeWeb();
    setTimeout(autosizeWeb, 0);
  };

  const insets = useSafeAreaInsets();
  const rotation = useSharedValue(0);

  // Timer interval ref so we can clear it on stop/cancel without keeping
  // stale closures.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Single source of truth for the current handle in JS callbacks. The mode
  // object also carries it, but a ref avoids stale closures inside the
  // gesture worklet → runOnJS bridge.
  const handleRef = useRef<RecorderHandle | null>(null);
  const modeRef = useRef<ComposerMode>({ kind: "idle" });
  const mountedRef = useRef(true);
  const startPendingRef = useRef(false);
  const finishingRef = useRef(false);
  const gestureActiveRef = useRef(false);
  const pendingActionRef = useRef<PendingAction>(null);
  const lastTranslationRef = useRef({ x: 0, y: 0 });
  const gestureSessionRef = useRef(false);

  const updateMode = useCallback((next: ComposerMode) => {
    modeRef.current = next;
    setMode(next);
  }, []);

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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      gestureActiveRef.current = false;
      gestureSessionRef.current = false;
      pendingActionRef.current = "cancel";
      stopTimer();
      if (handleRef.current) {
        cancelRecording(handleRef.current).catch(() => {});
        handleRef.current = null;
      }
    };
  }, [stopTimer]);

  const finishAndSend = useCallback(async () => {
    const h = handleRef.current;
    gestureActiveRef.current = false;
    pendingActionRef.current = h ? null : startPendingRef.current ? "send" : null;
    if (!h) {
      stopTimer();
      updateMode({ kind: "idle" });
      setDurationMs(0);
      meterLevel.value = -160;
      return;
    }
    if (finishingRef.current) return;
    finishingRef.current = true;
    handleRef.current = null;
    stopTimer();
    updateMode({ kind: "idle" });
    setDurationMs(0);
    meterLevel.value = -160;
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
    } finally {
      finishingRef.current = false;
    }
  }, [meterLevel, onAudioReady, stopTimer, updateMode]);

  const finishAndCancel = useCallback(async () => {
    const h = handleRef.current;
    gestureActiveRef.current = false;
    pendingActionRef.current = h ? null : startPendingRef.current ? "cancel" : null;
    if (!h) {
      stopTimer();
      updateMode({ kind: "idle" });
      setDurationMs(0);
      meterLevel.value = -160;
      return;
    }
    if (finishingRef.current) return;
    finishingRef.current = true;
    handleRef.current = null;
    stopTimer();
    updateMode({ kind: "idle" });
    setDurationMs(0);
    meterLevel.value = -160;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    try {
      await cancelRecording(h);
    } finally {
      finishingRef.current = false;
    }
  }, [meterLevel, stopTimer, updateMode]);

  const beginRecording = useCallback(async () => {
    if (startPendingRef.current || handleRef.current || finishingRef.current) return;
    startPendingRef.current = true;
    try {
      const h = await startRecording((level) => {
        meterLevel.value = level;
      });
      startPendingRef.current = false;
      handleRef.current = h;

      const pendingAction = pendingActionRef.current;
      pendingActionRef.current = null;
      const startAction = actionAfterRecordingStarts({
        mounted: mountedRef.current,
        gestureActive: gestureActiveRef.current,
        pendingAction,
        tx: lastTranslationRef.current.x,
        ty: lastTranslationRef.current.y,
        isWeb: Platform.OS === "web",
      });
      if (startAction === "cancel") {
        await finishAndCancel();
        return;
      }
      if (startAction === "send") {
        await finishAndSend();
        return;
      }

      updateMode(
        startAction === "lock"
          ? { kind: "recording-locked" }
          : startAction === "cancel-hint"
            ? { kind: "cancel-hint" }
            : { kind: "recording-pressing" },
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setDurationMs(0);
      const started = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - started;
        setDurationMs(elapsed);
        if (elapsed >= MAX_RECORDING_MS) finishAndSend();
      }, 100);
    } catch (err) {
      startPendingRef.current = false;
      gestureActiveRef.current = false;
      gestureSessionRef.current = false;
      pendingActionRef.current = null;
      const code = (err as { code?: string } | null)?.code;
      if (code === "PERMISSION_DENIED") {
        if (Platform.OS === "web") {
          Alert.alert(
            "Microfone bloqueado",
            "Permita o uso do microfone nas configurações deste site e recarregue a página.",
          );
        } else {
          Alert.alert(
            "Microfone bloqueado",
            "Habilite o microfone nas configurações pra gravar refeições.",
            [
              { text: "Cancelar", style: "cancel" },
              { text: "Abrir Configurações", onPress: () => Linking.openSettings() },
            ],
          );
        }
      } else if (code === "RECORDING_UNSUPPORTED") {
        Alert.alert(
          "Gravação indisponível",
          "Este navegador não oferece uma opção compatível para gravar áudio.",
        );
      } else {
        // eslint-disable-next-line no-console
        console.warn("[MealComposer] startRecording failed:", err);
      }
      handleRef.current = null;
      updateMode({ kind: "idle" });
    }
  }, [finishAndCancel, finishAndSend, meterLevel, updateMode]);

  // -- All gesture callbacks must be declared BEFORE `pan` --

  const startGestureRecording = useCallback(() => {
    if (
      disabled ||
      processing ||
      startPendingRef.current ||
      handleRef.current ||
      finishingRef.current
    )
      return;
    gestureSessionRef.current = true;
    gestureActiveRef.current = true;
    pendingActionRef.current = null;
    lastTranslationRef.current = { x: 0, y: 0 };
    const startNow = () => {
      updateMode({ kind: "recording-starting" });
      beginRecording();
    };
    startNow();
  }, [beginRecording, disabled, processing, updateMode]);

  const handlePanUpdate = useCallback(
    (tx: number, ty: number) => {
      lastTranslationRef.current = { x: tx, y: ty };
      const h = handleRef.current;
      if ((!h && !startPendingRef.current) || modeRef.current.kind === "recording-locked") return;

      const intent = classifyAudioGesture(tx, ty);
      if (intent === "lock") {
        pendingActionRef.current = "lock";
        updateMode({ kind: "recording-locked" });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return;
      }
      if (intent === "cancel" && modeRef.current.kind !== "cancel-hint") {
        updateMode({ kind: "cancel-hint" });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return;
      }
      if (intent === "pressing" && modeRef.current.kind === "cancel-hint") {
        updateMode({ kind: "recording-pressing" });
      }
    },
    [updateMode],
  );

  const handlePanFinalize = useCallback(
    (success: boolean, tx: number, ty: number) => {
      gestureActiveRef.current = false;
      lastTranslationRef.current = { x: tx, y: ty };
      if (!gestureSessionRef.current) return;
      gestureSessionRef.current = false;

      if (!success) {
        finishAndCancel();
        return;
      }
      const intent = classifyAudioGesture(tx, ty);
      if (modeRef.current.kind === "recording-locked" || intent === "lock") {
        const h = handleRef.current;
        if (h) {
          pendingActionRef.current = null;
          if (modeRef.current.kind !== "recording-locked") {
            updateMode({ kind: "recording-locked" });
          }
        } else {
          pendingActionRef.current = "lock";
        }
        return;
      }
      if (intent === "cancel") finishAndCancel();
      else finishAndSend();
    },
    [finishAndCancel, finishAndSend, updateMode],
  );

  // Pan gesture lives on the mic button. minDistance(0) activates it on
  // touch-down so recording starts without an artificial hold delay. The
  // mic button isn't
  // inside a scroll surface, so eager activation doesn't conflict with the
  // FlatList above it.
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      runOnJS(startGestureRecording)();
    })
    .onUpdate((e) => {
      runOnJS(handlePanUpdate)(e.translationX, e.translationY);
    })
    .onFinalize((e, success) => {
      runOnJS(handlePanFinalize)(success, e.translationX, e.translationY);
    })
    .withTestId("meal-audio-pan");

  // Plain Pressable handlers for the typing path (send button).
  const handleSendText = () => {
    const value = text.trim();
    if (!value || disabled || processing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setText("");
    // The DOM node still shows the pre-clear text until React re-renders
    // with the new value, so there's nothing meaningful to measure yet —
    // just collapse straight back to the single-line minimum.
    if (Platform.OS === "web") {
      const node = textInputRef.current as unknown as HTMLTextAreaElement | null;
      if (node) node.style.height = "24px";
    }
    setContentHeight(0);
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
          <Loader2 size={20} color={colors.white} />
        </Animated.View>
      );
    if (mode.kind === "recording-locked")
      return <Square size={18} color={colors.white} fill={colors.white} />;
    if (hasText && !isRecording) return <Send size={20} color={colors.white} />;
    return <Mic size={20} color={colors.white} />;
  })();

  const micAccessibilityLabel = (() => {
    if (mode.kind === "recording-starting") return "Soltar para enviar gravação";
    if (mode.kind === "recording-pressing") return "Soltar para enviar gravação";
    if (mode.kind === "cancel-hint") return "Soltar para cancelar gravação";
    if (mode.kind === "recording-locked") return "Parar gravação";
    if (hasText) return "Enviar refeição";
    return Platform.OS === "web" ? "Gravar áudio" : "Gravar áudio — segure";
  })();

  return (
    <View style={{ pointerEvents: "box-none" }}>
      {showBackdropFade && (
        <LinearGradient
          colors={["rgba(248, 250, 252, 0)", "rgba(248, 250, 252, 0.85)", "rgba(248, 250, 252, 1)"]}
          locations={[0, 0.55, 1]}
          style={{
            pointerEvents: "none",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 120 + bottomPad,
          }}
        />
      )}

      <RecorderLockHint
        visible={
          mode.kind === "recording-starting" ||
          mode.kind === "recording-pressing" ||
          mode.kind === "cancel-hint"
        }
      />

      <View style={{ paddingBottom: bottomPad }} className="px-4 pt-3">
        <View className="flex-row items-end gap-2">
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
                "min-h-[48px] flex-1 justify-center rounded-[24px] bg-white px-4",
                isMultiline ? "py-2" : "",
              ].join(" ")}
            >
              <TextInput
                ref={textInputRef}
                value={text}
                onChangeText={handleChangeText}
                onContentSizeChange={(e) => {
                  // Web sizes itself via autosizeWeb (see above); native has
                  // no clientHeight/scrollHeight ratchet to fight, so the OS
                  // grows the input on its own and this is just tracked for
                  // the isMultiline padding toggle below.
                  if (Platform.OS !== "web") setContentHeight(e.nativeEvent.contentSize.height);
                }}
                onKeyPress={
                  Platform.OS === "web"
                    ? (e) => {
                        const nativeEvent = e.nativeEvent as unknown as {
                          key: string;
                          shiftKey?: boolean;
                        };
                        if (nativeEvent.key === "Enter" && !nativeEvent.shiftKey) {
                          e.preventDefault();
                          handleSendText();
                        }
                      }
                    : undefined
                }
                placeholder="O que você comeu?"
                placeholderTextColor={colors.neutral[400]}
                multiline
                maxLength={2000}
                editable={!disabled && !processing}
                textAlignVertical="center"
                style={{
                  paddingTop: 0,
                  paddingBottom: 0,
                  includeFontPadding: false,
                  ...(Platform.OS === "web"
                    ? { resize: "none", outlineWidth: 0, height: contentHeight || 24 }
                    : null),
                }}
                className="max-h-40 text-base font-sans text-neutral-800"
              />
            </View>
          )}

          {!hasText && !isRecording && onPhotoPress && onScanPress ? (
            <Pressable
              onPress={() => setAttachMenuOpen(true)}
              accessibilityLabel="Mais opções de registro"
              accessibilityRole="button"
              disabled={disabled || processing}
              style={shadows.floating}
              className={[
                "h-12 w-12 items-center justify-center rounded-full",
                disabled || processing ? "bg-neutral-200" : "bg-white active:bg-neutral-100",
              ].join(" ")}
            >
              <Plus size={20} color={colors.neutral[800]} />
            </Pressable>
          ) : !hasText && !isRecording && onPhotoPress ? (
            <Pressable
              onPress={onPhotoPress}
              accessibilityLabel="Registrar por foto"
              accessibilityRole="button"
              disabled={disabled || processing}
              style={shadows.floating}
              className={[
                "h-12 w-12 items-center justify-center rounded-full",
                disabled || processing ? "bg-neutral-200" : "bg-white active:bg-neutral-100",
              ].join(" ")}
            >
              <Camera size={20} color={colors.neutral[800]} />
            </Pressable>
          ) : !hasText && !isRecording && onScanPress ? (
            <Pressable
              onPress={onScanPress}
              accessibilityLabel="Registrar por código de barras"
              accessibilityRole="button"
              disabled={disabled || processing}
              style={shadows.floating}
              className={[
                "h-12 w-12 items-center justify-center rounded-full",
                disabled || processing ? "bg-neutral-200" : "bg-white active:bg-neutral-100",
              ].join(" ")}
            >
              <ScanLine size={20} color={colors.neutral[800]} />
            </Pressable>
          ) : null}

          {hasText && !isRecording ? (
            <Pressable
              onPress={processing ? undefined : handleSendText}
              accessibilityLabel="Enviar refeição"
              accessibilityRole="button"
              disabled={disabled || processing}
              style={shadows.floating}
              className={[
                "h-12 w-12 items-center justify-center rounded-full",
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
              className="h-12 w-12 items-center justify-center rounded-full bg-danger-500 active:bg-danger-600"
            >
              {micIcon}
            </Pressable>
          ) : Platform.OS === "web" ? (
            <Pressable
              onPress={beginRecording}
              accessibilityLabel={micAccessibilityLabel}
              accessibilityRole="button"
              disabled={disabled || processing}
              style={shadows.floating}
              className={[
                "h-12 w-12 items-center justify-center rounded-full",
                disabled || processing ? "bg-neutral-200" : "bg-primary-400 active:bg-primary-500",
              ].join(" ")}
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
                  "h-12 w-12 items-center justify-center rounded-full",
                  isRecording ? "bg-danger-500" : "bg-primary-400 active:bg-primary-500",
                ].join(" ")}
              >
                {micIcon}
              </Animated.View>
            </GestureDetector>
          )}
        </View>
      </View>

      <Modal
        visible={attachMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachMenuOpen(false)}
      >
        <View className="flex-1 items-end justify-end bg-black/40 px-8 pb-28">
          {/* Backdrop as a sibling, not a parent, of the menu card — a
              Pressable with accessibilityRole="button" renders as an actual
              <button> on web, and nesting the menu items' own <button>s
              inside it is invalid HTML that silently breaks click handling. */}
          <Pressable
            onPress={() => setAttachMenuOpen(false)}
            accessibilityLabel="Fechar menu"
            accessibilityRole="button"
            pointerEvents="auto"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View style={shadows.card} className="w-full max-w-xs rounded-2xl bg-white py-2">
            <Pressable
              onPress={() => {
                setAttachMenuOpen(false);
                onPhotoPress?.();
              }}
              accessibilityLabel="Registrar por foto"
              accessibilityRole="button"
              className="min-h-[44px] flex-row items-center gap-3 px-4 py-3 active:bg-neutral-50"
            >
              <Camera size={20} color={colors.neutral[700]} />
              <Text className="text-base font-sans-medium text-neutral-800">Foto</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setAttachMenuOpen(false);
                onScanPress?.();
              }}
              accessibilityLabel="Registrar por código de barras"
              accessibilityRole="button"
              className="min-h-[44px] flex-row items-center gap-3 px-4 py-3 active:bg-neutral-50"
            >
              <ScanLine size={20} color={colors.neutral[700]} />
              <Text className="text-base font-sans-medium text-neutral-800">Código de barras</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
