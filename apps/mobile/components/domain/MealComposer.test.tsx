import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("@/lib/audio/recorder", () => ({
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  cancelRecording: jest.fn(),
}));
jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Heavy: "heavy", Medium: "medium" },
  NotificationFeedbackType: { Warning: "warning", Success: "success" },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
}));

import { MealComposer } from "./MealComposer";
import { cancelRecording, startRecording, stopRecording } from "@/lib/audio/recorder";

const originalPlatform = Platform.OS;
const handle = { kind: "web" } as never;
const metrics = {
  frame: { x: 0, y: 0, width: 1024, height: 768 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

function renderComposer(onAudioReady: jest.Mock) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <MealComposer onSend={jest.fn()} onAudioReady={onAudioReady} />
    </SafeAreaProvider>,
  );
}

describe("MealComposer web audio controls", () => {
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    jest.mocked(startRecording).mockReset();
    jest.mocked(startRecording).mockResolvedValue(handle);
    jest.mocked(stopRecording).mockReset();
    jest.mocked(stopRecording).mockResolvedValue({
      fileUri: "blob:recording",
      durationMs: 1200,
      ext: "webm",
    });
    jest.mocked(cancelRecording).mockReset();
    jest.mocked(cancelRecording).mockResolvedValue(undefined);
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
  });

  test("starts on the first click and sends on the second click", async () => {
    const onAudioReady = jest.fn();
    const screen = renderComposer(onAudioReady);

    fireEvent.press(screen.getByLabelText("Gravar áudio"));
    await waitFor(() => expect(startRecording).toHaveBeenCalledTimes(1));

    fireEvent.press(await screen.findByLabelText("Parar gravação"));
    await waitFor(() => {
      expect(onAudioReady).toHaveBeenCalledWith({
        fileUri: "blob:recording",
        durationMs: 1200,
        ext: "webm",
      });
    });
  });

  test("cancels an active recording without sending it", async () => {
    const onAudioReady = jest.fn();
    const screen = renderComposer(onAudioReady);

    fireEvent.press(screen.getByLabelText("Gravar áudio"));
    fireEvent.press(await screen.findByLabelText("Cancelar gravação"));

    await waitFor(() => expect(cancelRecording).toHaveBeenCalledWith(handle));
    expect(stopRecording).not.toHaveBeenCalled();
    expect(onAudioReady).not.toHaveBeenCalled();
  });
});
