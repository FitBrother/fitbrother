# M2.4 — Mobile capture-first (áudio) — Design

**Status:** Draft → aguardando review.
**Data:** 2026-05-23.
**Milestone:** M2.4 do `docs/PLAN.md` (parte de áudio da M2).
**Escopo:** entrada por áudio dentro do app, com hold-to-record (WhatsApp-style) + lock + waveform animado. Pipeline server: upload direto pro Storage + transcrição via Whisper com cache + reuso do extraction do M2.3.

---

## 1. Objetivo

Fechar o M2: usuário segura o botão de microfone na Home, fala o que comeu, solta — em 5 a 15s aparece um Meal Card com macros calculados. Áudio é gravado em formato comprimido (~24 kbps mono), enviado direto pro Supabase Storage, transcrito via OpenAI Whisper com cache por SHA-256, e o texto é passado pro pipeline de extração já em produção (Gemini 2.5 Flash) do M2.3.

Junto, garantir UX próxima à do WhatsApp: hold-to-record com cancel deslizando esquerda + lock deslizando cima + waveform reagindo ao volume da voz.

Não cobre: playback do áudio no detalhe, entrada manual fallback, transcrição em tempo real, cleanup de áudios órfãos.

---

## 2. Estado atual (M2.3 + infra de áudio já mergeada)

**Pronto desde antes de M2.4:**
- `0016_transcriptions.sql` — tabela com `audio_hash text PK`, RLS authenticated read (cross-user cache OK), writes via service_role.
- `0019_meal_audios_bucket.sql` — bucket privado `meal-audios`, 25 MiB, MIME allowlist `audio/{ogg,opus,webm,mpeg,mp4}`, RLS por pasta `(storage.foldername(name))[1] = auth.uid()`.
- `apps/mobile/lib/storage.ts` — `uploadMealAudio({ userId, mealId, fileUri })` que upload direto via Supabase JS client com JWT do usuário.
- `apps/mobile/components/domain/MealComposer.tsx` — mic com handler stub (haptic Light + onMicPress callback). M2.4 substitui o callback pelo gravador real.
- `meals.source` enum já inclui `"app_audio"`; coluna `meals.audio_path` já existe.
- `OPENAI_API_KEY` no `.env` da raiz, com permissão `Audio` (Whisper).
- `expo-av ~16.0.8` instalado.

**Gap M2.4:**
- Server: `services/transcription.ts`, `services/llm/whisper.ts`, rota `POST /meals/audio`.
- Mobile: `lib/audio/recorder.ts`, `components/domain/{MealRecorder, RecorderWaveform, RecorderLockHint}.tsx`, `lib/hooks/useCreateMealAudio.ts`, extensão da state machine do `MealComposer`, integração na Home.
- Shared: `CreateMealAudioRequestSchema` em `packages/shared/src/schemas.ts`.

---

## 3. Arquitetura

### 3.1 Fluxo end-to-end

```
[mobile recorder] expo-av (iOS .m4a AAC | Android .opus OGG, 24 kbps mono, metering ON)
       ↓
[uploadMealAudio]  supabase-js .from("meal-audios").upload(path, blob)
                   path = "{user_id}/{client_meal_id}.{ext}"
                   RLS by folder allows authenticated INSERT
       ↓
[POST /meals/audio]
  body: { client_meal_id, audio_path, duration_s, consumed_at?, locale }
       ↓
[server route]
  1. zod parse
  2. ownership check: audio_path.startsWith(`${req.user.id}/`)
  3. transcribeFromPath(...)
       ├── assertWithinCap(user, kind="transcription", durationS)  → 429 if exceeded
       ├── supabaseService.storage.from("meal-audios").download(path) → ArrayBuffer
       ├── sha256(bytes) → hex
       ├── SELECT * FROM transcriptions WHERE audio_hash = $1
       │     hit  → return { text, cacheHit: true }
       │     miss → OpenAI Whisper API → INSERT transcriptions + recordUsage(transcription, durationS, costCents)
       └── return { text, cacheHit }
  4. extractMeal({ supabaseUser, userId, text, locale }) ← M2.3 service, unchanged
  5. applyCatalogToItems(...)  ← M2.3 service, unchanged
  6. supabase.rpc("create_meal_with_items", { payload: {
       id: client_meal_id,
       source: "app_audio",
       raw_input: transcriptionText,
       audio_path,
       meal_type, consumed_at, confidence, items
     } })
  7. reply 201 { meal, cache_hit_transcription, cache_hit_extraction, already_existed }
       ↓
[mobile]
  optimistic insert in mealsForDayKey, onSuccess replace with server meal
```

