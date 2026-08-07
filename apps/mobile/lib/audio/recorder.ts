import { Platform } from "react-native";
import { Audio } from "expo-av";

export type AudioExtension = "m4a" | "opus" | "webm";
export type MeterCallback = (level: number) => void;

type NativeRecorderHandle = {
  kind: "native";
  recording: Audio.Recording;
  ext: "m4a";
  startedAt: number;
};

type WebRecorderHandle = {
  kind: "web";
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  ext: AudioExtension;
  mimeType: string;
  startedAt: number;
  audioContext: AudioContext | null;
  meterFrame: number | null;
};

export type RecorderHandle = NativeRecorderHandle | WebRecorderHandle;

const METERING_INTERVAL_MS = 100;

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

const ANDROID_OPTIONS: Audio.RecordingOptions["android"] = {
  extension: ".m4a",
  outputFormat: Audio.AndroidOutputFormat.MPEG_4,
  audioEncoder: Audio.AndroidAudioEncoder.AAC,
  sampleRate: 24000,
  numberOfChannels: 1,
  bitRate: 24000,
};

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: ANDROID_OPTIONS,
  ios: IOS_OPTIONS,
  web: { mimeType: "audio/webm", bitsPerSecond: 24000 },
};

type WebFormat = { mimeType: string; ext: AudioExtension };

const WEB_FORMATS: WebFormat[] = [
  { mimeType: "audio/webm;codecs=opus", ext: "webm" },
  { mimeType: "audio/webm", ext: "webm" },
  { mimeType: "audio/mp4", ext: "m4a" },
  { mimeType: "audio/ogg;codecs=opus", ext: "opus" },
];

function recordingError(message: string, code: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

function chooseWebFormat(): WebFormat {
  if (typeof MediaRecorder === "undefined") {
    throw recordingError("recording_unsupported", "RECORDING_UNSUPPORTED");
  }
  const format = WEB_FORMATS.find(
    ({ mimeType }) =>
      typeof MediaRecorder.isTypeSupported !== "function" ||
      MediaRecorder.isTypeSupported(mimeType),
  );
  if (!format) throw recordingError("recording_unsupported", "RECORDING_UNSUPPORTED");
  return format;
}

function startWebMetering(handle: WebRecorderHandle, onMeter?: MeterCallback): void {
  if (!onMeter) return;
  const AudioContextClass =
    globalThis.AudioContext ??
    (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    handle.audioContext = context;
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(handle.stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let lastUpdate = 0;

    const measure = (timestamp: number) => {
      if (timestamp - lastUpdate >= METERING_INTERVAL_MS) {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        const rms = Math.sqrt(sum / samples.length);
        onMeter(rms > 0 ? Math.max(-160, 20 * Math.log10(rms)) : -160);
        lastUpdate = timestamp;
      }
      handle.meterFrame = requestAnimationFrame(measure);
    };

    handle.meterFrame = requestAnimationFrame(measure);
  } catch {
    // Recording remains usable if Web Audio metering is unavailable.
    if (handle.audioContext) void handle.audioContext.close().catch(() => {});
    handle.audioContext = null;
  }
}

async function cleanupWeb(handle: WebRecorderHandle): Promise<void> {
  if (handle.meterFrame !== null) {
    cancelAnimationFrame(handle.meterFrame);
    handle.meterFrame = null;
  }
  handle.stream.getTracks().forEach((track) => track.stop());
  if (handle.audioContext && handle.audioContext.state !== "closed") {
    await handle.audioContext.close().catch(() => {});
  }
  handle.audioContext = null;
}

async function startWebRecording(onMeter?: MeterCallback): Promise<WebRecorderHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw recordingError("recording_unsupported", "RECORDING_UNSUPPORTED");
  }
  const format = chooseWebFormat();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw recordingError("microphone_permission_denied", "PERMISSION_DENIED");
    }
    throw error;
  }

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: format.mimeType, audioBitsPerSecond: 24000 });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }

  const handle: WebRecorderHandle = {
    kind: "web",
    recorder,
    stream,
    chunks: [],
    ext: format.ext,
    mimeType: format.mimeType,
    startedAt: Date.now(),
    audioContext: null,
    meterFrame: null,
  };
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) handle.chunks.push(event.data);
  });
  recorder.start();
  startWebMetering(handle, onMeter);
  return handle;
}

export async function startRecording(onMeter?: MeterCallback): Promise<RecorderHandle> {
  if (Platform.OS === "web") return startWebRecording(onMeter);

  const perm = await Audio.requestPermissionsAsync();
  if (!perm.granted) throw recordingError("microphone_permission_denied", "PERMISSION_DENIED");

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
      if (status.isRecording) onMeter(status.metering ?? -160);
    });
    recording.setProgressUpdateInterval(METERING_INTERVAL_MS);
  }
  await recording.startAsync();
  return { kind: "native", recording, ext: "m4a", startedAt: Date.now() };
}

export async function stopRecording(
  handle: RecorderHandle,
): Promise<{ fileUri: string; durationMs: number; ext: AudioExtension }> {
  if (handle.kind === "web") {
    try {
      if (handle.recorder.state !== "inactive") {
        await new Promise<void>((resolve, reject) => {
          handle.recorder.addEventListener("stop", () => resolve(), { once: true });
          handle.recorder.addEventListener("error", () => reject(new Error("recording_failed")), {
            once: true,
          });
          handle.recorder.stop();
        });
      }
      const blob = new Blob(handle.chunks, { type: handle.mimeType });
      if (blob.size === 0) throw new Error("empty_audio_file");
      return {
        fileUri: URL.createObjectURL(blob),
        durationMs: Date.now() - handle.startedAt,
        ext: handle.ext,
      };
    } finally {
      await cleanupWeb(handle);
    }
  }

  await handle.recording.stopAndUnloadAsync();
  const uri = handle.recording.getURI();
  if (!uri) throw new Error("recording_no_uri");
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  return { fileUri: uri, durationMs: Date.now() - handle.startedAt, ext: handle.ext };
}

export async function cancelRecording(handle: RecorderHandle): Promise<void> {
  if (handle.kind === "web") {
    try {
      if (handle.recorder.state !== "inactive") handle.recorder.stop();
    } catch {
      // Cancellation must not surface recorder shutdown errors.
    }
    await cleanupWeb(handle);
    return;
  }

  try {
    await handle.recording.stopAndUnloadAsync();
  } catch {
    // Cancellation must not surface recorder shutdown errors.
  }
  try {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  } catch {
    // Ignore audio-mode cleanup errors on cancellation.
  }
}
