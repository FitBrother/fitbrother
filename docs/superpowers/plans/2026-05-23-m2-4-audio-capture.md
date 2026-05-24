# M2.4 — Mobile capture-first (áudio) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o M2 com entrada por áudio no app: hold-to-record WhatsApp-style + lock + waveform, upload direto pro Supabase Storage, transcrição via Whisper com cache SHA-256, e reuso do pipeline de extração do M2.3.

**Architecture:** Cliente grava áudio com `expo-av` (iOS m4a/AAC, Android opus/ogg, 24 kbps mono, metering), faz upload direto via supabase-js pra `meal-audios/{user_id}/{client_meal_id}.{ext}` (RLS por pasta), e chama `POST /meals/audio` apenas com metadata. Server baixa via service_role, hash SHA-256, lookup em `transcriptions`, miss → Whisper-1; depois reaproveita `extractMeal` + `applyCatalogToItems` + RPC `create_meal_with_items` do M2.3. UX usa state machine com `Gesture.Pan` + Reanimated.

**Tech Stack:** React Native 0.81 (Expo 54) · TypeScript · `expo-av ~16.0.8` · `expo-haptics ~15.0.8` · `expo-crypto ~15.0.9` · `expo-linear-gradient ~15.0.8` · `react-native-gesture-handler ~2.28` · `react-native-reanimated ~4.1` · React Query 5 · Fastify 5 · `@supabase/supabase-js 2.47` · `openai ^4.x` (a instalar) · Zod 3.

**Spec:** [docs/superpowers/specs/2026-05-23-m2-4-audio-capture-design.md](../specs/2026-05-23-m2-4-audio-capture-design.md)

**Restrições CLAUDE.md (todo código):**
- Tipografia: `font-sans`, `font-sans-medium`, `font-sans-semibold`, `font-sans-bold`. **Nunca** `font-medium/semibold/bold`.
- Números: `style={{ fontVariant: ["tabular-nums"] }}`.
- Cores via token (sem hex inline em JSX); hex permitido em `lib/colors.ts` e SVG/Reanimated.
- Hit target 44×44 em qualquer Pressable.
- `accessibilityLabel` obrigatório em icon-only buttons; `accessibilityRole` em interativos.
- Ícones: `lucide-react-native` apenas.
- Sem `<div>`/`<h1>`. Só `View`/`Text`/`Pressable`.
- Sem `dark:`.
- RLS: server route checa `audio_path.startsWith(\`${userId}/\`)` antes de qualquer download.
- Cap de IA: `assertWithinCap` ANTES do Whisper; `recordUsage` APENAS no miss (não no cache hit).
- Webhook idempotency (não se aplica aqui, mas: `client_meal_id` é o dedup key — o RPC usa ON CONFLICT DO NOTHING).

**Verification baseline:** `npm run typecheck` deve passar 0 erros antes de cada commit, em `apps/server` e `apps/mobile`. Não há jest/vitest configurado — testes unitários são confiados ao typecheck + runtime smoke via `npm run dev`. Tarefas que envolvem UI são validadas em iPhone físico (Expo Go) seguindo o roteiro da seção §8 do spec.

---

## File Structure (M2.4)

### Server
**Novos:**
- `apps/server/src/services/llm/whisper.ts` — Cliente OpenAI singleton + função `transcribe({ audioBuffer, ext, language }) → { text, durationS, costCents, model }`. Hard-coded model `"whisper-1"`. Não compartilha provider com `getLlmProvider()` (Whisper não é extração).
- `apps/server/src/services/transcription.ts` — `transcribeFromPath({ userClient, userId, audioPath, durationS, locale })`. Cap-check → download → sha256 → lookup → miss → Whisper → INSERT cache + ai_usage. Retorna `{ text, cacheHit }`.

**Modificados:**
- `apps/server/src/routes/meals.ts` — adiciona handler `POST /meals/audio` (depois do `POST /meals/text`).
- `apps/server/package.json` — adiciona dependência `openai`.

### Shared
**Modificados:**
- `packages/shared/src/schemas.ts` — adiciona `CreateMealAudioRequestSchema` + tipo `CreateMealAudioRequest`.

### Mobile
**Novos:**
- `apps/mobile/lib/audio/recorder.ts` — Wrapper de `expo-av/Audio.Recording`. Exporta `startRecording(onMeter?) → Promise<RecorderHandle>`, `stopRecording(handle) → Promise<{ fileUri, durationMs, ext }>`, `cancelRecording(handle) → Promise<void>`. Cuida de `Audio.requestPermissionsAsync()` antes de iniciar.
- `apps/mobile/components/domain/MealRecorder.tsx` — Painel vermelho que substitui o input pill. Props: `state`, `durationMs`, `meterLevel`, `onCancel`.
- `apps/mobile/components/domain/RecorderWaveform.tsx` — 10 barras animadas via Reanimated shared values; consome `meterLevel: SharedValue<number>`.
- `apps/mobile/components/domain/RecorderLockHint.tsx` — Ícone Lock flutuante acima do mic; some quando `locked`.
- `apps/mobile/lib/hooks/useCreateMealAudio.ts` — Mutation espelhada de `useCreateMealText` com optimistic insert.

**Modificados:**
- `apps/mobile/components/domain/MealComposer.tsx` — Estende state machine pros 4 estados de recording. Substitui o handler stub do mic por `Gesture.Pan`. Renderiza `<MealRecorder/>` no lugar do input quando state ≠ idle. Nova prop `onAudioReady`.
- `apps/mobile/lib/storage.ts` — `uploadMealAudio` aceita `ext: "m4a" | "opus"`; path final inclui a extensão.
- `apps/mobile/lib/api/meals.ts` — adiciona `createMealAudio(input)` chamando `POST /meals/audio`.
- `apps/mobile/app/(app)/index.tsx` — implementa `handleAudioReady({audio_path, duration_s})` substituindo o stub `handleMic`.
- `apps/mobile/app.json` — adiciona `NSMicrophoneUsageDescription` via `ios.infoPlist`.