### 3.2 Decisão: client → Storage direto vs multipart pro Fastify

Cliente upa direto. Justificativa:
- `lib/storage.ts/uploadMealAudio` já está implementado e testado.
- Supabase Storage com RLS por pasta é a fronteira de autorização — não precisa um upload-proxy.
- Fastify economiza CPU/banda: só processa metadata, baixa do bucket sob demanda.
- Cache de transcrição funciona melhor com bytes do bucket (consistente entre clientes).

### 3.3 Decisão: formato de áudio por plataforma

| Plataforma | Container | Codec | Extensão | MIME | Motivo |
|---|---|---|---|---|---|
| iOS | MP4 | AAC LC | `.m4a` | `audio/mp4` | Suporte Opus em iOS é instável no expo-av. AAC m4a funciona out-of-the-box, Whisper aceita. |
| Android | OGG | Opus | `.opus` | `audio/ogg` | Opus tem melhor compressão pra voz, expo-av Android suporta nativo. |

Ambos: 24 kbps, mono, 24 kHz sample rate. Whisper-1 da OpenAI aceita os dois.

`uploadMealAudio` aceita `ext` como parâmetro pra montar o path certo.

---

## 4. UX da gravação (hold-to-record + lock + waveform)

### 4.1 State machine do composer

```
                       press 200ms+
                       ┌──────────────┐
                       │              ↓
                  ┌──────┐     ┌──────────────────┐
                  │ idle │←────│ recording-pressing│
                  └──────┘     └────┬──┬──────────┘
                       ↑            │  │
                       │  release   │  │
                       │  inside    │  │ slide-up ≥60px
                       │            │  ↓
                       │            │  ┌───────────────┐
                       │            │  │recording-locked│
                       │            │  └───┬─────┬─────┘
                       │            │      │     │
                       │            │      │     │ tap cancel X
                       │            │      │ tap stop ⏹
                       │            ↓      ↓     ↓
                       │       ┌──────────────┐  │
                       │       │  processing  │  │
                       │       │ (upload+POST)│  │
                       │       └────┬─────────┘  │
                       │            │            │
                       │  success/error          │
                       └────────────┴────────────┘
                       │
                       │  slide-left ≥80px
                       │  ┌──────────────┐
                       │  │ cancel-hint  │
                       └──┤(release=trash)│
                          └──────┬───────┘
                              slide-right
                                back to
                                pressing
```

Estados:
- `idle` — composer normal (input pill + mic). Tap mic apenas dispara haptic (ainda não grava).
- `recording-pressing` — finger down após threshold de 200ms. Input pill substituído por painel vermelho com timer + waveform + "← Deslize pra cancelar". Lock icon flutua acima do mic.
- `cancel-hint` — slide-left passou o limiar. Painel vermelho mostra ícone de lixeira grande + "Solte pra cancelar". Haptic `Warning` ao entrar.
- `recording-locked` — slide-up passou o limiar. Lock icon vira "🔒 travado". Mic vira ⏹ stop. Input mostra timer + waveform + cancel X.
- `processing` — upload + POST in flight. Composer volta pro idle (input habilitado, processing flag liga o spinner no botão).

### 4.2 Gestos

Implementação com `Gesture.Pan` do `react-native-gesture-handler` no botão do mic:

- **Touch start:** marca timestamp, schedule timer de 200ms.
- **Touch release antes de 200ms:** ignora (tap, não hold).
- **Hold > 200ms:** entra em `recording-pressing`, haptic `Heavy`, inicia gravação via `lib/audio/recorder.ts`.
- **Pan onUpdate:**
  - `translationX < -80` → muda pra `cancel-hint`, haptic `Warning` se ainda não tava.
  - `translationX >= -80` voltando → volta pra `recording-pressing`.
  - `translationY < -60` (slide up) → muda pra `recording-locked`, haptic `Success`. Reset translation rastreado a partir desse ponto.
- **Pan onEnd (release):**
  - de `recording-pressing` → upload + POST.
  - de `cancel-hint` → cancela (descarta arquivo local + bucket no melhor esforço).
  - de `recording-locked` → ignora (locked, espera tap stop/cancel).
- **Tap stop ⏹ no estado locked** → upload + POST.
- **Tap cancel X no estado locked** → cancela.

### 4.3 Waveform

