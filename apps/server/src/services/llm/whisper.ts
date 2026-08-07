import OpenAI from "openai";
import { env } from "../../lib/env.js";
import { mimeForAudioExtension, type AudioExtension } from "../audio-format.js";

/**
 * OpenAI Whisper-1 wrapper.
 *
 * Pricing (2025): $0.006 / minute → 0.6¢/min. We round to 2 decimals when
 * we store in cents — sub-cent precision isn't material for caps.
 *
 * We don't share the LLMProvider interface (gemini.ts) because Whisper isn't
 * an extraction provider; it's a separate model with separate API + cap.
 */

const WHISPER_MODEL = "whisper-1";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for Whisper transcription");
  }
  _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return _client;
}

function costForSeconds(seconds: number): number {
  // $0.006/min = 0.6¢/min = 0.01¢/s. We return cents (2-decimal cents).
  return Math.round(seconds * 0.01 * 100) / 100;
}

// Per-language anchor prompts. The text doesn't need to be transcribed
// — Whisper just uses it as a stylistic seed. Including meal vocabulary
// also nudges domain accuracy ("ovos mexidos" vs "ovos missed").
function promptForLanguage(language?: string): string | undefined {
  if (!language) return undefined;
  switch (language) {
    case "pt":
      return "Esta gravação descreve uma refeição em português brasileiro: ovos, arroz, frango, banana, café.";
    case "en":
      return "This recording describes a meal in English: eggs, rice, chicken, banana, coffee.";
    case "es":
      return "Esta grabación describe una comida en español: huevos, arroz, pollo, plátano, café.";
    default:
      return undefined;
  }
}

export type TranscribeResult = {
  text: string;
  durationS: number;
  costCents: number;
  model: string;
};

export async function transcribe(params: {
  audioBuffer: ArrayBuffer;
  ext: AudioExtension;
  durationS: number;
  language?: string;
}): Promise<TranscribeResult> {
  const client = getClient();

  // The OpenAI SDK accepts File / Blob / Uint8Array. Node 18+ has File
  // globally. We need a filename with the right extension so OpenAI
  // identifies the codec.
  const blob = new Blob([params.audioBuffer], {
    type: mimeForAudioExtension(params.ext),
  });
  const file = new File([blob], `audio.${params.ext}`, { type: blob.type });

  // The `language` field alone is a weak hint — whisper-1 still drifts to
  // English on short / noisy clips. The `prompt` field carries an example
  // sentence the model treats as in-domain context: an effective anchor
  // for both language and the meal-logging vocabulary we expect.
  const prompt = promptForLanguage(params.language);

  const response = await client.audio.transcriptions.create({
    file,
    model: WHISPER_MODEL,
    language: params.language,
    prompt,
    // Plain text; we don't need timestamps for v1.
    response_format: "text",
  });

  // response_format: "text" returns a raw string.
  const text = typeof response === "string" ? response : String(response);

  return {
    text: text.trim(),
    durationS: params.durationS,
    costCents: costForSeconds(params.durationS),
    model: WHISPER_MODEL,
  };
}