---

## Phase 1 — Server foundation (deps, env, shared schema)

### Task 1: Instalar SDK OpenAI no server

**Files:**
- Modify: `apps/server/package.json`

- [ ] **Step 1: Instalar pacote `openai`**

Run:
```bash
cd apps/server && npm install openai
```
Expected: package.json mostra `"openai": "^4.x"` em `dependencies`. `package-lock.json` na raiz atualiza.

- [ ] **Step 2: Verificar import básico**

```bash
cd apps/server && node -e "import('openai').then(m => console.log(Object.keys(m).slice(0,3)))"
```
Expected: imprime `[ 'default', 'OpenAI', 'APIError' ]` ou similar.

- [ ] **Step 3: Typecheck baseline**

```bash
cd apps/server && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/package.json package-lock.json
git commit -m "feat(server): install openai SDK for Whisper transcription"
```

### Task 2: Adicionar `CreateMealAudioRequestSchema` no shared

**Files:**
- Modify: `packages/shared/src/schemas.ts`

- [ ] **Step 1: Adicionar schema após `CreateMealTextRequestSchema`**

No final do bloco "Meal API requests + responses (M2)" em [packages/shared/src/schemas.ts](../../../packages/shared/src/schemas.ts), antes de `MealItemResponseSchema`, adicionar:

```ts
export const CreateMealAudioRequestSchema = z.object({
  // Client-generated UUID; matches the meal id and the storage filename base.
  client_meal_id: UuidSchema,
  // Storage path returned by uploadMealAudio. Server verifies prefix matches
  // auth.uid() before downloading. Format: "{user_id}/{client_meal_id}.{ext}".
  audio_path: z.string().min(1),
  // Recorded length in seconds. Used for ai_usage accounting BEFORE Whisper
  // (cap is enforced in audio-seconds, not bytes). Cap at 600s = 10min hard
  // limit also enforced client-side.
  duration_s: z.number().positive().max(600),
  consumed_at: z.string().datetime().optional(),
  locale: z.string().default("pt-BR"),
});
export type CreateMealAudioRequest = z.infer<typeof CreateMealAudioRequestSchema>;
```

- [ ] **Step 2: Typecheck**

```bash
cd packages/shared && npm run typecheck 2>/dev/null || cd ../../apps/server && npm run typecheck
```
Expected: 0 errors. (O shared não tem typecheck próprio; ele é validado quando server/mobile importam.)

- [ ] **Step 3: Verificar import do server**

```bash
cd apps/server && node -e "import('@fitbrother/shared').then(m => console.log(typeof m.CreateMealAudioRequestSchema))"
```
Expected: `object`.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas.ts
git commit -m "feat(shared): CreateMealAudioRequestSchema for POST /meals/audio"
```

### Task 3: Adicionar `NSMicrophoneUsageDescription` no app.json

**Files:**
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Adicionar `infoPlist` no bloco `ios`**

Substituir o bloco `"ios": { ... }` em [apps/mobile/app.json](../../../apps/mobile/app.json) por:

```json
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.fitbrother.app",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "O Fitbrother usa o microfone para gravar a descrição da sua refeição."
      }
    },
```

- [ ] **Step 2: Verificar JSON válido**

```bash
cd apps/mobile && node -e "console.log(JSON.parse(require('fs').readFileSync('app.json')).expo.ios.infoPlist)"
```
Expected: `{ NSMicrophoneUsageDescription: '...' }`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app.json
git commit -m "feat(mobile): NSMicrophoneUsageDescription for M2.4 audio capture"
```

---

## Phase 2 — Server: Whisper + transcription service

### Task 4: Implementar `services/llm/whisper.ts`

**Files:**
- Create: `apps/server/src/services/llm/whisper.ts`

- [ ] **Step 1: Criar arquivo com cliente singleton + transcribe**

```ts
// apps/server/src/services/llm/whisper.ts
import OpenAI from "openai";
import { env } from "../../lib/env.js";

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

export type TranscribeResult = {
  text: string;
  durationS: number;
  costCents: number;
  model: string;
};

export async function transcribe(params: {
  audioBuffer: ArrayBuffer;
  ext: "m4a" | "opus";
  durationS: number;
  language?: string;
}): Promise<TranscribeResult> {
  const client = getClient();

  // The OpenAI SDK accepts File / Blob / Uint8Array. Node 18+ has File
  // globally. We need a filename with the right extension so OpenAI
  // identifies the codec.
  const blob = new Blob([params.audioBuffer], {
    type: params.ext === "m4a" ? "audio/mp4" : "audio/ogg",
  });
  const file = new File([blob], `audio.${params.ext}`, { type: blob.type });

  const response = await client.audio.transcriptions.create({
    file,
    model: WHISPER_MODEL,
    language: params.language,
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
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/server && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/llm/whisper.ts
git commit -m "feat(server): whisper-1 wrapper service"
```

### Task 5: Implementar `services/transcription.ts`

**Files:**
- Create: `apps/server/src/services/transcription.ts`

- [ ] **Step 1: Criar arquivo com `transcribeFromPath`**

