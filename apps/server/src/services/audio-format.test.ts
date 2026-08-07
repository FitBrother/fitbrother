import { describe, expect, it } from "vitest";
import { audioExtensionFromPath, mimeForAudioExtension } from "./audio-format.js";

describe("audio formats", () => {
  it.each([
    ["user/meal.m4a", "m4a", "audio/mp4"],
    ["user/meal.opus", "opus", "audio/ogg"],
    ["user/meal.webm", "webm", "audio/webm"],
  ] as const)("maps %s for Whisper", (path, extension, mime) => {
    expect(audioExtensionFromPath(path)).toBe(extension);
    expect(mimeForAudioExtension(extension)).toBe(mime);
  });

  it("rejects an unknown extension", () => {
    expect(() => audioExtensionFromPath("user/meal.wav")).toThrow("unsupported_audio_extension");
  });
});