Componente `RecorderWaveform`:
- 10 barras horizontais, gap 3px, width 3px cada.
- Cada barra tem um `useSharedValue<number>` com altura em px.
- Recorder dispara `onMeter(dB: number)` a cada 100ms via callback do `expo-av`.
- Cada update empurra o valor pras 9 barras à esquerda (shift register) e injeta o novo na direita.
- Mapeamento: `dB ∈ [-50, 0]` → height `∈ [4, 32]` via interpolação linear, clamped.
- Cor: `colors.danger[500]` (mesmo vermelho do dot pulsante).

### 4.4 Layout visual durante recording

```
                                  [🔒]       ← RecorderLockHint absolute, mt:-50
                                   ↑           desaparece quando locked
                                   │
┌──────────────────────────────┐ ┌────┐
│ ● 0:08  ▁▂▃▅▇▅▃▁  ← deslize  │ │ 🎙 │ ← MealRecorder substitui input pill
└──────────────────────────────┘ └────┘
```

No estado `recording-locked`:
```
┌──────────────────────────────┐ ┌────┐
│ ● 0:08  ▁▂▃▅▇▅▃▁         X   │ │ ⏹ │
└──────────────────────────────┘ └────┘
```

---

## 5. Arquivos a criar/modificar

### 5.1 Mobile

**Novos:**

| Arquivo | Responsabilidade |
|---|---|
| `apps/mobile/lib/audio/recorder.ts` | Wrapper de `expo-av`. Exporta `startRecording(): Promise<Recorder>`, `stopRecording(r): Promise<{ fileUri, durationMs, ext }>`, `cancelRecording(r): Promise<void>`. Cuida de permissões (`Audio.requestPermissionsAsync()`) antes de iniciar. Recording options preset por plataforma (§3.3). Configura `meteringEnabled: true` + `_progressUpdateIntervalMillis: 100`. Expõe um `onMeter` callback opcional. |
| `apps/mobile/components/domain/MealRecorder.tsx` | Painel vermelho que substitui o input pill durante recording. Props: `state: "pressing" \| "cancel-hint" \| "locked"`, `durationMs: number`, `meterValue: SharedValue<number>`, `onCancel?: () => void`. Renderiza: dot pulsante (Reanimated scale), timer (mm:ss, tabular-nums), `<RecorderWaveform/>`, e copy contextual (cancel hint ou X locked). |
| `apps/mobile/components/domain/RecorderWaveform.tsx` | Os 10 barras animadas. Props: `level: SharedValue<number>` (dB do último update). Mantém histórico interno de 10 amostras via shared values. |
| `apps/mobile/components/domain/RecorderLockHint.tsx` | Container absolute acima do mic. Mostra ícone `Lock` + chevron up animando (Reanimated bounce). Esconde quando `locked`. |
| `apps/mobile/lib/hooks/useCreateMealAudio.ts` | Mutation espelhada de `useCreateMealText`. Args: `{ client_meal_id, audio_path, duration_s, consumed_at?, locale, day }`. Mesmo padrão de optimistic insert na `mealsForDayKey`. |

**Modificados:**

| Arquivo | Mudança |
|---|---|
| `apps/mobile/components/domain/MealComposer.tsx` | Estende state machine pros 4 estados de recording. Substitui o gesto simples do mic (`onPress` stub) por `Gesture.Pan`. Renderiza `<MealRecorder/>` no lugar do `<TextInput/>` quando state ≠ idle/typing. Adiciona `onAudioReady({audio_path, duration_s})` prop. |
| `apps/mobile/lib/storage.ts` | `uploadMealAudio` aceita `ext: "m4a" \| "opus"` e seta `contentType` correspondente. Path final inclui a extensão. Continua retornando `{ path }`. |
| `apps/mobile/lib/api/meals.ts` | Adiciona `createMealAudio(input)` chamando `POST /meals/audio`. |
| `apps/mobile/app/(app)/index.tsx` | Implementa `handleAudioReady({ audio_path, duration_s })` que chama `useCreateMealAudio.mutate(...)` com mapeamento de erros idêntico ao text path (banner variants). |

### 5.2 Server

**Novos:**