```ts
// apps/server/src/services/transcription.ts
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService } from "../lib/supabase.js";
import { assertWithinCap, recordUsage } from "./ai-usage.js";
import { transcribe } from "./llm/whisper.js";

/**
 * Transcribe an audio file already uploaded to the `meal-audios` bucket.
 *
 * Cap accounting (CLAUDE.md #4):
 *   * Cache hit  → no cap check, no record. The hit table doesn't exist for
 *     transcriptions (intentional — the bucket itself is the audit trail).
 *   * Cache miss → assertWithinCap('whisper_seconds') BEFORE the call,
 *     recordUsage(...) AFTER.
 *
 * Why service_role for download:
 *   The user already passed RLS on upload (storage policy by folder). We
 *   download with service_role because the cache lookup needs the raw bytes
 *   regardless of which user originally uploaded the same content (the
 *   cross-user cache is intentional — see migration 0016).
 */

const AUDIO_BUCKET = "meal-audios";

export type TranscribeFromPathResult = {
  text: string;
  cacheHit: boolean;
  audioHash: string;
};

export async function transcribeFromPath(params: {
  userClient: SupabaseClient;
  userId: string;
  audioPath: string;
  durationS: number;
  locale: string;
}): Promise<TranscribeFromPathResult> {
  const { userClient, userId, audioPath, durationS, locale } = params;

  // 1. Download via service_role. We trust the route to have validated
  //    that audioPath starts with `${userId}/`.
  const svc = supabaseService();
  const { data: blob, error: downloadErr } = await svc.storage
    .from(AUDIO_BUCKET)
    .download(audioPath);
  if (downloadErr) {
    throw new Error(`transcription_download_failed: ${downloadErr.message}`);
  }
  const audioBuffer = await blob.arrayBuffer();

  // 2. SHA-256 hash for cache key.
  const audioHash = createHash("sha256")
    .update(new Uint8Array(audioBuffer))
    .digest("hex");

  // 3. Cache lookup (authenticated SELECT, RLS allows all).
  const { data: cached, error: lookupErr } = await userClient
    .from("transcriptions")
    .select("text")
    .eq("audio_hash", audioHash)
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`transcription_cache_lookup_failed: ${lookupErr.message}`);
  }
  if (cached) {
    return { text: cached.text as string, cacheHit: true, audioHash };
  }

  // 4. Cache miss → cap check + Whisper call.
  await assertWithinCap(userClient, userId, "whisper_seconds");

  const ext = audioPath.endsWith(".m4a") ? "m4a" : "opus";
  const language = locale.split("-")[0]; // "pt-BR" → "pt"
  const result = await transcribe({
    audioBuffer,
    ext,
    durationS,
    language,
  });

  // 5. Persist cache + usage. Use service_role for the INSERT (writes go
  //    to a table without an INSERT policy for authenticated users).
  const { error: insertErr } = await svc.from("transcriptions").insert({
    audio_hash: audioHash,
    text: result.text,
    language,
    duration_s: durationS,
    model: result.model,
    cost_cents: result.costCents,
  });
  // Race: another concurrent request may have inserted same hash. Treat
  // unique violation as success.
  if (insertErr && insertErr.code !== "23505") {
    throw new Error(`transcription_cache_insert_failed: ${insertErr.message}`);
  }

  await recordUsage(userId, {
    transcriptionSeconds: durationS,
    transcriptionCostCents: result.costCents,
  });

  return { text: result.text, cacheHit: false, audioHash };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/server && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/transcription.ts
git commit -m "feat(server): transcribeFromPath service with sha256 cache + cap"
```

---

## Phase 3 — Server: POST /meals/audio route

### Task 6: Adicionar handler `POST /meals/audio`

**Files:**
- Modify: `apps/server/src/routes/meals.ts`

- [ ] **Step 1: Adicionar imports no topo de `meals.ts`**

Localizar a linha de imports (linhas 1-7) e adicionar `CreateMealAudioRequestSchema` ao import existente do shared, e adicionar import do transcription service:

```ts
import {
  CreateMealAudioRequestSchema,
  CreateMealTextRequestSchema,
  PatchMealRequestSchema,
} from "@fitbrother/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { authRequired, supabaseForRequest } from "../lib/auth.js";
import { AiQuotaExceededError } from "../services/ai-usage.js";
import { extractMeal } from "../services/extraction.js";
import { applyCatalogToItems } from "../services/meals.js";
import { transcribeFromPath } from "../services/transcription.js";
```

- [ ] **Step 2: Inserir handler `POST /meals/audio` logo após o fim do `POST /meals/text` (linha 100 do arquivo atual)**

Imediatamente depois do `});` que fecha o handler de `/meals/text` (linha ~100), antes do bloco `/* ── GET /meals?day=... */`, inserir:

