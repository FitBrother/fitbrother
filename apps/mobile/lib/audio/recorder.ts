// apps/mobile/lib/audio/recorder.ts
import { Audio } from "expo-av";

/**
 * Wrapper de Audio.Recording (expo-av) para o fluxo de captura M2.4.
 *
 * Responsabilidades:
 *   - Pedir permissão antes do primeiro start.
 *   - Preset de gravação por plataforma (iOS m4a/AAC, Android m4a/AAC).
 *   - Metering a cada 100ms via callback opcional.
 *   - Garantir cleanup (stopAndUnload) em qualquer caminho (success, cancel, exception).
 *
 * Não persiste estado fora da função: a UI mantém o `RecorderHandle`.
 *
 * NOTE: expo-av ~16.0.8 does not export AndroidAudioEncoder.OPUS — the enum
 * only includes AMR_NB, AMR_WB, AAC, HE_AAC, AAC_ELD, and DEFAULT. The plan
 * targeted opus/webm but that encoder constant does not exist in this version.
 * We use AAC + MPEG_4 on Android (same as iOS) to avoid a runtime crash.
 * Both platforms produce .m4a files that Whisper transcribes well.
 */

export type RecorderHandle = {
  recording: Audio.Recording;
  ext: "m4a";
  startedAt: number;
};

export type MeterCallback = (level: number) => void;

const METERING_INTERVAL_MS = 100;

// Targeting ~24 kbps mono / 24 kHz to keep upload under 1 MB for typical
// 30s clips. Whisper accepts much higher bitrates but doesn't reward them
// for voice.
const IOS_OPTIONS: Audio.RecordingOptions["ios"] = {
  extension: ".m4a",
  outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
  audioQuality: Audio.IOSAudioQuality.MEDIUM,
  sampleRate: 24000,
  numberOfChannels: 1,
  bitRate: 24000,
  linearPCMBitDepth: 16,
  linearPCMIsBigEndian: false,
  linearPCMIsFloat: false,
};

// AndroidAudioEncoder.OPUS does not exist in expo-av ~16.0.8.
// Using AAC + MPEG_4 which is universally supported on Android 5+.
const ANDROID_OPTIONS: Audio.RecordingOptions["android"] = {
  extension: ".m4a",
  outputFormat: Audio.AndroidOutputFormat.MPEG_4,
  audioEncoder: Audio.AndroidAudioEncoder.AAC,
  sampleRate: 24000,
  numberOfChannels: 1,
  bitRate: 24000,
};

const WEB_OPTIONS: Audio.RecordingOptions["web"] = {
  mimeType: "audio/webm",
  bitsPerSecond: 24000,
};

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: ANDROID_OPTIONS,
  ios: IOS_OPTIONS,
  web: WEB_OPTIONS,
};

export async function startRecording(onMeter?: MeterCallback): Promise<RecorderHandle> {
  // Permission check. Returns granted=false if user denied or never asked.
  const perm = await Audio.requestPermissionsAsync();
  if (!perm.granted) {
    const err = new Error("microphone_permission_denied") as Error & {
      code?: string;
    };
    err.code = "PERMISSION_DENIED";
    throw err;
  }

  // Configure audio mode so iOS allows recording even when silent switch is on.
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(RECORDING_OPTIONS);

  if (onMeter) {
    recording.setOnRecordingStatusUpdate((status) => {
      if (!status.isRecording) return;
      // metering is dB FS in (-160, 0]. Pass through; mapping lives in the
      // waveform component so the recorder library stays UI-agnostic.
      const level = status.metering ?? -160;
      onMeter(level);
    });
    recording.setProgressUpdateInterval(METERING_INTERVAL_MS);
  }

  await recording.startAsync();

  return { recording, ext: "m4a", startedAt: Date.now() };
}

export async function stopRecording(
  handle: RecorderHandle,
): Promise<{ fileUri: string; durationMs: number; ext: "m4a" }> {
  await handle.recording.stopAndUnloadAsync();
  const uri = handle.recording.getURI();
  if (!uri) {
    throw new Error("recording_no_uri");
  }
  // Reset audio mode so other audio (TTS, notifications) plays normally.
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  return {
    fileUri: uri,
    durationMs: Date.now() - handle.startedAt,
    ext: handle.ext,
  };
}

export async function cancelRecording(handle: RecorderHandle): Promise<void> {
  // stopAndUnloadAsync is safe to call multiple times (it no-ops after the
  // first). We swallow errors — cancel paths must not throw.
  try {
    await handle.recording.stopAndUnloadAsync();
  } catch {
    // ignore
  }
  try {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  } catch {
    // ignore
  }
  // We intentionally don't delete the local file: expo-av stores in app
  // cache which Expo Go / OS cleans up. Deleting would add an extra
  // expo-file-system dep for marginal benefit.
}