| Arquivo | Responsabilidade |
|---|---|
| `apps/server/src/services/llm/whisper.ts` | Cliente OpenAI singleton (`new OpenAI({ apiKey: env.OPENAI_API_KEY })`). Função `transcribe({ audioBuffer, mime, language }): Promise<{ text, durationS, costCents, model }>`. Modelo: `"whisper-1"`. `language` é hint (e.g., `"pt"` derivado do locale `"pt-BR"`). Custo: $0.006/minuto. |
| `apps/server/src/services/transcription.ts` | `transcribeFromPath({ userClient, userId, audioPath, durationS, locale })`. Fluxo: cap-check → download via service_role → sha256 → lookup `transcriptions` → miss → Whisper → INSERT cache + ai_usage. Retorna `{ text, cacheHit }`. |

**Modificados:**

| Arquivo | Mudança |
|---|---|
| `apps/server/src/routes/meals.ts` | Adiciona handler `POST /meals/audio`. Estrutura idêntica ao `POST /meals/text` mas chama `transcribeFromPath` antes de `extractMeal`, e usa `source="app_audio"` + `audio_path` no RPC. Erros: 403 ownership, 429 quota (transcription OR LLM), 502 upstream failure. |
| `apps/server/src/services/ai-usage.ts` | Já tem `assertWithinCap(userId, kind)` e `recordUsage(...)`. Garantir que `kind="transcription"` confere contra `AI_CAP_TRANSCRIPTION_SECONDS` (já é o caso por design — verificar). |
| `packages/shared/src/schemas.ts` | Adiciona `CreateMealAudioRequestSchema`: `{ client_meal_id: UuidSchema, audio_path: z.string().min(1), duration_s: z.number().positive().max(600), consumed_at: z.string().datetime().optional(), locale: z.string().default("pt-BR") }`. Exporta `CreateMealAudioRequest` type. |

---

## 6. Tratamento de erros & casos de borda

| Cenário | HTTP | Comportamento UX | Lado |
|---|---|---|---|
| Permissão de microfone não concedida | — | Alert iOS/Android padrão; se permanentemente negado, mostra Alert com botão "Abrir Settings" via `Linking.openSettings()` | Mobile |
| Hold liberado < 200ms (tap acidental) | — | Nenhuma gravação inicia; haptic Light apenas | Mobile |
| Audio < 0.5s (release imediato) | — | Cancela silenciosamente (não envia) | Mobile |
| Audio > 600s (10min) | — | Timer client-side força stop e dispara upload aos 600s | Mobile |
| Upload pra Storage falha (network) | — | Banner `network`, audio descartado localmente, sem retry automático | Mobile |
| `audio_path` não começa com `auth.uid()` | 403 | Banner `server_error` (não esperado em uso normal) | Server |
| AI_QUOTA_EXCEEDED transcription | 429 | Banner `quota_exceeded`. Audio fica no bucket (sem impacto, RLS protege) | Server → Mobile |
| AI_QUOTA_EXCEEDED LLM (no extract após transcription) | 429 | Banner `quota_exceeded`. Texto transcrito está em cache; usuário pode re-tentar (cache_hit) | Server → Mobile |
| Whisper falha (timeout, API down, audio inválido) | 502 | Banner `server_error`. Audio fica no bucket pra debug | Server → Mobile |
| Extraction falha | 502 | Banner `server_error` | Server → Mobile |
| Cancel deliberado durante recording | — | Arquivo local descartado via `recorder.stopAndUnloadAsync()` + `FileSystem.deleteAsync()`. Não tenta deletar do bucket (não foi pra lá ainda). | Mobile |
| Cancel após upload mas antes de 201 | — | Não suportado em v1; mutation completa | Mobile |
| `transcriptions` cache hit cross-user | — | Funcionalidade desejada. RLS permite SELECT por hash (precisa ter o áudio pra computar). | Server |
| Áudio órfão no bucket (upload + cancel ou upload + falha pré-POST) | — | Aceitável em v1; cleanup job em backlog | — |

---

## 7. Acessibilidade & CLAUDE.md

- `font-sans-*` apenas (timer mm:ss usa `font-sans-bold` + tabular-nums).
- `accessibilityLabel` no mic dinâmico: "Gravar áudio" (idle), "Soltar para enviar" (pressing), "Soltar para cancelar" (cancel-hint), "Parar gravação" (locked stop), "Cancelar gravação" (locked cancel).
- Estados de cor: `colors.danger[500]` pro painel vermelho + dot + waveform; `colors.warning[500]` pro lock hint amarelo.
- Hit-target 44×44 mantido no mic e botões locked.
- Sem texto curto reading "Cancelar" — usa frases completas pra contexto VoiceOver.

---

## 8. Testes & verificação

### 8.1 Golden path (manual, iPhone)