```ts
  /* ── POST /meals/audio ─────────────────────────────────────────────── */
  app.post("/meals/audio", async (req, reply) => {
    const parsed = CreateMealAudioRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }
    const { client_meal_id, audio_path, duration_s, consumed_at, locale } = parsed.data;
    const userId = req.user!.id;
    const supabase = supabaseForRequest(req);

    // Ownership check: the storage RLS already gated the upload, but the
    // server downloads via service_role (which bypasses RLS) so we must
    // verify the prefix matches the caller before touching the bucket.
    if (!audio_path.startsWith(`${userId}/`)) {
      return reply.code(403).send({ error: "audio_path_ownership_mismatch" });
    }

    // 1. Transcribe (with cap + cache).
    let transcription;
    try {
      transcription = await transcribeFromPath({
        userClient: supabase,
        userId,
        audioPath: audio_path,
        durationS: duration_s,
        locale,
      });
    } catch (err) {
      if (err instanceof AiQuotaExceededError) {
        return reply.code(429).send({ error: err.code, kind: err.kind });
      }
      req.log.error({ err, audio_path }, "transcription_failed");
      return reply.code(502).send({ error: "transcription_failed" });
    }

    if (!transcription.text || transcription.text.length === 0) {
      // Whisper returns empty string for silence/noise. Treat as user error.
      return reply.code(422).send({ error: "empty_transcription" });
    }

    // 2. Extract meal from transcribed text (reuses M2.3 service).
    let extraction;
    try {
      extraction = await extractMeal({
        userClient: supabase,
        userId,
        text: transcription.text,
        locale,
      });
    } catch (err) {
      if (err instanceof AiQuotaExceededError) {
        return reply.code(429).send({ error: err.code, kind: err.kind });
      }
      req.log.error({ err }, "extraction_failed");
      return reply.code(502).send({ error: "ai_extraction_failed" });
    }

    const { applied } = await applyCatalogToItems(supabase, extraction.output);

    // 3. Persist meal via RPC. source="app_audio" + audio_path set.
    const { data: rpcResult, error: rpcError } = await supabase.rpc("create_meal_with_items", {
      payload: {
        id: client_meal_id,
        source: "app_audio",
        raw_input: transcription.text,
        audio_path,
        meal_type: extraction.output.meal_type,
        consumed_at: consumed_at ?? null,
        confidence: extraction.output.confidence,
        items: applied,
      },
    });

    if (rpcError) {
      req.log.error({ err: rpcError, client_meal_id }, "create_meal_rpc_failed");
      return reply.code(500).send({ error: rpcError.message });
    }

    const meal = await loadMeal(supabase, client_meal_id, req);
    if (!meal) {
      return reply.code(500).send({ error: "meal_disappeared_after_create" });
    }

    return reply.code(201).send({
      meal,
      cache_hit_transcription: transcription.cacheHit,
      cache_hit_extraction: extraction.cacheHit,
      already_existed: (rpcResult as { already_existed?: boolean })?.already_existed === true,
    });
  });
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/server && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Smoke test — subir o server e verificar a rota responde 400 sem auth**

```bash
cd apps/server && npm run dev &
SERVER_PID=$!
sleep 3
curl -s -X POST http://localhost:3000/meals/audio -H "Content-Type: application/json" -d '{}' | head -c 200
kill $SERVER_PID 2>/dev/null
```
Expected: `{"error":"unauthorized"}` ou similar (auth bloqueia antes do parse). Confirma que a rota está registrada.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/meals.ts
git commit -m "feat(server): POST /meals/audio — transcribe + extract pipeline"
```

---

## Phase 4 — Mobile: recorder library

### Task 7: Criar `lib/audio/recorder.ts`

**Files:**
- Create: `apps/mobile/lib/audio/recorder.ts`

- [ ] **Step 1: Criar arquivo com handle + start/stop/cancel**

```ts
// apps/mobile/lib/audio/recorder.ts
import { Audio } from "expo-av";
import { Platform } from "react-native";

/**
 * Wrapper de Audio.Recording (expo-av) para o fluxo de captura M2.4.
 *
 * Responsabilidades:
 *   - Pedir permissão antes do primeiro start.
 *   - Preset de gravação por plataforma (iOS m4a/AAC, Android opus/ogg).
 *   - Metering a cada 100ms via callback opcional.
 *   - Garantir cleanup (stopAndUnload) em qualquer caminho (success, cancel, exception).
 *
 * Não persiste estado fora da função: a UI mantém o `RecorderHandle`.
 */

export type RecorderHandle = {
  recording: Audio.Recording;
  ext: "m4a" | "opus";
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

const ANDROID_OPTIONS: Audio.RecordingOptions["android"] = {
  extension: ".opus",
  outputFormat: Audio.AndroidOutputFormat.WEBM,
  audioEncoder: Audio.AndroidAudioEncoder.OPUS,
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
    const err = new Error("microphone_permission_denied") as Error & { code?: string };
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

  const ext: "m4a" | "opus" = Platform.OS === "ios" ? "m4a" : "opus";
  return { recording, ext, startedAt: Date.now() };
}

export async function stopRecording(
  handle: RecorderHandle,
): Promise<{ fileUri: string; durationMs: number; ext: "m4a" | "opus" }> {
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
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors. Se algum tipo de `Audio.RecordingOptions` reclamar (expo-av tipos podem variar entre minors), verificar a versão instalada com `npm ls expo-av` e ajustar os enums dos sub-objetos para os disponíveis.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/audio/recorder.ts
git commit -m "feat(mobile): expo-av recorder wrapper with metering"
```

---

## Phase 5 — Mobile: recorder UI components

### Task 8: Criar `RecorderWaveform.tsx`

**Files:**
- Create: `apps/mobile/components/domain/RecorderWaveform.tsx`

- [ ] **Step 1: Criar componente das 10 barras**

```tsx
// apps/mobile/components/domain/RecorderWaveform.tsx
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";

const BAR_COUNT = 10;
const BAR_WIDTH = 3;
const BAR_GAP = 3;
const BAR_MIN_HEIGHT = 4;
const BAR_MAX_HEIGHT = 32;

// expo-av reports metering in dB FS, [-160, 0]. Voice typically sits in
// [-50, -10]. We clamp to [-50, 0] then map to [4, 32].
function dbToHeight(db: number): number {
  "worklet";
  const clamped = Math.max(-50, Math.min(0, db));
  const normalized = (clamped + 50) / 50; // 0..1
  return BAR_MIN_HEIGHT + normalized * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);
}

type BarProps = {
  // Whole-array shared value; each bar reads its own slot.
  bars: SharedValue<number[]>;
  index: number;
};

function Bar({ bars, index }: BarProps) {
  const style = useAnimatedStyle(() => ({
    height: withTiming(dbToHeight(bars.value[index] ?? -160), {
      duration: 80,
      easing: Easing.out(Easing.quad),
    }),
  }));
  return (
    <Animated.View
      style={[
        {
          width: BAR_WIDTH,
          backgroundColor: colors.danger[500],
          borderRadius: 2,
        },
        style,
      ]}
    />
  );
}

type Props = {
  // Latest dB reading from the recorder. Pushed into a shift register so the
  // 10 bars scroll from right to left over time.
  meterLevel: SharedValue<number>;
};

export function RecorderWaveform({ meterLevel }: Props) {
  // Single shared value holding all 10 bar levels. Avoids the
  // useSharedValue-in-loop antipattern and keeps the worklet simple.
  const bars = useSharedValue<number[]>(new Array(BAR_COUNT).fill(-160));

  // Each meter update shifts the array left and appends the new value.
  // useAnimatedReaction is the worklet-side equivalent of useEffect on a
  // shared value: re-runs whenever the prepare function's return changes.
  useAnimatedReaction(
    () => meterLevel.value,
    (newValue) => {
      const next = bars.value.slice(1);
      next.push(newValue);
      bars.value = next;
    },
  );

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: BAR_MAX_HEIGHT,
        gap: BAR_GAP,
      }}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <Bar key={i} bars={bars} index={i} />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors. Nota sobre o `useSharedValue` dentro de `Array.from` map: o `i` é estável (length=10 fixo entre renders), então a regra de hooks é respeitada.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/RecorderWaveform.tsx
git commit -m "feat(mobile): RecorderWaveform — 10-bar animated waveform"
```

