import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { Platform } from "react-native";

jest.mock("expo-av", () => ({
  Audio: {
    IOSOutputFormat: { MPEG4AAC: 1 },
    IOSAudioQuality: { MEDIUM: 1 },
    AndroidOutputFormat: { MPEG_4: 1 },
    AndroidAudioEncoder: { AAC: 1 },
  },
}));

import { cancelRecording, startRecording, stopRecording } from "./recorder";

type Listener = (event: { data: Blob }) => void;

class FakeMediaRecorder {
  static isTypeSupported = jest.fn((mimeType: string) => mimeType === "audio/webm;codecs=opus");
  state: RecordingState = "inactive";
  private listeners = new Map<string, Listener[]>();

  constructor(
    public readonly stream: MediaStream,
    public readonly options?: MediaRecorderOptions,
  ) {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback = listener as unknown as Listener;
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    this.emit("dataavailable", { data: new Blob(["audio"], { type: "audio/webm" }) });
    this.emit("stop", { data: new Blob() });
  }

  private emit(type: string, event: { data: Blob }): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const originalPlatform = Platform.OS;
const originalMediaRecorder = globalThis.MediaRecorder;
const originalAudioContext = globalThis.AudioContext;
const originalCreateObjectURL = URL.createObjectURL;

describe("web audio recorder", () => {
  const stopTrack = jest.fn();
  const getUserMedia = jest.fn<() => Promise<MediaStream>>();

  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    stopTrack.mockReset();
    getUserMedia.mockReset();
    getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    FakeMediaRecorder.isTypeSupported.mockClear();
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    });
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: jest.fn(() => "blob:recording"),
    });
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: originalMediaRecorder,
    });
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: originalAudioContext,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
    jest.restoreAllMocks();
  });

  test("records WebM and releases the microphone after stopping", async () => {
    const handle = await startRecording();
    const result = await stopRecording(handle);

    expect(result.fileUri).toBe("blob:recording");
    expect(result.ext).toBe("webm");
    expect(FakeMediaRecorder.isTypeSupported).toHaveBeenCalledWith("audio/webm;codecs=opus");
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  test("releases the microphone when recording is cancelled", async () => {
    const handle = await startRecording();
    await cancelRecording(handle);
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  test("normalizes browser permission denial", async () => {
    const permissionError = new Error("denied");
    permissionError.name = "NotAllowedError";
    getUserMedia.mockRejectedValue(permissionError);

    await expect(startRecording()).rejects.toMatchObject({
      message: "microphone_permission_denied",
      code: "PERMISSION_DENIED",
    });
  });

  test("reports unsupported browsers before asking for permission", async () => {
    FakeMediaRecorder.isTypeSupported.mockReturnValue(false);
    await expect(startRecording()).rejects.toMatchObject({
      message: "recording_unsupported",
      code: "RECORDING_UNSUPPORTED",
    });
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
