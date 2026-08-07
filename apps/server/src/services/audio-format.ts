export type AudioExtension = "m4a" | "opus" | "webm";

export function mimeForAudioExtension(ext: AudioExtension): string {
  if (ext === "m4a") return "audio/mp4";
  if (ext === "webm") return "audio/webm";
  return "audio/ogg";
}

export function audioExtensionFromPath(path: string): AudioExtension {
  if (path.endsWith(".m4a")) return "m4a";
  if (path.endsWith(".webm")) return "webm";
  if (path.endsWith(".opus")) return "opus";
  throw new Error("unsupported_audio_extension");
}