### Task 9: Criar `RecorderLockHint.tsx`

**Files:**
- Create: `apps/mobile/components/domain/RecorderLockHint.tsx`

- [ ] **Step 1: Criar componente do ícone Lock flutuante**

```tsx
// apps/mobile/components/domain/RecorderLockHint.tsx
import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { ChevronUp, Lock } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";

type Props = {
  visible: boolean;
};

export function RecorderLockHint({ visible }: Props) {
  // Chevron does a gentle bounce while visible to hint "swipe up here".
  const offset = useSharedValue(0);
  useEffect(() => {
    if (!visible) return;
    offset.value = withRepeat(
      withTiming(-6, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [visible, offset]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          right: 16,
          bottom: 96,
          alignItems: "center",
          gap: 4,
          padding: 8,
          borderRadius: 24,
          backgroundColor: "#FFFFFF",
        },
        shadows.floating,
      ]}
    >
      <Lock size={18} color={colors.neutral[600]} />
      <Animated.View style={chevronStyle}>
        <ChevronUp size={14} color={colors.neutral[400]} />
      </Animated.View>
    </Animated.View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/RecorderLockHint.tsx
git commit -m "feat(mobile): RecorderLockHint — floating lock pill"
```

### Task 10: Criar `MealRecorder.tsx`

**Files:**
- Create: `apps/mobile/components/domain/MealRecorder.tsx`

- [ ] **Step 1: Criar painel vermelho com dot + timer + waveform + texto**

```tsx
// apps/mobile/components/domain/MealRecorder.tsx
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { X } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { RecorderWaveform } from "./RecorderWaveform";

export type RecorderState = "pressing" | "cancel-hint" | "locked";

type Props = {
  state: RecorderState;
  durationMs: number;
  meterLevel: SharedValue<number>;
  // Only relevant when state === "locked".
  onCancel?: () => void;
};

const NUM = { fontVariant: ["tabular-nums"] as const };

function formatMmSs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60).toString().padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function PulsingDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.4, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [scale, opacity]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View
      style={[
        {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.danger[500],
        },
        style,
      ]}
    />
  );
}

export function MealRecorder({ state, durationMs, meterLevel, onCancel }: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      style={shadows.floating}
      className="min-h-[64px] flex-1 flex-row items-center justify-between rounded-[32px] bg-white px-5"
    >
      <View className="flex-row items-center gap-3">
        <PulsingDot />
        <Text style={NUM} className="text-base font-sans-bold text-neutral-800">
          {formatMmSs(durationMs)}
        </Text>
        <RecorderWaveform meterLevel={meterLevel} />
      </View>

      {state === "cancel-hint" && (
        <Text className="text-sm font-sans-semibold text-danger-500">
          Solte para cancelar
        </Text>
      )}
      {state === "pressing" && (
        <Text className="text-xs font-sans text-neutral-500">← deslize</Text>
      )}
      {state === "locked" && onCancel && (
        <Pressable
          onPress={onCancel}
          accessibilityLabel="Cancelar gravação"
          accessibilityRole="button"
          hitSlop={12}
          className="h-11 w-11 items-center justify-center rounded-full"
        >
          <X size={20} color={colors.neutral[500]} />
        </Pressable>
      )}
    </Animated.View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/MealRecorder.tsx
git commit -m "feat(mobile): MealRecorder — recording panel with timer + waveform"
```

---

## Phase 6 — Mobile: storage + API client + mutation hook

### Task 11: Atualizar `lib/storage.ts` para aceitar `ext`

**Files:**
- Modify: `apps/mobile/lib/storage.ts`

- [ ] **Step 1: Refatorar `uploadMealAudio`**

Substituir o conteúdo de [apps/mobile/lib/storage.ts](../../../apps/mobile/lib/storage.ts) por:

```ts
import { supabase } from "./supabase";

const AUDIO_BUCKET = "meal-audios";

/**
 * Upload an audio file recorded for a meal.
 *
 * Storage RLS expects `{user_id}/{meal_id}.{ext}` — `(storage.foldername(name))[1]`
 * must equal `auth.uid()`. Path is built from the authenticated session.
 *
 * `ext` controls both the filename and the MIME hint (iOS m4a → audio/mp4,
 * Android opus → audio/ogg). Both extensions are in the bucket allowlist.
 */
export async function uploadMealAudio(params: {
  userId: string;
  mealId: string;
  fileUri: string;
  ext: "m4a" | "opus";
}): Promise<{ path: string }> {
  const path = `${params.userId}/${params.mealId}.${params.ext}`;
  const contentType = params.ext === "m4a" ? "audio/mp4" : "audio/ogg";

  const response = await fetch(params.fileUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, blob, { contentType, upsert: false });

  if (error) throw error;
  return { path };
}

export async function getMealAudioSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors. Como nenhum caller existia ainda (era stub do M2.3), não há quebra.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/storage.ts
git commit -m "feat(mobile): uploadMealAudio accepts ext (m4a|opus)"
```