1. Home, sem refeição: hold mic ≥200ms → painel vermelho aparece imediatamente, timer começa em 0:00, waveform inicia.
2. Falar "comi 2 ovos mexidos e um café" (~3s) → soltar dentro do mic → painel some, skeleton card aparece, em 5-15s vira card real com macros (~140 kcal, ~12g P).
3. Hold mic novamente, ouvir, deslizar pra esquerda além do botão → painel mostra lixeira "Solte pra cancelar" → soltar → tudo descartado, nenhum card.
4. Hold mic, deslizar pra cima ~70px → lock icon vira travado, dedo livre → tap stop ⏹ → mesmo fluxo de envio.
5. Hold mic, locked → tap X cancel → descarta.
6. Segundo registro idêntico no mesmo dia (mesmo áudio): log do server mostra `cache_hit_transcription: true`; tempo de resposta cai pra ~2-3s.
7. Negar permissão de mic no Settings → tentar hold → Alert "Permita o microfone".

### 8.2 Cap test

- `AI_CAP_TRANSCRIPTION_SECONDS=20` no server `.env`, restart.
- Gravar 15s + processar (uso = 15s).
- Gravar 10s + tentar → 429 `quota_exceeded`. Banner aparece.
- Reset `AI_CAP_TRANSCRIPTION_SECONDS=600` depois.

### 8.3 Verificação automatizada

- `npm run typecheck` (mobile + server) → 0 errors.
- Logs do server: confirmar `meals.source="app_audio"` no INSERT.
- Storage: confirmar `{user_id}/{client_meal_id}.{ext}` existe após sucesso.

---

## 9. Critério de aceite

- [ ] Hold → painel vermelho + timer + waveform animado.
- [ ] Release dentro → skeleton → meal card em 5-15s.
- [ ] Slide-left release → cancela sem efeito colateral.
- [ ] Slide-up → lock; stop ⏹ envia; cancel X descarta.
- [ ] Mesmo áudio enviado 2x → segundo bate cache de transcription (log).
- [ ] `AI_CAP_TRANSCRIPTION_SECONDS=10` força 429 + banner.
- [ ] Permissão negada → Alert com opção de abrir Settings.
- [ ] Tudo via `Animated.FlatList` continua funcionando (cards entrando/saindo com spring).
- [ ] `meals.audio_path` setado no DB.
- [ ] Sem `font-medium/semibold/bold` bare, sem hex inline em JSX.
- [ ] Mic stub do M2.3 deixa de existir — comportamento real substitui completamente.

---

## 10. Fora de escopo (M3+ ou backlog)

- Playback do áudio na tela de detalhe (`meals.audio_path` é gravado mas não há player ainda).
- Background recording quando app sai do foreground (gravação cancela).
- Transcrição em tempo real (preview do texto enquanto fala).
- Detecção automática de idioma (passa `locale.split("-")[0]` como hint pro Whisper).
- Cleanup periódico de áudios órfãos no bucket.
- Manual entry fallback pro `quota_exceeded` (continua deferido pra M3).
- Re-record sem perder o áudio anterior (overwrite imediato).

---

## 11. Riscos conhecidos

| Risco | Mitigação |
|---|---|
| Hold gesture conflita com Gesture.Pan da FlatList (scroll vertical). | `Gesture.Pan().minPointers(1).activeOffsetY([-9999, 9999])` no mic isola o gesto; FlatList scroll só responde a touches diretos. |
| Permissão de microfone no iOS exige string em `Info.plist`. | Adicionar `NSMicrophoneUsageDescription` no `app.json` plugins. |
| `expo-av` é legacy — `expo-audio` é a nova lib. | Manter `expo-av` por estabilidade no SDK 54. Quando subir SDK 55+ avaliar migração. |
| Whisper retorna texto vazio pra silêncio/ruído (audio < 1s). | Bloquear envio se `durationMs < 500` (client-side). Se Whisper devolver string vazia, tratar como erro 422 `empty_transcription` e mostrar banner. |
| Bucket fica com áudios órfãos (uploads sem POST). | Backlog — cleanup job (cron diário deletando objetos > 24h sem meal correspondente). |
| Cache cross-user vaza áudio se hash coincidir. | Hash SHA-256 de bytes — colisões randômicas têm probabilidade nula em escala MVP. Não é vetor de ataque relevante. |
| Mudança de tela durante recording-locked. | A state machine vive no MealComposer, então ao desmontar (navegação), o gravador é cancelado no cleanup do useEffect. Documentar isso no recorder. |