### Task 12: Adicionar `createMealAudio` em `lib/api/meals.ts`

**Files:**
- Modify: `apps/mobile/lib/api/meals.ts`

- [ ] **Step 1: Adicionar função após `createMealText`**

Localizar `createMealText` em [apps/mobile/lib/api/meals.ts](../../../apps/mobile/lib/api/meals.ts) (linha 37) e adicionar logo abaixo, antes de `listMealsForDay`:

```ts
export async function createMealAudio(input: {
  client_meal_id: string;
  audio_path: string;
  duration_s: number;
  consumed_at?: string;
  locale: string;
}): Promise<{
  meal: MealResponse;
  cache_hit_transcription: boolean;
  cache_hit_extraction: boolean;
  already_existed: boolean;
}> {
  const res = await authedFetch("/meals/audio", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return (await parseOrThrow(res)) as {
    meal: MealResponse;
    cache_hit_transcription: boolean;
    cache_hit_extraction: boolean;
    already_existed: boolean;
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/api/meals.ts
git commit -m "feat(mobile): createMealAudio API client"
```

### Task 13: Criar `useCreateMealAudio.ts`

**Files:**
- Create: `apps/mobile/lib/hooks/useCreateMealAudio.ts`

- [ ] **Step 1: Espelhar `useCreateMealText` adaptando args + mutationFn**

```ts
// apps/mobile/lib/hooks/useCreateMealAudio.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MealResponse } from "@fitbrother/shared";
import { createMealAudio } from "@/lib/api/meals";
import { mealsForDayKey, mealDetailKey } from "./useMealsForDay";
import type { OptimisticMeal } from "./useCreateMealText";

type Args = {
  client_meal_id: string;
  audio_path: string;
  duration_s: number;
  consumed_at?: string;
  locale: string;
  day: string;
};
type Context = { previous?: MealResponse[] };

function makeOptimistic(args: Args): OptimisticMeal {
  const now = new Date().toISOString();
  return {
    id: args.client_meal_id,
    source: "app_audio",
    raw_input: null,
    audio_path: args.audio_path,
    meal_type: "other",
    consumed_at: args.consumed_at ?? now,
    total_kcal: 0,
    total_protein_g: 0,
    total_carbs_g: 0,
    total_fat_g: 0,
    confidence: null,
    review_required: false,
    created_at: now,
    deleted_at: null,
    items: [],
    __status: "processing",
  };
}

export function useCreateMealAudio() {
  const qc = useQueryClient();

  return useMutation<
    {
      meal: MealResponse;
      cache_hit_transcription: boolean;
      cache_hit_extraction: boolean;
      already_existed: boolean;
    },
    Error,
    Args,
    Context
  >({
    mutationFn: (args) =>
      createMealAudio({
        client_meal_id: args.client_meal_id,
        audio_path: args.audio_path,
        duration_s: args.duration_s,
        consumed_at: args.consumed_at,
        locale: args.locale,
      }),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: mealsForDayKey(args.day) });
      const previous = qc.getQueryData<MealResponse[]>(mealsForDayKey(args.day));
      qc.setQueryData<OptimisticMeal[]>(mealsForDayKey(args.day), (old) => [
        makeOptimistic(args),
        ...(old ?? []),
      ]);
      return { previous };
    },
    onSuccess: (result, args) => {
      qc.setQueryData<MealResponse[]>(mealsForDayKey(args.day), (old) => {
        if (!old) return [result.meal];
        return old.map((m) => (m.id === args.client_meal_id ? result.meal : m));
      });
      qc.setQueryData(mealDetailKey(result.meal.id), result.meal);
    },
    onError: (_err, args, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(mealsForDayKey(args.day), ctx.previous);
      } else {
        qc.invalidateQueries({ queryKey: mealsForDayKey(args.day) });
      }
    },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/hooks/useCreateMealAudio.ts
git commit -m "feat(mobile): useCreateMealAudio mutation with optimistic insert"
```

---

## Phase 7 — Mobile: composer integration (gestures + state machine)

### Task 14: Refatorar `MealComposer.tsx` — state machine + gesture

> Este task é o coração visual do M2.4. Substitui o `onMicPress` stub por uma máquina de estado `recording-*` com `Gesture.Pan`. **Manter** todo o comportamento existente do path de texto (typing + send + processing spinner).

**Files:**
- Modify: `apps/mobile/components/domain/MealComposer.tsx`

- [ ] **Step 1: Substituir o conteúdo inteiro do arquivo**

Substituir [apps/mobile/components/domain/MealComposer.tsx](../../../apps/mobile/components/domain/MealComposer.tsx) por:

```tsx
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
import { Loader2, Mic, Send, Square } from "lucide-react-native";
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
  disabled?: boolean;
  processing?: boolean;
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

export function MealComposer({ onSend, onAudioReady, disabled, processing }: Props) {
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return { kind: "recording-locked", handle: current.handle ?? handleRef.current! };
      }

      // Slide left beyond threshold → cancel-hint. Slide back → pressing.
      const isCancelHint = current.kind === "cancel-hint";
      if (tx <= -CANCEL_PX && !isCancelHint) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return { kind: "cancel-hint", handle: current.handle ?? handleRef.current! };
      }
      if (tx > -CANCEL_PX && isCancelHint) {
        return { kind: "recording-pressing", handle: current.handle ?? handleRef.current! };
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

  // Pan gesture lives on the mic button. activeOffsetY [-9999, 9999] keeps
  // FlatList vertical scroll dispatching to the list, not the gesture.
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .activeOffsetY([-9999, 9999])
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
    if (processing) return <Animated.View style={spinStyle}><Loader2 size={22} color="#FFFFFF" /></Animated.View>;
    if (mode.kind === "recording-locked") return <Square size={20} color="#FFFFFF" fill="#FFFFFF" />;
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

      <RecorderLockHint visible={mode.kind === "recording-pressing" || mode.kind === "cancel-hint"} />

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
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors. Notas:
  - `Square` ícone vem de `lucide-react-native` (já instalado).
  - `runOnJS` é o bridge oficial do Reanimated worklet → JS — todas as funções chamadas dentro de `.onBegin/.onUpdate/.onEnd/.onFinalize` precisam passar por ele.
  - `handlePanEnd` é idempotente (chamado de `onEnd` E `onFinalize`): o reset de `holdFiredRef = false` torna a segunda invocação um no-op.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/MealComposer.tsx
git commit -m "feat(mobile): MealComposer hold-to-record state machine"
```

---

## Phase 8 — Mobile: home wiring + permission errors

### Task 15: Conectar gravação na Home

**Files:**
- Modify: `apps/mobile/app/(app)/index.tsx`

- [ ] **Step 1: Atualizar imports**

Substituir o bloco de imports (linhas 1-28 atualmente) por:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, Platform, Pressable } from "react-native";
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalToday } from "@/lib/time/nutritional-day";
import { useMealsForDay } from "@/lib/hooks/useMealsForDay";
import {
  newClientMealId,
  useCreateMealText,
  type OptimisticMeal,
} from "@/lib/hooks/useCreateMealText";
import { useCreateMealAudio } from "@/lib/hooks/useCreateMealAudio";
import { useDeleteMeal } from "@/lib/hooks/useDeleteMeal";
import { uploadMealAudio } from "@/lib/storage";
import { QuotaExceededError, getErrorStatus } from "@/lib/api/meals";
import { HomeHeader } from "@/components/domain/HomeHeader";
import { MealCardSwipeable } from "@/components/domain/MealCardSwipeable";
import { MealCardSkeleton } from "@/components/domain/MealCardSkeleton";
import { MealComposer } from "@/components/domain/MealComposer";
import { EmptyMealsState } from "@/components/domain/EmptyMealsState";
import { ErrorBanner, type ErrorBannerVariant } from "@/components/domain/ErrorBanner";
```

(Se `useAuthSession` não existir nesse path, verificar `apps/mobile/lib/hooks/useAuthSession.ts` — a Task assume que ele expõe `user.id`. Se não expor, ler dele com `session?.user.id`.)

- [ ] **Step 2: Adicionar hook + handlers de áudio dentro do componente**

Após `const createMeal = useCreateMealText();`, adicionar:

```tsx
  const createMealAudio = useCreateMealAudio();
  const session = useAuthSession();
  const userId = session.data?.session?.user.id;
```

E substituir o `handleMic` stub atual por `handleAudioReady`:

```tsx
  const handleAudioReady = useCallback(
    async (params: { fileUri: string; durationMs: number; ext: "m4a" | "opus" }) => {
      if (!userId) return;
      setBanner(null);
      const client_meal_id = newClientMealId();
      const duration_s = Math.max(1, Math.round(params.durationMs / 1000));
      try {
        const { path } = await uploadMealAudio({
          userId,
          mealId: client_meal_id,
          fileUri: params.fileUri,
          ext: params.ext,
        });
        createMealAudio.mutate(
          {
            client_meal_id,
            audio_path: path,
            duration_s,
            locale: detectLocale(),
            day,
          },
          {
            onError: (err) => {
              if (err instanceof QuotaExceededError) {
                setBanner("quota_exceeded");
              } else if (err.message === "empty_transcription") {
                setBanner("network"); // re-use network banner copy "tente de novo"
              } else if (err.message === "request_timeout") {
                setBanner("offline");
              } else if ((getErrorStatus(err) ?? 0) >= 500) {
                setBanner("server_error");
              } else {
                setBanner("network");
              }
            },
          },
        );
      } catch {
        setBanner("network");
      }
    },
    [createMealAudio, day, userId],
  );
```

- [ ] **Step 3: Atualizar a prop do `<MealComposer/>`**

Encontrar o JSX do composer (atualmente `onMicPress={handleMic}`) e substituir por:

```tsx
        <MealComposer
          onSend={handleSend}
          onAudioReady={handleAudioReady}
          disabled={banner === "quota_exceeded"}
          processing={createMeal.isPending || createMealAudio.isPending}
        />
```

Remover a função `handleMic` antiga.

- [ ] **Step 4: Typecheck**

```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(app)/index.tsx
git commit -m "feat(mobile): wire audio capture in Home — upload + mutation"
```

---

## Phase 9 — Verification & polish

### Task 16: Smoke test no iPhone (Expo Go)

> Esta task NÃO produz código. Roda os critérios de aceite §8.1 do spec contra o app rodando em device físico.

- [ ] **Step 1: Subir server + supabase local**

```bash
# terminal 1
cd apps/server && npm run dev

# terminal 2
supabase status  # confirma local rodando
```
Expected: server escuta em `:3000`, Supabase em `:54321`.

- [ ] **Step 2: Subir mobile e abrir no iPhone via Expo Go**

```bash
cd apps/mobile && npm run dev
```
Expected: QR code aparece. Escanear no iPhone. App abre sem erros no Metro bundler.

- [ ] **Step 3: Permissão de microfone**

Hold no mic uma vez. iOS deve mostrar "Fitbrother gostaria de acessar o microfone". Aceitar.
Expected: copy do Info.plist aparece, permissão concedida.

- [ ] **Step 4: Golden path — gravar refeição**

1. Hold mic ≥1s, dizer "comi 2 ovos mexidos e um café".
2. Soltar dentro da área do botão.
Expected: painel vermelho aparece com timer e waveform pulsando enquanto fala; ao soltar, painel some, card skeleton aparece, e em 5-15s vira card real com macros (~140 kcal, ~12g P).

- [ ] **Step 5: Cancel deslizando esquerda**

Hold mic, falar, deslizar dedo pra esquerda ≥80px → painel mostra "Solte para cancelar" em vermelho. Soltar.
Expected: nenhum card aparece, nenhum upload registrado nos logs do server.

- [ ] **Step 6: Lock deslizando cima**

Hold mic, deslizar dedo pra cima ≥60px → haptic Success, lock hint some, ícone do botão vira ⏹. Tirar dedo.
Expected: gravação continua (timer segue contando). Tap em ⏹ → mesmo fluxo de envio.

- [ ] **Step 7: Cache hit**

Re-gravar exatamente o mesmo áudio (improvável de bater hash literal — mas dá pra forçar). Alternativa: gravar 2 vezes "1 banana" e verificar nos logs se aparece `cache_hit_extraction: true` no segundo (o cache de extração depende só do texto, então textos transcritos iguais batem).
Expected: response do segundo POST tem `cache_hit_extraction: true`.

- [ ] **Step 8: Cap test**

Editar `apps/server/.env`:
```
AI_CAP_TRANSCRIPTION_SECONDS=10
```
Restart server. Gravar 8s. Gravar 5s novamente.
Expected: segunda chamada retorna 429, banner `quota_exceeded` aparece na UI.

Restaurar `AI_CAP_TRANSCRIPTION_SECONDS=600` ao final.

- [ ] **Step 9: Permission denied flow**

iOS Settings → Fitbrother → Microfone → desabilitar. Voltar pro app, hold mic.
Expected: Alert "Microfone bloqueado" com opção "Abrir Configurações". Clicar abre o app de Settings.

- [ ] **Step 10: Sem commit nesta task**

Esta task é só validação. Se algo falhar, abrir issue/ajuste — não commitar nada.

### Task 17: Final cleanup + push

**Files:**
- N/A — review do diff completo.

- [ ] **Step 1: Diff review**

```bash
git log main..HEAD --oneline
git diff main..HEAD --stat
```
Expected: lista de commits cobrindo Tasks 1-15. ~10-12 arquivos modificados/criados.

- [ ] **Step 2: Typecheck final em mobile e server**

```bash
cd apps/mobile && npm run typecheck && cd ../server && npm run typecheck
```
Expected: 0 errors em ambos.

- [ ] **Step 3: Lint (se houver script)**

```bash
cd apps/mobile && npm run lint 2>/dev/null || echo "no lint script"
```
Expected: 0 errors, ou "no lint script".

- [ ] **Step 4: Push branch e abrir PR**

```bash
git push -u origin m2-4-audio-capture
gh pr create --title "M2.4 — Mobile capture-first (áudio)" --body "$(cat <<'EOF'
## Summary
- Hold-to-record WhatsApp-style com lock + cancel + waveform animado.
- Upload direto pro Supabase Storage (RLS por pasta) + transcrição Whisper com cache SHA-256.
- Reuso do pipeline de extração do M2.3 (Gemini 2.5 Flash).
- `POST /meals/audio` aceita metadata, baixa via service_role, transcreve, extrai, persiste.

## Test plan
- [ ] Hold mic ≥200ms → painel vermelho + timer + waveform
- [ ] Release dentro → skeleton → meal card em 5-15s
- [ ] Slide-left release → cancela
- [ ] Slide-up → lock; ⏹ envia; X descarta
- [ ] Permissão negada → Alert com link pra Settings
- [ ] `AI_CAP_TRANSCRIPTION_SECONDS=10` → 429 quota
- [ ] Mesmo texto transcrito 2x → `cache_hit_extraction: true` no 2º

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR criado, URL impressa.

- [ ] **Step 5: Não commitar nada novo nesta task**

Cleanup é review-only.

---

## Out of scope (M3+)

- Playback do áudio na tela de detalhe (audio_path já é persistido).
- Background recording quando app sai do foreground.
- Transcrição em tempo real (preview do texto enquanto fala).
- Manual entry fallback pro `quota_exceeded`.
- Cleanup de áudios órfãos no bucket.
- Re-record sem perder o áudio anterior.

---

## Notes & gotchas

- **expo-av é legacy:** SDK 54 ainda suporta, mas `expo-audio` é o futuro. Mantemos por estabilidade. Quando subir SDK 55+ avaliar migração — a API muda bastante.
- **Worklet ↔ JS:** Tudo dentro de `.onUpdate/.onEnd` do Gesture roda em worklet thread. Funções JS (`setState`, callbacks com closure) PRECISAM passar por `runOnJS`. Não tente "esperar" um setState dentro do worklet.
- **`useSharedValue` em loop:** O `RecorderWaveform` cria 10 shared values via `Array.from(...).map(() => useSharedValue(-160))`. Isso é válido porque a length é constante entre renders (regra de hooks respeitada).
- **Cache de transcription é cross-user:** Intencional, ver §3 do spec. Hash SHA-256 do payload binário; colisões randômicas têm probabilidade nula.
- **Erro `empty_transcription`:** Whisper devolve string vazia pra silêncio/ruído. Server retorna 422; mobile reusa o banner `network` ("tente novamente"). Não tratamos como sucesso pra evitar criar meals vazios.
- **Hard cap 10min:** Client-side mata gravação aos 600s (`MAX_RECORDING_MS`). Server zod também rejeita `duration_s > 600`.
