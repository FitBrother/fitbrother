# Câmera ao vivo no share, com o preset por cima — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Oferecer câmera ao vivo na tela de compartilhar refeição, com a moldura do preset de story desenhada sobre o vídeo, e persistir a foto na refeição.

**Architecture:** Uma camada de câmera única e fixa atrás de um carrossel que desliza carregando só o cromo do preset. A câmera é um componente com split por plataforma (`CameraLive.tsx` nativo via `expo-camera`; `CameraLive.web.tsx` via `getUserMedia` próprio, porque o `CameraView` web não permite pedir resolução). A captura entra no pipeline de foto que já existe (`Enquadramento` normalizado → `PhotoAdjuster` → `html2canvas`), e o upload persiste em `meals.image_path` sem bloquear a UI.

**Tech Stack:** React Native · Expo 54 · react-native-web 0.21 · expo-camera 17 · Reanimated 4 · RNGH 2.28 · Supabase (Postgres + Storage RLS) · Fastify · jest (mobile) · vitest (server/shared)

**Spec:** [`docs/superpowers/specs/2026-10-11-camera-ao-vivo-share-design.md`](../specs/2026-10-11-camera-ao-vivo-share-design.md)

## Global Constraints

Valem para **toda** tarefa. Vêm do `CLAUDE.md` e do spec.

- **Tipografia:** nunca `font-medium`/`font-semibold`/`font-bold`. Use `font-sans` (400), `font-sans-medium` (500), `font-sans-semibold` (600), `font-sans-bold` (700), `font-sans-extrabold` (800); títulos usam `font-display-*`.
- **Números:** todo valor numérico leva `style={{ fontVariant: ["tabular-nums"] }}`.
- **Cores:** via token Tailwind em JSX, nunca hex inline. Exceção: SVG/Skia/Reanimated importando de `lib/colors.ts`.
- **Hit target:** 44×44 pt mínimo em qualquer `Pressable` (`min-w-[44px] min-h-[44px]` ou `hitSlop`).
- **Acessibilidade:** `accessibilityLabel` obrigatório em botão só-ícone; `accessibilityRole` em interativo.
- **Sem dark mode.** Não usar `dark:`.
- **Ícones:** `lucide-react-native` apenas.
- **Sem tags HTML**, com as exceções registradas em `apps/mobile/lib/no-html-tags.test.ts`. Este plano adiciona a segunda e **só** ela.
- **NativeWind não processa `className` em componente do Reanimated.** Layout em `style`, nunca em `className`, em `Animated.*`.
- **RLS sempre** em tabela com `user_id`.
- **Migrations imutáveis após merge.** Mudança nova = migration nova. Próximos números livres: **0081** e **0082**.
- **Nunca** subir `service_role` key para o cliente.
- **Resolução alvo do stream:** `{ width: { ideal: 1080 }, height: { ideal: 1920 } }` — casa com o export de 1080×1920 (`SHARE_CARD_WIDTH 360 × SHARE_EXPORT_SCALE 3`). É `ideal`, não requisito: o runtime usa o frame que vier e degrada para `CONSTRAINTS_MINIMAS` se a câmera recusar o tamanho. Nenhum código assume 1080.
- **Commits:** mensagem em português, escopo convencional (`feat(share):`, `fix(storage):`, `docs(...)`), terminando com `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **Comandos:** `npm run lint`, `npm run typecheck`, `npm test` (roda os três workspaces). Mobile isolado: `npm test --workspace apps/mobile`. Server/shared: `vitest run`.

---

## Estrutura de arquivos

**Fase A — pré-requisito de segurança (branch e PR separados)**

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0081_post_images_meal_photo_leak.sql` | restringe o SELECT de seguidor ao arquivo de post, em vez da pasta inteira do autor |
| `scripts/checks/share-camera-0-rls.sql` | prova o vazamento antes e a correção depois |
| `scripts/checks/share-camera-0-rls.sh` | runner, no molde de `m7-1-identity.sh` |

**Fase B — a câmera na web, e a medição**

| Arquivo | Responsabilidade |
|---|---|
| `apps/mobile/lib/media/camera-constraints.ts` | monta `MediaStreamConstraints`, classifica erro de câmera, decide degradação. Puro, sem DOM |
| `apps/mobile/lib/media/camera-constraints.test.ts` | — |
| `apps/mobile/lib/media/frame-capture.web.ts` | `HTMLVideoElement` → `{ uri, tamanho }` via `canvas.toBlob` |
| `apps/mobile/lib/media/frame-capture.web.test.ts` | — |
| `apps/mobile/components/domain/CameraLive.web.tsx` | preview ao vivo na web. **Única** tag HTML nova (`<video>`) |
| `apps/mobile/components/domain/CameraLive.web.test.tsx` | — |
| `apps/mobile/lib/no-html-tags.test.ts` | +`video`/`canvas` no regex; +a exceção nova |
| `apps/mobile/app/(app)/debug/camera.tsx` | rota de medição, temporária, removida na Tarefa 6 |

**Fase C — persistência**

| Arquivo | Responsabilidade |
|---|---|
| `packages/shared/src/schemas.ts` | `mealPhotoPath`, `image_path` no `MealResponseSchema`, `has_photo` no `PatchMealRequestSchema` |
| `packages/shared/src/meal-photo.test.ts` | — |
| `supabase/migrations/0082_meals_image_path.sql` | coluna + backfill do `raw_input` |
| `apps/server/src/services/meals.ts` | `image_path` no `MEAL_DETAIL_SELECT` |
| `apps/server/src/routes/meals.ts` | `buildMealPatch` exportado; o `PATCH` passa a usá-lo |
| `apps/server/src/routes/meals.test.ts` | — |
| `apps/mobile/lib/storage.ts` | `uploadMealPhoto` com `upsert: true` e `mealPhotoPath` |
| `apps/mobile/app/(app)/share/[type]/[id].tsx` | `loadCardData` lê `m.image_path` |

**Fase D — o palco da câmera**

| Arquivo | Responsabilidade |
|---|---|
| `apps/mobile/lib/share/presets.ts` | `presetsAoVivo()` |
| `apps/mobile/components/domain/ShareCard.tsx` | prop `fotoExterna` — desenha o cromo sem a foto, com fundo transparente |
| `apps/mobile/components/domain/share/CardPreview.tsx` | extraído da tela — encolhe o card em tamanho cheio para caber na área livre |
| `apps/mobile/components/domain/share/SharePresetCarousel.tsx` | extraído da tela |
| `apps/mobile/components/domain/share/ShareAdjustStage.tsx` | extraído da tela |
| `apps/mobile/components/domain/share/ShareCameraStage.tsx` | câmera + carrossel de cromo + obturador |
| `apps/mobile/components/domain/CameraLive.tsx` | preview ao vivo no nativo, via `expo-camera` |

**Por que a tela se quebra em componentes (Tarefa 14):** `app/(app)/share/[type]/[id].tsx` está em 462 linhas com três modos (carrossel, ajuste, palco de captura offscreen) numa cadeia de ternários. O quarto modo levaria a ~600. A tarefa é refator puro, sem mudança de comportamento, e vem **antes** do modo novo.

---

### Task 1: Corrigir o vazamento de foto de refeição para seguidores

**Branch e PR separados** — `fix/post-images-meal-photo-leak`, a partir de `dev`. Não misturar com o resto do plano.

**Files:**
- Create: `supabase/migrations/0081_post_images_meal_photo_leak.sql`
- Create: `scripts/checks/share-camera-0-rls.sql`
- Create: `scripts/checks/share-camera-0-rls.sh`

**Interfaces:**
- Consumes: nada.
- Produces: nada em código. Entrega a premissa de segurança de que a Fase C depende (ver spec, decisão D5).

**Contexto:** `supabase/migrations/0076_post_images_follower_select.sql` libera SELECT em `storage.objects` para quem segue o autor usando só `(storage.foldername(name))[1] = followee_id`. Isso casa com **qualquer** objeto sob `{authorId}/`, incluindo `{authorId}/meal-photos/{mealId}.jpg`, que é privado. A intenção, no comentário da própria migration, era liberar só a foto de post — que se chama `{authorId}/post-{postId}.jpg` (ver `uploadPostImage` em `apps/mobile/lib/storage.ts`).

- [ ] **Step 1: Escrever o check que prova o vazamento**

Cria `scripts/checks/share-camera-0-rls.sql`:

```sql
-- Vazamento de foto de refeição via post_images_follower_select (0076).
-- Monta dois usuários, um seguindo o outro, e pergunta à política se o
-- seguidor pode LER a foto de refeição do seguido.
\set ON_ERROR_STOP on
BEGIN;

-- Dois usuários reais em auth.users: as FKs de follows apontam para lá.
INSERT INTO auth.users (id, email)
VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'autor-rls@fitbrother.test'),
       ('bbbbbbbb-0000-4000-8000-000000000002', 'seguidor-rls@fitbrother.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.follows (follower_id, followee_id)
VALUES ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO storage.objects (bucket_id, name, owner)
VALUES
  ('post-images',
   'aaaaaaaa-0000-4000-8000-000000000001/meal-photos/cccccccc-0000-4000-8000-000000000003.jpg',
   'aaaaaaaa-0000-4000-8000-000000000001'),
  ('post-images',
   'aaaaaaaa-0000-4000-8000-000000000001/post-dddddddd-0000-4000-8000-000000000004.jpg',
   'aaaaaaaa-0000-4000-8000-000000000001')
ON CONFLICT (bucket_id, name) DO NOTHING;

-- Passa a ser o seguidor: as políticas de storage.objects leem auth.uid().
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims =
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

-- Check 1: a foto de refeição do seguido NÃO deve ser legível.
SELECT 'check_1_meal_photo_hidden' AS check,
       NOT EXISTS (
         SELECT 1 FROM storage.objects
         WHERE bucket_id = 'post-images'
           AND name LIKE 'aaaaaaaa-0000-4000-8000-000000000001/meal-photos/%'
       ) AS pass;

-- Check 2: a foto de POST do seguido DEVE continuar legível — é o que a 0076
-- existe para permitir, e a correção não pode levar isso embora.
SELECT 'check_2_post_photo_visible' AS check,
       EXISTS (
         SELECT 1 FROM storage.objects
         WHERE bucket_id = 'post-images'
           AND name LIKE 'aaaaaaaa-0000-4000-8000-000000000001/post-%'
       ) AS pass;

ROLLBACK;
```

- [ ] **Step 2: Escrever o runner**

Cria `scripts/checks/share-camera-0-rls.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "── RLS: foto de refeição não vaza para seguidor ──"
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/share-camera-0-rls.sql
echo "── done ──"
```

Depois: `chmod +x scripts/checks/share-camera-0-rls.sh`

- [ ] **Step 3: Rodar o check e ver o vazamento**

```bash
npm run db:start   # se o Supabase local não estiver de pé
npm run db:reset
./scripts/checks/share-camera-0-rls.sh
```

Esperado: `check_1_meal_photo_hidden | f` e `check_2_post_photo_visible | t`.

O `f` do check 1 **é o vazamento**, reproduzido. Se vier `t`, **pare e reporte**: a leitura da política estava errada e esta tarefa não tem motivo para existir.

- [ ] **Step 4: Escrever a migration**

Cria `supabase/migrations/0081_post_images_meal_photo_leak.sql`:

```sql
-- Correção da 0076. A política de seguidor casava com QUALQUER objeto sob
-- `{authorId}/`, e `meal-photos/` mora na mesma pasta — foto de refeição é
-- privada e estava legível para quem segue o autor. Pior: `storage.list()`
-- também é SELECT em storage.objects, então dava para enumerar.
--
-- A regra passa a casar o nome do arquivo de post (`{authorId}/post-{id}.jpg`,
-- ver `uploadPostImage`), que é o que a 0076 queria liberar.
DROP POLICY IF EXISTS post_images_follower_select ON storage.objects;

CREATE POLICY post_images_follower_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'post-images'
    AND name LIKE ((storage.foldername(name))[1] || '/post-%')
    AND EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid()
        AND f.followee_id::text = (storage.foldername(name))[1]
    )
  );
```

- [ ] **Step 5: Aplicar e rodar o check de novo**

```bash
npm run db:reset
./scripts/checks/share-camera-0-rls.sh
```

Esperado: `check_1_meal_photo_hidden | t` **e** `check_2_post_photo_visible | t`. Os dois `t`: o vazamento fechou e a visibilidade legítima sobreviveu.

- [ ] **Step 6: Conferir que o app de verdade não regrediu**

A foto de post de alguém que você segue tem que continuar abrindo. Rode o app na web, entre no feed com o usuário de teste e abra um post de outra pessoa que ele segue — a imagem tem que carregar (é `getPostImageSignedUrl`, que falha com 400 quando a RLS nega).

```bash
npm run dev:mobile
```

Se não houver follow com post no seed local, crie um antes. **Não marque este step como feito sem ter visto a imagem carregar.**

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0081_post_images_meal_photo_leak.sql scripts/checks/share-camera-0-rls.sql scripts/checks/share-camera-0-rls.sh
git commit -m "$(cat <<'EOF'
fix(storage): foto de refeição não vaza para quem segue

A post_images_follower_select (0076) casava com qualquer objeto sob
`{authorId}/`, e `meal-photos/` mora na mesma pasta. Quem seguia o autor
tinha SELECT nas fotos de refeição dele, que nunca foram publicadas — e
como `storage.list()` também é SELECT em storage.objects, dava para
enumerar em vez de adivinhar UUID.

A política passa a casar o nome do arquivo de post, que é o que ela
queria liberar. Check em scripts/checks/share-camera-0-rls.sql prova as
duas pontas: a foto de refeição fica escondida e a de post continua
visível.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

Abra o PR desta branch e **espere o merge** antes de seguir para a Tarefa 2 noutra branch (`feat/camera-ao-vivo-share`, a partir de `dev` já com a 0081).

---

### Task 2: `camera-constraints.ts` — constraints e classificação de erro

**Files:**
- Create: `apps/mobile/lib/media/camera-constraints.ts`
- Test: `apps/mobile/lib/media/camera-constraints.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type CameraErro = "indisponivel" | "negada" | "sem_camera"`
  - `const RESOLUCAO_ALVO: { width: 1080; height: 1920 }`
  - `constraintsDeCamera(alvo?: { width: number; height: number }): MediaStreamConstraints`
  - `const CONSTRAINTS_MINIMAS: MediaStreamConstraints`
  - `erroDeCamera(err: unknown): CameraErro`
  - `aceitaDegradar(err: unknown): boolean`

**Por que puro e separado:** é a única coisa desta feature que dá para testar sem navegador nem câmera, e é onde mora a decisão que o `CameraView` do expo-camera não deixa tomar (pedir 1080). Testar aqui vale mais que testar em qualquer outro ponto da Fase B.

- [ ] **Step 1: Escrever o teste que falha**

Cria `apps/mobile/lib/media/camera-constraints.test.ts`:

```ts
import { describe, expect, test } from "@jest/globals";
import {
  aceitaDegradar,
  CONSTRAINTS_MINIMAS,
  constraintsDeCamera,
  erroDeCamera,
  RESOLUCAO_ALVO,
} from "./camera-constraints";

/** `DOMException` com um `name` específico, que é o que o getUserMedia rejeita. */
function erroDom(name: string): DOMException {
  return new DOMException("falhou", name);
}

describe("constraintsDeCamera", () => {
  test("pede a câmera traseira e a resolução alvo", () => {
    const c = constraintsDeCamera();
    expect(c.audio).toBe(false);
    expect(c.video).toEqual({
      facingMode: { ideal: "environment" },
      width: { ideal: 1080 },
      height: { ideal: 1920 },
    });
  });

  test("o alvo é o retrato que casa com o card exportado", () => {
    // 360×640 do card × SHARE_EXPORT_SCALE 3 = 1080×1920. Pedir paisagem faria
    // o lado curto cair para 1080/1.78 e o export viraria upscale.
    expect(RESOLUCAO_ALVO).toEqual({ width: 1080, height: 1920 });
  });

  test("aceita um alvo diferente sem mexer no resto", () => {
    const c = constraintsDeCamera({ width: 720, height: 1280 });
    expect(c.video).toMatchObject({ width: { ideal: 720 }, height: { ideal: 1280 } });
  });

  test("as constraints mínimas não pedem resolução nenhuma", () => {
    // É o fallback do OverconstrainedError: sem pedido de tamanho, o
    // navegador entrega o que tiver em vez de recusar o stream.
    expect(CONSTRAINTS_MINIMAS).toEqual({ audio: false, video: true });
  });
});

describe("erroDeCamera", () => {
  test("permissão negada", () => {
    expect(erroDeCamera(erroDom("NotAllowedError"))).toBe("negada");
    // Safari usa SecurityError quando a origem não é segura o bastante.
    expect(erroDeCamera(erroDom("SecurityError"))).toBe("negada");
  });

  test("sem câmera no aparelho", () => {
    expect(erroDeCamera(erroDom("NotFoundError"))).toBe("sem_camera");
    expect(erroDeCamera(erroDom("DevicesNotFoundError"))).toBe("sem_camera");
  });

  test("qualquer outra coisa é indisponível", () => {
    expect(erroDeCamera(erroDom("NotReadableError"))).toBe("indisponivel");
    expect(erroDeCamera(new Error("getUserMedia ausente"))).toBe("indisponivel");
    expect(erroDeCamera(undefined)).toBe("indisponivel");
  });
});

describe("aceitaDegradar", () => {
  test("só o erro de constraint impossível vale uma segunda tentativa", () => {
    expect(aceitaDegradar(erroDom("OverconstrainedError"))).toBe(true);
    expect(aceitaDegradar(erroDom("ConstraintNotSatisfiedError"))).toBe(true);
    // Negar permissão de novo, sem constraint, seria pedir duas vezes a mesma
    // coisa e levar dois "não" na cara do usuário.
    expect(aceitaDegradar(erroDom("NotAllowedError"))).toBe(false);
    expect(aceitaDegradar(erroDom("NotFoundError"))).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
npm test --workspace apps/mobile -- camera-constraints
```

Esperado: FAIL com `Cannot find module './camera-constraints'`.

- [ ] **Step 3: Escrever a implementação**

Cria `apps/mobile/lib/media/camera-constraints.ts`:

```ts
/**
 * O que pedir ao `getUserMedia`, e o que fazer quando ele diz não.
 *
 * Puro de propósito: sem DOM, sem React. É aqui que mora a razão de a web ter
 * câmera própria em vez de usar o `CameraView` do expo-camera — ele nunca passa
 * largura/altura (`useWebCameraStream` → `getIdealConstraints(type, undefined,
 * undefined)` → `MinimumConstraints = { audio: false, video: true }`), e
 * `video: true` sem constraint é 640×480 no Safari e no Chrome Android.
 */

export type CameraErro = "indisponivel" | "negada" | "sem_camera";

/**
 * Retrato, não paisagem.
 *
 * O card exporta 1080×1920 (`SHARE_CARD_WIDTH 360 × SHARE_EXPORT_SCALE 3`).
 * Pedir 1920×1080 deixaria o lado curto em 1080 só na horizontal, e o recorte
 * 9:16 sobraria ~608px de largura — upscale de 1,78× no export. Pedindo retrato
 * o celular tende a entregar o sensor já na orientação certa.
 */
export const RESOLUCAO_ALVO = { width: 1080, height: 1920 } as const;

/** O pedido normal: traseira, na resolução alvo. */
export function constraintsDeCamera(
  alvo: { width: number; height: number } = RESOLUCAO_ALVO,
): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      // `ideal`, não `exact`: em desktop sem traseira o `exact` rejeita o
      // stream inteiro, e aí nem a webcam de testes funciona.
      facingMode: { ideal: "environment" },
      width: { ideal: alvo.width },
      height: { ideal: alvo.height },
    },
  };
}

/**
 * O pedido de segunda tentativa, sem resolução.
 *
 * Mesma degradação que o `getAnyUserMediaAsync` do expo-camera faz: quando a
 * câmera não consegue satisfazer o tamanho, é melhor um stream pequeno que
 * nenhum.
 */
export const CONSTRAINTS_MINIMAS: MediaStreamConstraints = { audio: false, video: true };

function nomeDoErro(err: unknown): string {
  return err instanceof Error ? err.name : "";
}

/** Traduz a rejeição do `getUserMedia` no motivo que a UI mostra. */
export function erroDeCamera(err: unknown): CameraErro {
  switch (nomeDoErro(err)) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "negada";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "sem_camera";
    default:
      return "indisponivel";
  }
}

/**
 * Se vale tentar de novo com `CONSTRAINTS_MINIMAS`.
 *
 * Só quando a câmera recusou o TAMANHO. Repetir depois de permissão negada
 * mostraria o diálogo duas vezes para receber o mesmo "não".
 */
export function aceitaDegradar(err: unknown): boolean {
  const nome = nomeDoErro(err);
  return nome === "OverconstrainedError" || nome === "ConstraintNotSatisfiedError";
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
npm test --workspace apps/mobile -- camera-constraints
```

Esperado: PASS, 8 testes.

- [ ] **Step 5: Lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/media/camera-constraints.ts apps/mobile/lib/media/camera-constraints.test.ts
git commit -m "$(cat <<'EOF'
feat(media): constraints de câmera e classificação de erro

Puro, sem DOM. Pede retrato 1080×1920 porque é o que o card exporta
(360×640 × scale 3); o CameraView do expo-camera não permite pedir
resolução nenhuma e cai em {video: true}, que é 640×480 no Safari.

Separa "negada" de "sem câmera" de "indisponível" porque a UI cai para a
galeria nos três mas só um deles merece tentar de novo — e a segunda
tentativa só acontece quando a recusa foi do tamanho, nunca da permissão.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `frame-capture.web.ts` — frame do vídeo em blob

**Files:**
- Create: `apps/mobile/lib/media/frame-capture.web.ts`
- Test: `apps/mobile/lib/media/frame-capture.web.test.ts`

**Interfaces:**
- Consumes: `Tamanho` de `apps/mobile/lib/media/crop.ts` (`{ width: number; height: number }`).
- Produces: `capturarFrame(video: HTMLVideoElement): Promise<{ uri: string; tamanho: Tamanho }>`

**Por que isolado:** é o único ponto da feature que toca canvas, e o `tamanho` que ele devolve alimenta o `fotoNatural` do `ShareCard` — sem as medidas certas o `Enquadramento` normalizado não se aplica. Também é onde a lição da feature passada entra: `canvas.toBlob` (assíncrono) em vez do `toDataURL` síncrono que o expo-camera usa, que bloqueia a thread.

- [ ] **Step 1: Escrever o teste que falha**

Cria `apps/mobile/lib/media/frame-capture.web.test.ts`:

```ts
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { capturarFrame } from "./frame-capture.web";

const drawImage = jest.fn();
const toBlob = jest.fn<(cb: (b: Blob | null) => void, tipo?: string, q?: number) => void>();
const getContext = jest.fn();

/** Canvas fake: só o que o `capturarFrame` usa. */
function canvasFake() {
  return { width: 0, height: 0, getContext, toBlob } as unknown as HTMLCanvasElement;
}

/** `<video>` fake com dimensões de frame. */
function videoFake(width: number, height: number) {
  return { videoWidth: width, videoHeight: height } as unknown as HTMLVideoElement;
}

describe("capturarFrame", () => {
  beforeEach(() => {
    drawImage.mockReset();
    getContext.mockReset();
    getContext.mockReturnValue({ drawImage } as never);
    toBlob.mockReset();
    toBlob.mockImplementation((cb) => cb(new Blob(["jpeg"], { type: "image/jpeg" })));
    jest.spyOn(document, "createElement").mockReturnValue(canvasFake() as never);
    jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:frame");
  });

  test("devolve blob URL e as dimensões reais do frame", async () => {
    const r = await capturarFrame(videoFake(1080, 1920));

    expect(r.uri).toBe("blob:frame");
    // O tamanho tem que ser o do FRAME, não o do elemento na tela: é ele que
    // o Enquadramento normalizado usa como medida natural da foto.
    expect(r.tamanho).toEqual({ width: 1080, height: 1920 });
  });

  test("desenha o frame inteiro, sem recorte", async () => {
    await capturarFrame(videoFake(1280, 720));

    // Guardamos o frame inteiro de propósito: a mesma foto serve o card 9:16,
    // a Home e um share futuro. Gravar o recorte aqui destruiria os outros.
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1280, 720);
  });

  test("pede JPEG, não PNG", async () => {
    await capturarFrame(videoFake(1080, 1920));

    // PNG de 1080×1920 é grande o bastante para pesar na memória da aba e no
    // upload, e foto de comida não ganha nada com sem-perdas.
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.9);
  });

  test("recusa frame sem dados em vez de devolver imagem vazia", async () => {
    await expect(capturarFrame(videoFake(0, 0))).rejects.toThrow("frame_sem_dados");
  });

  test("propaga falha do toBlob", async () => {
    toBlob.mockImplementation((cb) => cb(null));
    await expect(capturarFrame(videoFake(1080, 1920))).rejects.toThrow("frame_to_blob_failed");
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
npm test --workspace apps/mobile -- frame-capture
```

Esperado: FAIL com `Cannot find module './frame-capture.web'`.

- [ ] **Step 3: Escrever a implementação**

Cria `apps/mobile/lib/media/frame-capture.web.ts`:

```ts
import type { Tamanho } from "./crop";

/**
 * Congela o frame atual do vídeo num blob URL.
 *
 * `toBlob` e não `toDataURL`: o `toDataURL` é síncrono e codifica na thread
 * principal — é exatamente o custo que travou o carrossel de presets na feature
 * anterior (medido: 21 travadas somando 3803ms com a pré-captura, 6 somando
 * 843ms sem). O `captureImage` do expo-camera usa `toDataURL`, e sai PNG por
 * padrão; este caminho não.
 *
 * O `tamanho` devolvido é o do FRAME (`videoWidth`/`videoHeight`), não o do
 * elemento na tela. É ele que vira o `fotoNatural` do card, e o `Enquadramento`
 * normalizado depende dessa medida para o recorte bater nos três tamanhos
 * (preview, palco de captura e imagem final).
 */
export async function capturarFrame(
  video: HTMLVideoElement,
): Promise<{ uri: string; tamanho: Tamanho }> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  // Sem isso o canvas sai 0×0 e o blob é uma imagem vazia — que falha depois,
  // longe daqui, como "foto que não aparece".
  if (!width || !height) throw new Error("frame_sem_dados");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // `alpha: false`: frame de câmera é opaco, e o contexto sem alpha compõe mais
  // rápido.
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas_sem_contexto");

  ctx.drawImage(video, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });
  if (!blob) throw new Error("frame_to_blob_failed");

  return { uri: URL.createObjectURL(blob), tamanho: { width, height } };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
npm test --workspace apps/mobile -- frame-capture
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/media/frame-capture.web.ts apps/mobile/lib/media/frame-capture.web.test.ts
git commit -m "$(cat <<'EOF'
feat(media): frame do vídeo em blob, sem bloquear a thread

canvas.toBlob em vez do toDataURL síncrono que o expo-camera usa — é o
mesmo custo que travou o carrossel de presets antes, e o default dele
ainda é PNG.

Devolve as dimensões do frame junto: é a medida natural que o
Enquadramento normalizado precisa para o recorte bater no preview, no
palco de captura e na imagem final.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `CameraLive.web.tsx` — o preview ao vivo, e a segunda exceção de HTML

**Files:**
- Modify: `apps/mobile/lib/no-html-tags.test.ts` (regex + exceção)
- Create: `apps/mobile/components/domain/CameraLive.web.tsx`
- Test: `apps/mobile/components/domain/CameraLive.web.test.tsx`

**Interfaces:**
- Consumes: `constraintsDeCamera`, `CONSTRAINTS_MINIMAS`, `erroDeCamera`, `aceitaDegradar`, `CameraErro` (Tarefa 2); `capturarFrame` (Tarefa 3); `Tamanho` de `lib/media/crop.ts`.
- Produces:
  - `type CameraLiveHandle = { capturar: () => Promise<void> }`
  - `type CameraLiveProps = { aspect: number; ref?: Ref<CameraLiveHandle>; onReady?: () => void; onCapture: (uri: string, tamanho: Tamanho) => void; onError: (motivo: CameraErro) => void }`
  - `function CameraLive(props: CameraLiveProps): JSX.Element`

**Ordem dos steps importa:** o guard é consertado **primeiro**. `video` e `canvas` não estão no `TAGS_HTML` hoje, então um `<video>` passaria batido — escrever o componente antes seria aproveitar a falha do guard em vez de fechá-la.

- [ ] **Step 1: Fechar o buraco do guard e ver a exceção faltando**

Em `apps/mobile/lib/no-html-tags.test.ts`, trocar o regex:

```ts
/** Tags HTML que alguém escreveria por engano num componente RN. */
const TAGS_HTML =
  /<\/?(?:div|span|img|video|canvas|p|a|h[1-6]|button|input|section|header|footer|ul|ol|li|table|form|label)[\s/>]/;
```

E registrar a exceção nova em `EXCECOES`, junto da que já existe:

```ts
  "components/domain/CameraLive.web.tsx":
    "A pré-visualização ao vivo precisa consumir um MediaStream, e `<video>` é " +
    "o único elemento que consome. O `CameraView` do expo-camera, que monta " +
    "esse vídeo por dentro, nunca passa width/height ao getUserMedia " +
    "(`useWebCameraStream` → `getIdealConstraints(type, undefined, undefined)` " +
    "→ `MinimumConstraints = { audio: false, video: true }`), e isso é 640×480 " +
    "no Safari contra um card exportado em 1080×1920. Com constraints próprias " +
    "pedimos o sensor de verdade.",
```

- [ ] **Step 2: Rodar o guard e ver falhar**

```bash
npm test --workspace apps/mobile -- no-html-tags
```

Esperado: FAIL em `toda exceção é de um arquivo só da web`? Não — esse passa. Falha em `components/domain/CameraLive.web.tsx`, com `expect(usaHtml).toBe(true)` recebendo `false`: o guard exige que a exceção registrada **de fato** use a tag, e o arquivo ainda não existe (o `walkTsx` não o encontra, então o caso nem roda).

Confirme qual é a falha de verdade rodando com `--verbose`. Se o teste passar inteiro, o `walkTsx` simplesmente não viu o arquivo inexistente — nesse caso siga para o Step 3 e o guard volta a ter o que dizer no Step 6.

- [ ] **Step 3: Escrever o teste do componente**

Cria `apps/mobile/components/domain/CameraLive.web.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { createRef } from "react";

const capturarFrame = jest.fn<() => Promise<{ uri: string; tamanho: { width: number; height: number } }>>();
jest.mock("@/lib/media/frame-capture.web", () => ({
  capturarFrame: (...a: unknown[]) => capturarFrame(...(a as [])),
}));

import { CameraLive, type CameraLiveHandle } from "./CameraLive.web";

const stopTrack = jest.fn();
const getUserMedia = jest.fn<() => Promise<MediaStream>>();
const originalMediaDevices = navigator.mediaDevices;

function streamFake() {
  return { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
}

function erroDom(name: string) {
  return new DOMException("falhou", name);
}

describe("CameraLive na web", () => {
  beforeEach(() => {
    stopTrack.mockReset();
    getUserMedia.mockReset();
    getUserMedia.mockResolvedValue(streamFake());
    capturarFrame.mockReset();
    capturarFrame.mockResolvedValue({ uri: "blob:frame", tamanho: { width: 1080, height: 1920 } });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  test("pede a câmera traseira em 1080×1920", async () => {
    await act(async () => {
      render(<CameraLive aspect={360 / 640} onCapture={jest.fn()} onError={jest.fn()} />);
    });

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1080 },
        height: { ideal: 1920 },
      },
    });
  });

  test("tenta de novo sem resolução quando a câmera recusa o tamanho", async () => {
    getUserMedia.mockRejectedValueOnce(erroDom("OverconstrainedError"));
    const onError = jest.fn();

    await act(async () => {
      render(<CameraLive aspect={360 / 640} onCapture={jest.fn()} onError={onError} />);
    });

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: false, video: true });
    expect(onError).not.toHaveBeenCalled();
  });

  test("permissão negada avisa sem segunda tentativa", async () => {
    getUserMedia.mockRejectedValue(erroDom("NotAllowedError"));
    const onError = jest.fn();

    await act(async () => {
      render(<CameraLive aspect={360 / 640} onCapture={jest.fn()} onError={onError} />);
    });

    // Uma chamada só: pedir de novo mostraria o diálogo duas vezes para
    // receber o mesmo "não".
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("negada");
  });

  test("sem getUserMedia nenhum, avisa indisponível", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    const onError = jest.fn();

    await act(async () => {
      render(<CameraLive aspect={360 / 640} onCapture={jest.fn()} onError={onError} />);
    });

    // É o caso de http sem TLS e de webview do Instagram — o que faz a tela
    // cair para a galeria.
    expect(onError).toHaveBeenCalledWith("indisponivel");
  });

  test("capturar entrega uri e tamanho", async () => {
    const onCapture = jest.fn();
    const ref = createRef<CameraLiveHandle>();

    await act(async () => {
      render(<CameraLive ref={ref} aspect={360 / 640} onCapture={onCapture} onError={jest.fn()} />);
    });
    await act(async () => {
      await ref.current?.capturar();
    });

    expect(onCapture).toHaveBeenCalledWith("blob:frame", { width: 1080, height: 1920 });
  });

  test("para os tracks ao desmontar", async () => {
    let tela: ReturnType<typeof render> | undefined;
    await act(async () => {
      tela = render(<CameraLive aspect={360 / 640} onCapture={jest.fn()} onError={jest.fn()} />);
    });

    await act(async () => {
      tela?.unmount();
    });

    // Sem isso a luz da câmera fica acesa depois de sair da tela — é o que o
    // CameraView do expo-camera deixa acontecer em alguns casos.
    expect(stopTrack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

```bash
npm test --workspace apps/mobile -- CameraLive
```

Esperado: FAIL com `Cannot find module './CameraLive.web'`.

- [ ] **Step 5: Escrever a implementação**

Cria `apps/mobile/components/domain/CameraLive.web.tsx`:

```tsx
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import {
  aceitaDegradar,
  CONSTRAINTS_MINIMAS,
  constraintsDeCamera,
  erroDeCamera,
  type CameraErro,
} from "@/lib/media/camera-constraints";
import { capturarFrame } from "@/lib/media/frame-capture.web";

import type { Ref } from "react";
import type { Tamanho } from "@/lib/media/crop";

export type CameraLiveHandle = {
  /** Congela o frame atual e chama `onCapture`. */
  capturar: () => Promise<void>;
};

export type CameraLiveProps = {
  /** Proporção do quadro visível. O card de story é 360/640. */
  aspect: number;
  ref?: Ref<CameraLiveHandle>;
  onReady?: () => void;
  onCapture: (uri: string, tamanho: Tamanho) => void;
  onError: (motivo: CameraErro) => void;
};

/**
 * Preview ao vivo da câmera, na web.
 *
 * **Não usa o `CameraView` do expo-camera** — ver `camera-constraints.ts` para
 * a medida que justifica isso, e `lib/no-html-tags.test.ts` para a exceção de
 * `<video>` que isto cobra.
 *
 * O vídeo preenche o quadro com `object-fit: cover`, então o que a pessoa vê é
 * o recorte central do frame. O frame guardado é o INTEIRO (ver
 * `capturarFrame`): o recorte continua sendo decisão do `Enquadramento`, por
 * uso, e não algo gravado na captura.
 */
export function CameraLive({ aspect, ref, onReady, onCapture, onError }: CameraLiveProps) {
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let vivo = true;

    async function abrir() {
      const pedir = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
      // Contexto não seguro (http sem TLS) e webview restrita caem aqui: o
      // objeto simplesmente não existe.
      if (!pedir) {
        onError("indisponivel");
        return;
      }

      let s: MediaStream;
      try {
        s = await pedir(constraintsDeCamera());
      } catch (err) {
        if (!aceitaDegradar(err)) {
          onError(erroDeCamera(err));
          return;
        }
        try {
          s = await pedir(CONSTRAINTS_MINIMAS);
        } catch (err2) {
          onError(erroDeCamera(err2));
          return;
        }
      }

      // Desmontou no meio do await: o stream já foi aberto e ninguém mais vai
      // fechá-lo pelo cleanup, então fecha aqui.
      if (!vivo) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }

      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        // `play()` explícito: `autoPlay` sozinho não basta no Safari quando o
        // elemento recebe o srcObject depois de montar.
        video.current.play().catch(() => {});
      }
      setPronto(true);
      onReady?.();
    }

    abrir();

    return () => {
      vivo = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
    // Monta uma vez: reabrir a câmera a cada render do pai faria a imagem
    // piscar e pediria permissão de novo em alguns navegadores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capturar = useCallback(async () => {
    if (!video.current || !pronto) return;
    const { uri, tamanho } = await capturarFrame(video.current);
    onCapture(uri, tamanho);
  }, [pronto, onCapture]);

  useImperativeHandle(ref, () => ({ capturar }), [capturar]);

  return (
    <View style={{ width: "100%", aspectRatio: aspect }} className="overflow-hidden bg-neutral-900">
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </View>
  );
}
```

- [ ] **Step 6: Rodar os dois testes e ver passar**

```bash
npm test --workspace apps/mobile -- CameraLive no-html-tags
```

Esperado: PASS nos 6 testes do componente **e** no guard — que agora encontra o `<video>` na exceção registrada, vigia `video`/`canvas` nos outros arquivos, e confirma que a exceção é `.web.tsx`.

- [ ] **Step 7: Rodar a suíte inteira do mobile**

```bash
npm test --workspace apps/mobile
```

Esperado: PASS. O regex novo passa a vigiar `video`/`canvas` em todo `.tsx` de `app/` e `components/` — se algum arquivo já tinha uma dessas tags sem exceção registrada, é agora que aparece. Se aparecer, **pare e reporte** em vez de adicionar exceção.

- [ ] **Step 8: Lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/components/domain/CameraLive.web.tsx apps/mobile/components/domain/CameraLive.web.test.tsx apps/mobile/lib/no-html-tags.test.ts
git commit -m "$(cat <<'EOF'
feat(camera): preview ao vivo na web, com constraints próprias

O CameraView do expo-camera não serve: useWebCameraStream nunca passa
width/height, cai em MinimumConstraints = {video: true}, e isso é 640×480
no Safari contra um card exportado em 1080×1920.

Com getUserMedia próprio dá para pedir o sensor, parar os tracks no
unmount (o CameraView deixa a luz acesa em alguns casos) e tratar a
permissão do Safari direto — o caminho web do useCameraPermissions usa
navigator.permissions.query({name:'camera'}), que o Safari não
implementa.

O guard de tags HTML ganha `video` e `canvas` ANTES da exceção: as duas
não estavam na lista, e um <video> passaria batido. Fechar o buraco e
então registrar a exceção, em vez de aproveitá-lo.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Rota de medição

**Files:**
- Create: `apps/mobile/app/(app)/debug/camera.tsx`

**Interfaces:**
- Consumes: `CameraLive`, `CameraLiveHandle` (Tarefa 4); `CameraErro` (Tarefa 2).
- Produces: nada. Arquivo **temporário**, apagado no Step 5 da Tarefa 6.

**Por que existe:** o risco nº 1 do spec é a resolução real que o aparelho entrega, e ele não é mensurável nesta máquina — o Chrome daqui só tem câmera falsa em 640×480. Esta rota existe para rodar no celular do dono e devolver um número.

- [ ] **Step 1: Escrever a rota**

Cria `apps/mobile/app/(app)/debug/camera.tsx`:

```tsx
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraLive, type CameraLiveHandle } from "@/components/domain/CameraLive";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/share/geometry";

import type { CameraErro } from "@/lib/media/camera-constraints";
import type { Tamanho } from "@/lib/media/crop";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

/** Lado curto mínimo para o export de 1080×1920 não virar upscale. */
const LADO_CURTO_ALVO = 1080;

/**
 * Medição de resolução de câmera. Temporária — sai junto com a Tarefa 6.
 *
 * Não tem preset, não tem carrossel e não sobe nada. A única pergunta é qual
 * frame o aparelho entrega quando pedimos retrato 1080×1920.
 */
export default function DebugCameraScreen() {
  const camera = useRef<CameraLiveHandle>(null);
  const [frame, setFrame] = useState<Tamanho | null>(null);
  const [erro, setErro] = useState<CameraErro | null>(null);

  const curto = frame ? Math.min(frame.width, frame.height) : 0;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 px-4">
      <Text className="py-3 text-xl font-display-bold text-neutral-800">Medir câmera</Text>

      {erro ? (
        <Text className="font-sans-medium text-danger-500">Falhou: {erro}</Text>
      ) : (
        <CameraLive
          ref={camera}
          aspect={SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT}
          onCapture={(_uri, tamanho) => setFrame(tamanho)}
          onError={setErro}
        />
      )}

      {frame ? (
        <View className="mt-4 rounded-2xl bg-white p-4">
          <Text style={NUM} className="text-2xl font-display-bold text-neutral-800">
            {`${frame.width}×${frame.height}`}
          </Text>
          <Text style={NUM} className="mt-1 font-sans text-neutral-600">
            {`lado curto ${curto} · alvo ${LADO_CURTO_ALVO}`}
          </Text>
          <Text
            className={[
              "mt-2 font-sans-semibold",
              curto >= LADO_CURTO_ALVO ? "text-success-500" : "text-warning-500",
            ].join(" ")}
          >
            {curto >= LADO_CURTO_ALVO
              ? "Sem upscale no export."
              : `Upscale de ${(LADO_CURTO_ALVO / curto).toFixed(2)}× no export.`}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => camera.current?.capturar()}
        accessibilityRole="button"
        accessibilityLabel="Medir o frame da câmera"
        className="mt-auto mb-4 min-h-[56px] items-center justify-center rounded-full bg-primary-400 active:bg-primary-500"
      >
        <Text className="text-base font-sans-bold text-white">Medir</Text>
      </Pressable>
    </SafeAreaView>
  );
}
```

**Atenção:** o import é `@/components/domain/CameraLive` (sem `.web`). O Metro resolve a extensão de plataforma. Na web ele pega o `.web.tsx` da Tarefa 4; no nativo ainda **não existe** arquivo (chega na Tarefa 17), então esta rota só roda na web até lá — o que é exatamente o escopo da medição, porque é na web que a resolução é o risco.

- [ ] **Step 2: Verificar na web local**

```bash
npm run dev:mobile
```

Abra `http://localhost:8081/debug/camera`, permita a câmera, toque em "Medir". Deve aparecer um par de números e o veredito. Com a câmera falsa do Chrome vai dar 640×480 e "Upscale de 1,69×" — isso é esperado aqui e **não** é o resultado que importa.

- [ ] **Step 3: Lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(app)/debug/camera.tsx"
git commit -m "$(cat <<'EOF'
chore(camera): rota temporária para medir resolução do stream

O risco nº 1 do spec é qual frame o aparelho entrega quando pedimos
retrato 1080×1920, e isso não é mensurável na máquina de desenvolvimento
— o Chrome daqui só tem câmera falsa em 640×480.

Sai junto com a medição.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: GATE — medir a resolução no aparelho

**Files:**
- Delete: `apps/mobile/app/(app)/debug/camera.tsx`
- Modify: `docs/superpowers/plans/2026-10-11-camera-ao-vivo-share.md` (registrar o número medido)

**Interfaces:**
- Consumes: a rota da Tarefa 5.
- Produces: o número que decide se a Fase D vale como desenhada.

**Este é um gate, não uma tarefa de código.** Não siga para a Tarefa 7 sem o número. E a medição é **do dono**, não do agente: exige um celular de verdade.

- [ ] **Step 1: Servir por HTTPS**

`getUserMedia` só existe em contexto seguro. `http://<ip-da-lan>:8081` **falha calado** — é o erro nº 3 do spec. Opções, em ordem de preferência:

```bash
# 1. Túnel do Expo (mais simples, dá URL https pública)
npx expo start --tunnel

# 2. Ou publicar o build web num preview e abrir de lá
npm run build:web
```

- [ ] **Step 2: Medir**

No celular, abrir `/debug/camera` pela URL https, permitir a câmera, tocar em "Medir". Anotar os três números que a tela mostra: largura, altura e lado curto.

Medir **duas vezes**: no Safari normal e com o app adicionado à tela de início (PWA standalone). O segundo caso é o risco nº 4 do spec — `getUserMedia` em web app de tela de início funciona desde iOS 13.4, mas isso nunca foi exercitado neste app.

- [ ] **Step 3: Registrar o resultado neste plano**

Substituir esta linha, abaixo, pelo que foi medido:

> **Medição (preencher na Tarefa 6):** pedido `1080×1920`. Safari: entregue `____×____`. PWA standalone: entregue `____×____`. Honrou? `___`. Data: `____`.

- [ ] **Step 4: Decidir**

**Não é um limiar de qualidade por aparelho.** O app funciona em qualquer
resolução: `capturarFrame` usa o `videoWidth`/`videoHeight` que vier, e
`aceitaDegradar` tenta de novo sem constraint quando a câmera recusa o tamanho.
Frame pequeno dá foto mais mole, não quebra nada — e nenhum número fica
gravado no caminho de runtime (`RESOLUCAO_ALVO` só alimenta o `ideal` do
pedido).

A pergunta é **uma só, sim ou não**: o navegador *honra* constraint `ideal` de
resolução? É a premissa da decisão D1 — a câmera própria, e a segunda exceção
de tag HTML que ela cobra, se justificam **apenas** porque permitem pedir
resolução, coisa que o `CameraView` não permite.

| Resultado | Leitura | Decisão |
|---|---|---|
| Entregue ≥ ~90% do pedido (ex.: 1080×1920, 1056×1408) | o navegador honra `ideal` | D1 de pé. Seguir para a Fase D. |
| Entregue muito abaixo, especialmente **640×480** (o default do `video: true`) | o navegador ignora `ideal` | **Pare e reporte.** D1 cai: a câmera própria não entrega nada que o `CameraView` não entregasse, e estaríamos carregando a exceção de `<video>` de graça. O caminho passa a ser usar o `CameraView` (ou câmera só para enquadrar + `<input capture>` para a foto). |

Um aparelho real basta para responder isso — não é preciso varrer modelos. Se
honrar num iPhone, a premissa está provada; se um iPhone ignorar tendo pedido,
está refutada.

Anote o número junto, mas como informação secundária: ele diz se o export de
1080×1920 vai ter upscale (foto mais mole), não se a feature vale.

Se o PWA standalone falhar e o Safari normal funcionar, **reporte** — a feature continua valendo, mas o fallback para galeria passa a ser o caminho principal de quem instalou o app, e isso muda o texto da UI.

- [ ] **Step 5: Apagar a rota de medição**

```bash
git rm "apps/mobile/app/(app)/debug/camera.tsx"
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-10-11-camera-ao-vivo-share.md
git commit -m "$(cat <<'EOF'
chore(camera): registra a resolução medida e remove a rota de debug

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `mealPhotoPath` em shared — uma definição só

**Files:**
- Modify: `packages/shared/src/schemas.ts`
- Test: `packages/shared/src/meal-photo.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `mealPhotoPath(userId: string, mealId: string): string`

**Por que em shared:** a convenção vive hoje só em `apps/mobile/lib/storage.ts:128`, interpolada inline. A partir da Tarefa 9 o servidor também precisa dela (ele é quem escreve `image_path`, ver decisão D5 do spec). Duas cópias de uma convenção de path é como se produz foto órfã — o cliente sobe em um lugar e o servidor aponta para outro.

- [ ] **Step 1: Escrever o teste que falha**

Cria `packages/shared/src/meal-photo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mealPhotoPath } from "./schemas.js";

describe("mealPhotoPath", () => {
  it("monta o path dentro da pasta do usuário", () => {
    // A RLS de storage exige `(storage.foldername(name))[1] = auth.uid()`:
    // o id do usuário TEM que ser o primeiro segmento.
    expect(mealPhotoPath("user-1", "meal-1")).toBe("user-1/meal-photos/meal-1.jpg");
  });

  it("mantém a subpasta que separa foto de refeição de foto de post", () => {
    const path = mealPhotoPath("11111111-1111-4111-8111-111111111111", "meal-9");
    // `meal-photos/` é o que a política corrigida na Tarefa 1 usa para
    // distinguir o privado do publicado.
    expect(path).toContain("/meal-photos/");
    expect(path).not.toContain("/post-");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test --workspace packages/shared
```

Esperado: FAIL com `"mealPhotoPath" is not exported by "src/schemas.ts"`.

- [ ] **Step 3: Escrever a implementação**

Em `packages/shared/src/schemas.ts`, perto do `MealResponseSchema`:

```ts
/**
 * Onde mora a foto de uma refeição no bucket `post-images`.
 *
 * Vive aqui, e não no cliente, porque o upload é feito pelo app e a escrita de
 * `meals.image_path` é feita pelo servidor (que deriva o path do `auth.uid()`
 * em vez de aceitá-lo do cliente). Duas cópias desta convenção produziriam
 * foto órfã: subida num lugar, apontada em outro.
 *
 * O primeiro segmento é o id do usuário porque a RLS de storage exige
 * `(storage.foldername(name))[1] = auth.uid()`.
 */
export function mealPhotoPath(userId: string, mealId: string): string {
  return `${userId}/meal-photos/${mealId}.jpg`;
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test --workspace packages/shared
```

Esperado: PASS, 2 testes novos.

- [ ] **Step 5: Lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schemas.ts packages/shared/src/meal-photo.test.ts
git commit -m "$(cat <<'EOF'
feat(shared): mealPhotoPath como única definição da convenção

A convenção vivia interpolada inline em lib/storage.ts. O servidor passa
a precisar dela também, porque é ele que escreve meals.image_path
derivando do auth.uid() em vez de aceitar o path do cliente. Duas cópias
de uma convenção de path produzem foto órfã.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Migration — `meals.image_path` + backfill

**Files:**
- Create: `supabase/migrations/0082_meals_image_path.sql`
- Create: `scripts/checks/share-camera-1-image-path.sql`
- Create: `scripts/checks/share-camera-1-image-path.sh`

**Interfaces:**
- Consumes: nada (o backfill lê `raw_input`, que já existe).
- Produces: a coluna `public.meals.image_path text`, consumida pelas Tarefas 9, 10 e 11.

**Contexto:** `POST /meals/photo` guarda o caminho da foto só como texto, em `raw_input: 'Foto: ' || image_path` (`apps/server/src/routes/meals.ts:425`). A foto está no storage e nada no app a lê de volta. O backfill resgata isso.

**Sem constraint ligando `image_path` a `source`:** ao contrário de `audio_path`, que o `meals_audio_path_matches_source` amarra, uma foto pode chegar depois numa refeição registrada por texto, áudio ou código de barras. É exatamente o que esta feature faz.

- [ ] **Step 1: Escrever o check que falha**

Cria `scripts/checks/share-camera-1-image-path.sql`:

```sql
-- meals.image_path: coluna e backfill do raw_input.
\set ON_ERROR_STOP on
BEGIN;

-- Check 1: a coluna existe e é nullable.
SELECT 'check_1_coluna' AS check,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'meals'
           AND column_name = 'image_path'
           AND is_nullable = 'YES'
       ) AS pass;

-- Check 2: o backfill resgatou o path que vivia preso no raw_input.
DO $$
DECLARE
  v_user uuid;
  v_path text;
BEGIN
  SELECT user_id INTO v_user FROM public.profiles LIMIT 1;
  IF v_user IS NULL THEN RAISE NOTICE 'check_2_skip: sem profiles'; RETURN; END IF;

  SELECT image_path INTO v_path
    FROM public.meals
   WHERE source = 'app_photo'
     AND raw_input LIKE 'Foto: %'
   LIMIT 1;

  IF v_path IS NULL THEN
    RAISE NOTICE 'check_2_skip: sem refeição app_photo no banco local';
  ELSIF v_path LIKE 'Foto: %' THEN
    RAISE EXCEPTION 'check_2_FAIL: backfill copiou o prefixo junto';
  ELSE
    RAISE NOTICE 'check_2_pass: %', v_path;
  END IF;
END $$;

-- Check 3: uma refeição de TEXTO aceita foto depois.
-- É o caso central da feature, e é por isso que não há constraint
-- ligando image_path a source.
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.meals WHERE source = 'app_text' LIMIT 1;
  IF v_id IS NULL THEN RAISE NOTICE 'check_3_skip: sem refeição app_text'; RETURN; END IF;
  UPDATE public.meals SET image_path = 'u/meal-photos/x.jpg' WHERE id = v_id;
  RAISE NOTICE 'check_3_pass';
END $$;

ROLLBACK;
```

Cria `scripts/checks/share-camera-1-image-path.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "── meals.image_path ──"
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/share-camera-1-image-path.sql
echo "── done ──"
```

Depois: `chmod +x scripts/checks/share-camera-1-image-path.sh`

- [ ] **Step 2: Rodar e ver falhar**

```bash
./scripts/checks/share-camera-1-image-path.sh
```

Esperado: `check_1_coluna | f`, e os checks 2 e 3 estourando com `column "image_path" does not exist`.

- [ ] **Step 3: Escrever a migration**

Cria `supabase/migrations/0082_meals_image_path.sql`:

```sql
-- Foto de refeição deixa de viver só no storage.
--
-- `POST /meals/photo` já subia a foto para
-- `post-images/{userId}/meal-photos/{mealId}.jpg`, mas guardava o caminho
-- apenas como texto em `raw_input: 'Foto: ' || path`. Resultado: a foto
-- existia e nada no app a lia de volta — a tela de compartilhar uma refeição
-- nunca tinha foto, e os presets que dependem dela (Moldura, Etiqueta,
-- Discreto) eram descartados.
--
-- Sem constraint ligando `image_path` a `source`, ao contrário de `audio_path`:
-- uma foto pode chegar DEPOIS, numa refeição registrada por texto, áudio ou
-- código de barras. É o caso central da feature de câmera no compartilhar.
ALTER TABLE public.meals ADD COLUMN image_path text;

-- Backfill: resgata o path de quem já registrou por foto. `substring(... from 7)`
-- pula exatamente os 6 caracteres de 'Foto: '.
UPDATE public.meals
   SET image_path = substring(raw_input from 7)
 WHERE source = 'app_photo'
   AND raw_input LIKE 'Foto: %'
   AND image_path IS NULL;
```

- [ ] **Step 4: Aplicar e ver passar**

```bash
npm run db:reset
./scripts/checks/share-camera-1-image-path.sh
```

Esperado: `check_1_coluna | t`, e `check_2_pass` / `check_3_pass` (ou os `skip` correspondentes, se o banco local não tiver refeição daquele tipo).

Se vier `check_2_FAIL: backfill copiou o prefixo junto`, o offset do `substring` está errado — `'Foto: '` tem 6 caracteres, então o texto começa no 7.

- [ ] **Step 5: Regenerar os tipos do banco**

```bash
npm run db:types
```

Confere que `packages/db-types/index.ts` passou a ter `image_path` em `meals`.

- [ ] **Step 6: Lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0082_meals_image_path.sql scripts/checks/share-camera-1-image-path.sql scripts/checks/share-camera-1-image-path.sh packages/db-types/index.ts
git commit -m "$(cat <<'EOF'
feat(db): meals.image_path, com backfill do raw_input

Registro por foto já subia a imagem, mas guardava o caminho só como
texto em raw_input ('Foto: ' || path). A foto existia no storage e nada
no app a lia de volta — compartilhar uma refeição nunca tinha foto, e os
presets que dependem dela eram descartados.

O backfill resgata quem já registrou por foto: eles ganham os presets
com foto sem precisar de câmera nenhuma.

Sem constraint ligando image_path a source, ao contrário de audio_path:
a foto pode chegar depois, numa refeição de texto ou áudio.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `has_photo` no PATCH — o servidor deriva o path

**Files:**
- Modify: `packages/shared/src/schemas.ts` (`PatchMealRequestSchema`, `MealResponseSchema`)
- Modify: `apps/server/src/services/meals.ts:28` (`MEAL_DETAIL_SELECT`)
- Modify: `apps/server/src/routes/meals.ts:599-612` (o `PATCH`)
- Test: `apps/server/src/routes/meals.test.ts`

**Interfaces:**
- Consumes: `mealPhotoPath` (Tarefa 7); a coluna `image_path` (Tarefa 8).
- Produces:
  - `buildMealPatch(input: PatchMealRequest, ctx: { userId: string; mealId: string }): Record<string, unknown>` — exportado de `apps/server/src/routes/meals.ts`
  - `has_photo?: boolean` no `PatchMealRequestSchema`
  - `image_path?: string | null` no `MealResponseSchema`

**Decisão D5 do spec, em código:** o corpo **não** aceita `image_path`. Aceita `has_photo: true`, e o servidor monta o path a partir do `req.user!.id`. Um cliente malicioso não tem onde apontar.

**Padrão de teste deste repositório:** `apps/server/src/routes/account.test.ts` testa helpers puros exportados da rota (`isOwnedAvatarPath`, `jwtClaims`), não a rota montada. `buildMealPatch` segue esse molde — é o que torna a decisão testável.

- [ ] **Step 1: Escrever o teste que falha**

Cria `apps/server/src/routes/meals.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildMealPatch } from "./meals.js";

const CTX = { userId: "user-1", mealId: "meal-1" };

describe("buildMealPatch", () => {
  it("deriva image_path do usuário autenticado quando has_photo é true", () => {
    expect(buildMealPatch({ has_photo: true }, CTX)).toEqual({
      image_path: "user-1/meal-photos/meal-1.jpg",
    });
  });

  it("ignora image_path vindo do corpo", () => {
    // Decisão D5: o cliente não manda caminho. Com o vazamento da 0076 ele
    // poderia apontar para a foto de alguém que segue, e a URL assinada
    // funcionaria. Mesmo corrigido, validar path do cliente é superfície que
    // não precisa existir.
    const patch = buildMealPatch(
      { has_photo: true, image_path: "outro-user/meal-photos/alheia.jpg" } as never,
      CTX,
    );
    expect(patch.image_path).toBe("user-1/meal-photos/meal-1.jpg");
  });

  it("has_photo false não mexe em image_path", () => {
    // Não é "apagar a foto" — é "não estou falando de foto agora". Remover
    // foto não é um caso que esta feature tem.
    expect(buildMealPatch({ has_photo: false }, CTX)).toEqual({});
  });

  it("continua montando os campos que já existiam", () => {
    expect(
      buildMealPatch({ meal_type: "lunch", consumed_at: "2026-10-11T12:00:00.000Z" }, CTX),
    ).toEqual({ meal_type: "lunch", consumed_at: "2026-10-11T12:00:00.000Z" });
  });

  it("devolve objeto vazio quando não há nada para mudar", () => {
    // A rota usa isso para decidir se faz UPDATE: um patch vazio não deve
    // disparar escrita nenhuma.
    expect(buildMealPatch({}, CTX)).toEqual({});
  });

  it("combina foto com os outros campos", () => {
    expect(buildMealPatch({ has_photo: true, meal_type: "dinner" }, CTX)).toEqual({
      meal_type: "dinner",
      image_path: "user-1/meal-photos/meal-1.jpg",
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test --workspace apps/server
```

Esperado: FAIL com `"buildMealPatch" is not exported by "src/routes/meals.ts"`.

- [ ] **Step 3: Estender os schemas**

Em `packages/shared/src/schemas.ts`, no `PatchMealRequestSchema`:

```ts
export const PatchMealRequestSchema = z.object({
  // Optional fields — only present ones get updated.
  meal_type: MealTypeSchema.optional(),
  consumed_at: z.string().datetime().optional(),
  // If provided, server replaces all items with this list (full PUT semantics
  // for items). Easier client logic than mixing patch + delete + add.
  items: z.array(PatchMealItemSchema).min(1).optional(),
  // Foto: o cliente só diz QUE subiu uma, nunca PARA ONDE. O servidor monta o
  // path com `mealPhotoPath(auth.uid(), id)`. Aceitar `image_path` do cliente
  // seria superfície de ataque sem ganho — ele já sabe o path, porque é a
  // mesma função que o upload usa.
  has_photo: z.boolean().optional(),
});
```

E no `MealResponseSchema`, junto de `audio_path`:

```ts
  audio_path: z.string().nullable(),
  // `.optional()` além de `.nullable()`: web e servidor sobem em deploys
  // separados, e um cliente novo falando com um servidor que ainda não tem a
  // coluna receberia o campo ausente, não nulo. O `.optional()` faz isso ser
  // "sem foto" em vez de erro de parse.
  image_path: z.string().nullable().optional(),
```

- [ ] **Step 4: Levar `image_path` ao SELECT**

Em `apps/server/src/services/meals.ts:28`:

```ts
export const MEAL_DETAIL_SELECT = `
  id, source, raw_input, audio_path, image_path, meal_type, consumed_at,
  total_kcal, total_protein_g, total_carbs_g, total_fat_g,
  confidence, review_required, ai_feedback, created_at, deleted_at,
  items:meal_items(
    id, food_id, description, quantity, unit,
    kcal, protein_g, carbs_g, fat_g, density_assumed
  )
`;
```

Lista explícita de colunas: sem esta linha a coluna existe no banco e **nunca chega ao app**.

- [ ] **Step 5: Extrair `buildMealPatch` e ligar na rota**

Em `apps/server/src/routes/meals.ts`, adicionar o import de `mealPhotoPath` ao bloco que já importa de `@fitbrother/shared`, e a função perto de `loadMeal`:

```ts
/**
 * Os campos que um PATCH de refeição vai escrever.
 *
 * Exportado para teste — mesmo molde de `isOwnedAvatarPath` em `account.ts`.
 *
 * `has_photo` NÃO carrega caminho: o path sai de `mealPhotoPath(userId, mealId)`,
 * com o `userId` do token. Aceitar `image_path` do corpo deixaria um cliente
 * apontar `meals.image_path` para o arquivo de outra pessoa — e a RLS de storage
 * não protege disso, porque ela governa quem LÊ o objeto, não o que a linha de
 * `meals` diz.
 */
export function buildMealPatch(
  input: PatchMealRequest,
  ctx: { userId: string; mealId: string },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.meal_type) patch.meal_type = input.meal_type;
  if (input.consumed_at) patch.consumed_at = input.consumed_at;
  // Só `true` escreve. `false` significa "não estou falando de foto", não
  // "apague a foto" — remover foto não é um caso que exista hoje.
  if (input.has_photo === true) {
    patch.image_path = mealPhotoPath(ctx.userId, ctx.mealId);
  }
  return patch;
}
```

E dentro do handler do `PATCH`, substituir as quatro linhas que montavam o patch à mão:

```ts
    const supabase = supabaseForRequest(req);
    const patch = buildMealPatch(parsed.data, {
      userId: req.user!.id,
      mealId: req.params.id,
    });

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("meals").update(patch).eq("id", req.params.id);
      if (error) return internalError(reply, req.log, error, { where: "meal_patch" });
    }
```

Garanta que `PatchMealRequest` está entre os tipos importados de `@fitbrother/shared` no topo do arquivo.

- [ ] **Step 6: Rodar e ver passar**

```bash
npm test --workspace apps/server && npm test --workspace packages/shared
```

Esperado: PASS, 6 testes novos no server.

- [ ] **Step 7: Lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/schemas.ts apps/server/src/services/meals.ts apps/server/src/routes/meals.ts apps/server/src/routes/meals.test.ts
git commit -m "$(cat <<'EOF'
feat(meals): PATCH aceita has_photo e o servidor deriva o path

O cliente diz QUE subiu uma foto, nunca PARA ONDE — o path sai de
mealPhotoPath(auth.uid(), id). Aceitar image_path do corpo deixaria
apontar meals.image_path para o arquivo de outra pessoa, e a RLS de
storage não protege disso: ela governa quem lê o objeto, não o que a
linha de meals diz. Teste fixa a decisão contra regressão.

buildMealPatch sai da rota como helper exportado, mesmo molde do
isOwnedAvatarPath em account.ts — é o que torna a decisão testável no
padrão deste repositório.

image_path entra no MEAL_DETAIL_SELECT: é lista explícita de colunas, e
sem isso a coluna existiria no banco sem nunca chegar ao app.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `uploadMealPhoto` — upsert e `mealPhotoPath`

**Files:**
- Modify: `apps/mobile/lib/storage.ts:127-139`
- Modify: `apps/mobile/lib/storage.test.ts:44-49`

**Interfaces:**
- Consumes: `mealPhotoPath` (Tarefa 7).
- Produces: `uploadMealPhoto` com a mesma assinatura, agora idempotente.

**Por que:** hoje é `upsert: false`. Refotografar a mesma refeição — exatamente o que a câmera no compartilhar permite — falharia com conflito de objeto já existente.

- [ ] **Step 1: Ajustar o teste que existe e ver falhar**

Em `apps/mobile/lib/storage.test.ts`, o teste `"uploads a non-empty Blob on web"` espera `upsert: false`. Trocar a expectativa:

```ts
    expect(mockUpload).toHaveBeenCalledWith("user-1/meal-photos/meal-1.jpg", blob, {
      contentType: "image/png",
      upsert: true,
    });
```

E adicionar um teste que fixa o motivo:

```ts
  test("refotografar a mesma refeição sobrescreve em vez de conflitar", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    const blob = new Blob(["image-bytes"], { type: "image/jpeg" });
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(blob, { status: 200 }));

    await uploadMealPhoto({ userId: "user-1", mealId: "meal-1", fileUri: "blob:primeira" });
    await uploadMealPhoto({ userId: "user-1", mealId: "meal-1", fileUri: "blob:segunda" });

    // O path é determinístico (userId + mealId), então a segunda foto bate no
    // mesmo objeto. Sem upsert isso é 409 — e tirar outra foto da mesma
    // refeição é o caso normal da câmera no compartilhar.
    expect(mockUpload).toHaveBeenCalledTimes(2);
    for (const chamada of mockUpload.mock.calls) {
      expect(chamada[0]).toBe("user-1/meal-photos/meal-1.jpg");
      expect(chamada[2]).toMatchObject({ upsert: true });
    }
  });
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test --workspace apps/mobile -- storage
```

Esperado: FAIL — os dois testes reclamando de `upsert: false`.

- [ ] **Step 3: Implementar**

Em `apps/mobile/lib/storage.ts`, adicionar o import e trocar a função:

```ts
import { mealPhotoPath } from "@fitbrother/shared";
```

```ts
/**
 * Sobe a foto de uma refeição.
 *
 * `upsert: true` porque o path é determinístico (`{userId}/meal-photos/{mealId}.jpg`,
 * ver `mealPhotoPath`): tirar outra foto da mesma refeição — o caso normal da
 * câmera na tela de compartilhar — bate no mesmo objeto, e sem upsert isso é
 * 409.
 */
export async function uploadMealPhoto(params: {
  userId: string;
  mealId: string;
  fileUri: string;
}): Promise<{ path: string }> {
  const path = mealPhotoPath(params.userId, params.mealId);
  const { body, contentType } = await imageUploadBody(params.fileUri, `${params.mealId}.jpg`);

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, body, { contentType, upsert: true });

  if (error) throw error;
  return { path };
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test --workspace apps/mobile -- storage
```

Esperado: PASS.

- [ ] **Step 5: Lint e typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/storage.ts apps/mobile/lib/storage.test.ts
git commit -m "$(cat <<'EOF'
fix(storage): foto de refeição sobrescreve em vez de conflitar

O path é determinístico, então refotografar a mesma refeição batia no
mesmo objeto e falhava com 409 — e tirar outra foto é o caso normal da
câmera na tela de compartilhar.

Passa a usar mealPhotoPath em vez de interpolar o path inline.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: A tela de compartilhar lê `image_path`

**Files:**
- Modify: `apps/mobile/app/(app)/share/[type]/[id].tsx:58-78` (`loadCardData`, ramo `meal`)

**Interfaces:**
- Consumes: `image_path` no `MealResponse` (Tarefa 9); `imagemUtilizavel`, que já existe no arquivo.
- Produces: `ShareCardData.imageUrl` preenchido para refeição com foto. Consumido pela Fase D.

**Entrega sozinha:** depois desta tarefa, quem registrou por foto passa a ver Moldura, Etiqueta e Discreto ao compartilhar uma refeição — **sem câmera nenhuma**, pelo backfill da Tarefa 8. É o ganho de tabela que o spec prometeu, e é verificável no navegador.

- [ ] **Step 1: Implementar**

Em `loadCardData`, no ramo `type === "meal"`, trocar as três linhas do `imageUrl`:

```ts
      // Foto de refeição deixou de viver só no storage: a 0082 criou
      // `meals.image_path` e fez backfill de quem já registrou por foto. Sem
      // isto, `presetsFor` continuava descartando Moldura, Etiqueta e Discreto
      // em toda refeição.
      imageUrl: await imagemUtilizavel(m.image_path ?? null),
```

Nada mais muda: `imagemUtilizavel` já assina a URL e converte para data URI quando preciso (o html2canvas "tainta" o canvas com imagem cross-origin), e `presetsFor` já reage à presença da foto.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Esperado: PASS. Se reclamar que `image_path` não existe em `MealResponse`, a Tarefa 9 não foi concluída.

- [ ] **Step 3: Verificar no navegador**

```bash
npm run dev:mobile
```

1. Entrar com o usuário de teste local (`dev@fitbrother.test`).
2. Registrar uma refeição **por foto** (botão de foto no composer da Home) — ou usar uma que já exista com `source='app_photo'`.
3. Abrir a tela de compartilhar daquela refeição.
4. Confirmar que o carrossel passou a ter **7 presets**, não 4, e que a foto aparece em Noturno/Claro/Etiqueta/Discreto/Menta/Moldura.
5. Abrir a tela de compartilhar de uma refeição de **texto** e confirmar que ela continua com os presets tipográficos só.

```bash
# Conferir quantas refeições com foto existem no banco local
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres -c \
  "SELECT id, source, image_path FROM public.meals WHERE image_path IS NOT NULL LIMIT 5;"
```

**Não marque este step sem ter visto os 7 pontinhos no carrossel.**

- [ ] **Step 4: Lint**

```bash
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(app)/share/[type]/[id].tsx"
git commit -m "$(cat <<'EOF'
feat(share): refeição com foto destrava os presets com foto

loadCardData passa a ler meals.image_path. Com o backfill da 0082, quem
já registrou por foto ganha Moldura, Etiqueta e Discreto ao compartilhar
uma refeição — de 4 presets para 7, sem câmera nenhuma.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `presetsAoVivo()`

**Files:**
- Modify: `apps/mobile/lib/share/presets.ts` (depois de `presetsFor`)
- Test: `apps/mobile/lib/share/presets.test.ts`

**Interfaces:**
- Consumes: `SHARE_PRESETS`, `SharePreset` (já existem no arquivo).
- Produces: `presetsAoVivo(): readonly SharePreset[]`

**Por que função nova e não parâmetro em `presetsFor`:** são perguntas diferentes. `presetsFor` responde "quais presets fazem sentido para este CONTEÚDO" (tem foto? tem macros?). `presetsAoVivo` responde "quais funcionam com uma câmera atrás", que é uma restrição de **geometria** — a decisão D3 do spec.

- [ ] **Step 1: Escrever o teste que falha**

Cria `apps/mobile/lib/share/presets.test.ts` (ou adiciona ao arquivo, se já existir):

```ts
import { describe, expect, test } from "@jest/globals";
import { presetsAoVivo, SHARE_PRESETS } from "./presets";

describe("presetsAoVivo", () => {
  test("só os presets em que a foto preenche o quadro", () => {
    expect(presetsAoVivo().map((p) => p.id)).toEqual([
      "noturno",
      "claro",
      "etiqueta",
      "discreto",
      "menta",
    ]);
  });

  test("exclui Moldura", () => {
    // A camada de câmera é única e fica ATRÁS do carrossel. Moldura desenha a
    // foto num retângulo interno, então no meio do arrasto a câmera apareceria
    // na área errada — e não existe buraco transparente dentro de uma View com
    // degradê.
    expect(presetsAoVivo().some((p) => p.id === "moldura")).toBe(false);
  });

  test("exclui Pôster", () => {
    // `photo: "none"` — não há o que enquadrar.
    expect(presetsAoVivo().some((p) => p.id === "poster")).toBe(false);
  });

  test("todo preset ao vivo preenche o quadro com a foto", () => {
    for (const p of presetsAoVivo()) expect(p.photo).toBe("fill");
  });

  test("é subconjunto da lista completa, na mesma ordem", () => {
    // Ordem preservada: o índice do carrossel ao vivo e o da lista completa
    // precisam concordar quando a tela volta do modo câmera.
    const completos = SHARE_PRESETS.map((p) => p.id);
    const vivos = presetsAoVivo().map((p) => p.id);
    expect(vivos).toEqual(completos.filter((id) => vivos.includes(id)));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test --workspace apps/mobile -- presets
```

Esperado: FAIL com `presetsAoVivo is not a function`.

- [ ] **Step 3: Implementar**

Em `apps/mobile/lib/share/presets.ts`, depois de `presetsFor`:

```ts
/**
 * Os presets que funcionam com a câmera aberta atrás.
 *
 * A camada de câmera é **única** e fica atrás do carrossel — não dá para montar
 * uma câmera por cena. Isso restringe aos presets em que a foto PREENCHE o
 * quadro:
 *
 * - "Moldura" desenha a foto num retângulo interno. No meio do arrasto a câmera
 *   apareceria na área errada, e não existe buraco transparente dentro de uma
 *   `View` com degradê.
 * - "Pôster" não usa foto.
 *
 * A restrição não é só técnica: "enquadrar vendo o preset" só significa algo
 * quando a foto É o quadro. Depois da captura o carrossel volta com os sete.
 */
export function presetsAoVivo(): readonly SharePreset[] {
  return SHARE_PRESETS.filter((p) => p.photo === "fill");
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test --workspace apps/mobile -- presets
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add apps/mobile/lib/share/presets.ts apps/mobile/lib/share/presets.test.ts
git commit -m "$(cat <<'EOF'
feat(share): presetsAoVivo — os cinco que funcionam com câmera atrás

A camada de câmera é única e fica atrás do carrossel, então só servem os
presets em que a foto preenche o quadro. Moldura põe a foto num retângulo
interno (a câmera apareceria na área errada no meio do arrasto) e Pôster
não usa foto.

Função nova em vez de parâmetro no presetsFor: "quais servem para este
conteúdo" e "quais servem com câmera aberta" são perguntas diferentes —
uma é sobre o dado, a outra sobre geometria.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: `fotoExterna` no `ShareCard`

**Files:**
- Modify: `apps/mobile/components/domain/ShareCard.tsx:259-350`
- Test: `apps/mobile/components/domain/ShareCard.test.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: `ShareCardProps` ganha `fotoExterna?: boolean`.

**O que a prop faz:** com `fotoExterna`, o card desenha **tudo menos a foto** — scrim, corpo, marca — com `backgroundColor: "transparent"`, para que a câmera atrás apareça através dele. É o que permite a camada única de câmera com o cromo deslizando por cima.

- [ ] **Step 1: Escrever o teste que falha**

Cria `apps/mobile/components/domain/ShareCard.test.tsx`:

```tsx
import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { ShareCard, type ShareCardData } from "./ShareCard";
import { presetAt, presetsAoVivo } from "@/lib/share/presets";

const DADOS: ShareCardData = {
  kind: "meal",
  headline: "Peito de frango grelhado · arroz",
  imageUrl: null,
  kcal: 612,
  protein_g: 48,
  carbs_g: 58,
  fat_g: 19,
  dateLabel: "11 out",
};

const NOTURNO = presetAt(presetsAoVivo(), 0);

describe("ShareCard com fotoExterna", () => {
  test("desenha o corpo mesmo sem foto no dado", () => {
    // Sem fotoExterna, um preset `fill` sem imageUrl cai no fundo liso. Com
    // ela, o cromo tem que aparecer porque a foto vem de trás (a câmera).
    const { getByText } = render(<ShareCard data={DADOS} preset={NOTURNO} fotoExterna />);

    expect(getByText("612")).toBeTruthy();
    expect(getByText(/frango grelhado/)).toBeTruthy();
  });

  test("o fundo fica transparente para a câmera aparecer", () => {
    const { getByTestId } = render(
      <ShareCard data={DADOS} preset={NOTURNO} fotoExterna testID="share-card" />,
    );

    const style = getByTestId("share-card").props.style;
    expect(style).toMatchObject({ backgroundColor: "transparent" });
  });

  test("sem fotoExterna o fundo continua opaco", () => {
    const { getByTestId } = render(
      <ShareCard data={DADOS} preset={NOTURNO} testID="share-card" />,
    );

    const style = getByTestId("share-card").props.style;
    expect(style.backgroundColor).not.toBe("transparent");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test --workspace apps/mobile -- ShareCard
```

Esperado: FAIL — `fotoExterna` e `testID` não existem nas props.

- [ ] **Step 3: Implementar**

Em `apps/mobile/components/domain/ShareCard.tsx`, no `ShareCardProps`:

```ts
type ShareCardProps = {
  data: ShareCardData;
  preset: SharePreset;
  /** Ajuste de enquadramento da foto. Ausente = `cover` centrado. */
  enquadramento?: Enquadramento;
  /** Medidas naturais da foto — necessárias para aplicar o enquadramento. */
  fotoNatural?: Tamanho | null;
  /**
   * A foto vem de fora do card — hoje, da câmera ao vivo que fica ATRÁS dele.
   *
   * Desenha todo o cromo (scrim, corpo, marca) mas não a foto, e deixa o fundo
   * transparente para a camada de trás aparecer. É o que permite UMA câmera só
   * com o carrossel de presets deslizando por cima: montar uma câmera por cena
   * não é viável.
   */
  fotoExterna?: boolean;
  testID?: string;
};
```

E no corpo da função:

```ts
export function ShareCard({
  data,
  preset,
  enquadramento,
  fotoNatural,
  fotoExterna = false,
  testID,
}: ShareCardProps) {
  const [quadroMoldura, setQuadroMoldura] = useState<Tamanho | null>(null);
  const foto = preset.photo === "none" ? null : fotoDoCard(data);
  // Com `fotoExterna` o quadro TEM foto, ela só não é desenhada aqui — sem
  // isso o card cairia no layout de "sem foto" e o scrim sumiria.
  const temFotoNoQuadro = fotoExterna || Boolean(foto);
  const preenche = temFotoNoQuadro && preset.photo === "fill";
  const emoldura = temFotoNoQuadro && preset.photo === "frame";
  const fundo = fotoExterna ? "transparent" : preset.background[1];

  return (
    <View
      testID={testID}
      style={{ width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, backgroundColor: fundo }}
      className="overflow-hidden"
    >
      {preenche ? (
        <>
          {/* Absoluta: a foto é FUNDO. No fluxo normal ela ocupa os 640px de
              altura do card e empurra a coluna de texto para fora do quadro —
              o card saía só com a foto, sem número, sem macros e sem marca. */}
          {fotoExterna ? null : (
            <View style={PREENCHE}>
              <FotoEnquadrada
                uri={foto!}
                quadro={{ width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT }}
                enquadramento={enquadramento}
                natural={fotoNatural}
              />
            </View>
          )}
          {/* ...resto do ramo `preenche` sem alteração... */}
```

No ramo `emoldura`, envolver o `<FotoEnquadrada>` no mesmo `fotoExterna ? null : (...)`. Não há caso de uso hoje (`presetsAoVivo` exclui Moldura), mas deixar a prop mentir num ramo é como se cria o próximo bug.

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test --workspace apps/mobile -- ShareCard
```

Esperado: PASS, 3 testes.

- [ ] **Step 5: Conferir que não quebrou o card normal**

```bash
npm test --workspace apps/mobile
npm run dev:mobile
```

Abrir a tela de compartilhar de uma refeição **com** foto e folhear os 7 presets. Nada deve ter mudado visualmente — `fotoExterna` é `false` por padrão.

- [ ] **Step 6: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add apps/mobile/components/domain/ShareCard.tsx apps/mobile/components/domain/ShareCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(share): ShareCard desenha o cromo sem a foto, sob demanda

`fotoExterna` desenha scrim, corpo e marca com fundo transparente, para
a camada de trás aparecer. É o que permite UMA câmera só com o carrossel
de presets deslizando por cima — montar uma câmera por cena não é
viável.

`temFotoNoQuadro` separa "o quadro tem foto" de "a foto está neste
dado": sem isso o card cairia no layout de sem-foto e o scrim sumiria,
deixando o texto ilegível sobre a imagem da câmera.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Quebrar a tela de compartilhar em componentes

**Files:**
- Create: `apps/mobile/components/domain/share/CardPreview.tsx`
- Create: `apps/mobile/components/domain/share/SharePresetCarousel.tsx`
- Create: `apps/mobile/components/domain/share/ShareAdjustStage.tsx`
- Modify: `apps/mobile/app/(app)/share/[type]/[id].tsx`

**Interfaces:**
- Consumes: `ShareCard`, `ShareCardData`, `SwipeableTabs`, `PhotoAdjuster`, `SHARE_CARD_WIDTH/HEIGHT`, `Enquadramento`, `Tamanho`, `SharePreset`.
- Produces:
  - `CardPreview({ escala, children }: { escala: number; children: ReactNode })`
  - `SharePresetCarousel({ presets, index, onIndexChange, data, enquadramento, fotoNatural, escala })`
  - `ShareAdjustStage({ uri, value, onChange })`

**Refator puro. Nenhuma mudança de comportamento.** A tela está em 462 linhas com três modos numa cadeia de ternários; o quarto modo (câmera, Tarefa 15) levaria a ~600. Esta tarefa vem **antes** do modo novo, não depois.

A prova de que é puro: a suíte existente passa sem alteração nenhuma, e a verificação visual no navegador não muda nada.

- [ ] **Step 1: Extrair `CardPreview`**

Mover a função `CardPreview` do fim de `app/(app)/share/[type]/[id].tsx` para `components/domain/share/CardPreview.tsx`, exportando-a. Levar o docblock inteiro junto — ele explica a ancoragem do `scale` e por que o raio e a sombra ficam ali e não no card. Adicionar os imports que ela usa (`View` de react-native, `shadows`, `SHARE_CARD_WIDTH`, `SHARE_CARD_HEIGHT`).

- [ ] **Step 2: Extrair `SharePresetCarousel`**

Cria `apps/mobile/components/domain/share/SharePresetCarousel.tsx`:

```tsx
import { View } from "react-native";
import { ShareCard, type ShareCardData } from "@/components/domain/ShareCard";
import { SwipeableTabs } from "@/components/domain/SwipeableTabs";
import { CardPreview } from "./CardPreview";

import type { Enquadramento, Tamanho } from "@/lib/media/crop";
import type { SharePreset } from "@/lib/share/presets";

/**
 * O carrossel de presets: uma cena por preset, cada uma com o card inteiro
 * encolhido para caber na tela.
 *
 * Não captura nada — a captura acontece no palco em tamanho cheio, fora da
 * tela, porque aqui o card vive dentro de um `Animated.View` com translateX e a
 * geometria do PNG sairia errada.
 */
export function SharePresetCarousel({
  presets,
  index,
  onIndexChange,
  data,
  enquadramento,
  fotoNatural,
  escala,
}: {
  presets: readonly SharePreset[];
  index: number;
  onIndexChange: (index: number) => void;
  data: ShareCardData;
  enquadramento?: Enquadramento;
  fotoNatural?: Tamanho | null;
  escala: number;
}) {
  return (
    <SwipeableTabs index={index} onIndexChange={onIndexChange}>
      {presets.map((p) => (
        <View key={p.id} className="flex-1 items-center justify-center">
          <CardPreview escala={escala}>
            <ShareCard
              data={data}
              preset={p}
              enquadramento={enquadramento}
              fotoNatural={fotoNatural}
            />
          </CardPreview>
        </View>
      ))}
    </SwipeableTabs>
  );
}
```

- [ ] **Step 3: Extrair `ShareAdjustStage`**

Cria `apps/mobile/components/domain/share/ShareAdjustStage.tsx`:

```tsx
import { View } from "react-native";
import { PhotoAdjuster } from "@/components/domain/PhotoAdjuster";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/share/geometry";

import type { Enquadramento } from "@/lib/media/crop";

/**
 * O editor de enquadramento, no lugar do carrossel.
 *
 * **Substitui** o carrossel em vez de acontecer por cima dele: arrastar para
 * enquadrar e arrastar para trocar de preset são o mesmo gesto, e deixar os dois
 * ativos faria o pager roubar metade dos arrastos do editor.
 */
export function ShareAdjustStage({
  uri,
  value,
  onChange,
}: {
  uri: string;
  value: Enquadramento;
  onChange: (e: Enquadramento) => void;
}) {
  return (
    <View className="flex-1 justify-center px-4">
      <View style={{ width: "100%", maxWidth: 360, alignSelf: "center" }}>
        <PhotoAdjuster
          uri={uri}
          aspect={SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT}
          value={value}
          onChange={onChange}
          radius={26}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Ligar na tela**

Em `app/(app)/share/[type]/[id].tsx`: apagar a função `CardPreview` do fim do arquivo, importar os três componentes novos, e trocar os dois ramos do ternário pelos componentes. O ramo de loading continua usando `CardPreview` direto (ele envolve o `ShareCardSkeleton`).

- [ ] **Step 5: Rodar a suíte inteira**

```bash
npm test --workspace apps/mobile
```

Esperado: PASS, **sem nenhum teste alterado**. Se algum teste precisou mudar, o refator não foi puro — reverta e refaça.

- [ ] **Step 6: Verificar no navegador que nada mudou**

```bash
npm run dev:mobile
```

Na tela de compartilhar de uma refeição com foto: folhear os 7 presets, entrar no ajuste, arrastar, pinçar, "Restaurar", "Pronto", baixar a imagem. Tudo igual a antes.

- [ ] **Step 7: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add apps/mobile/components/domain/share/ "apps/mobile/app/(app)/share/[type]/[id].tsx"
git commit -m "$(cat <<'EOF'
refactor(share): tela de compartilhar em componentes por modo

462 linhas com três modos numa cadeia de ternários, e o modo de câmera
levaria a ~600. CardPreview, SharePresetCarousel e ShareAdjustStage saem
para components/domain/share/; a tela fica com estado e orquestração.

Refator puro: nenhum teste mudou.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: `ShareCameraStage` — a câmera com o carrossel de cromo

**Files:**
- Create: `apps/mobile/components/domain/share/ShareCameraStage.tsx`
- Test: `apps/mobile/components/domain/share/ShareCameraStage.test.tsx`

**Interfaces:**
- Consumes: `CameraLive`, `CameraLiveHandle` (Tarefa 4); `presetsAoVivo`, `presetAt` (Tarefa 12); `ShareCard` com `fotoExterna` (Tarefa 13); `CardPreview` (Tarefa 14); `SwipeableTabs`; `CameraErro`.
- Produces: `ShareCameraStage({ data, escala, onCapture, onIndisponivel })` onde `onCapture: (uri: string, tamanho: Tamanho, presetId: SharePresetId) => void`

**A geometria, explicitamente:** a `CameraLive` fica **fora** do `SwipeableTabs`, numa camada absoluta atrás. O pager só carrega `ShareCard` com `fotoExterna`. É por isso que a câmera não é afetada pelo `translateX` do pager.

- [ ] **Step 1: Escrever o teste que falha**

Cria `apps/mobile/components/domain/share/ShareCameraStage.test.tsx`:

```tsx
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";

const capturar = jest.fn<() => Promise<void>>();
let aoCapturar: ((uri: string, t: { width: number; height: number }) => void) | null = null;
let aoErrar: ((motivo: string) => void) | null = null;

jest.mock("@/components/domain/CameraLive", () => {
  const { View } = require("react-native");
  const { useImperativeHandle } = require("react");
  return {
    CameraLive: ({ ref, onCapture, onError, onReady }: Record<string, never>) => {
      aoCapturar = onCapture as never;
      aoErrar = onError as never;
      useImperativeHandle(ref, () => ({ capturar }), []);
      (onReady as unknown as (() => void) | undefined)?.();
      return <View testID="camera-live" />;
    },
  };
});

import { ShareCameraStage } from "./ShareCameraStage";
import type { ShareCardData } from "@/components/domain/ShareCard";

const DADOS: ShareCardData = {
  kind: "meal",
  headline: "Peito de frango grelhado",
  imageUrl: null,
  kcal: 612,
  protein_g: 48,
  carbs_g: 58,
  fat_g: 19,
  dateLabel: "11 out",
};

describe("ShareCameraStage", () => {
  beforeEach(() => {
    capturar.mockReset();
    capturar.mockResolvedValue(undefined);
    aoCapturar = null;
    aoErrar = null;
  });

  test("monta UMA câmera só, não uma por preset", () => {
    const { getAllByTestId } = render(
      <ShareCameraStage
        data={DADOS}
        escala={0.5}
        onCapture={jest.fn()}
        onIndisponivel={jest.fn()}
      />,
    );

    // Cinco presets ao vivo, uma câmera. Montar uma por cena travaria o
    // aparelho e pediria permissão cinco vezes.
    expect(getAllByTestId("camera-live")).toHaveLength(1);
  });

  test("mostra o cromo dos cinco presets ao vivo", () => {
    const { getByText } = render(
      <ShareCameraStage
        data={DADOS}
        escala={0.5}
        onCapture={jest.fn()}
        onIndisponivel={jest.fn()}
      />,
    );

    expect(getByText("Noturno")).toBeTruthy();
  });

  test("o obturador dispara a captura da câmera", async () => {
    const { getByLabelText } = render(
      <ShareCameraStage
        data={DADOS}
        escala={0.5}
        onCapture={jest.fn()}
        onIndisponivel={jest.fn()}
      />,
    );

    await act(async () => {
      getByLabelText("Tirar foto").props.onPress();
    });

    expect(capturar).toHaveBeenCalled();
  });

  test("entrega a captura com o preset em cena", async () => {
    const onCapture = jest.fn();
    render(
      <ShareCameraStage
        data={DADOS}
        escala={0.5}
        onCapture={onCapture}
        onIndisponivel={jest.fn()}
      />,
    );

    await act(async () => {
      aoCapturar?.("blob:frame", { width: 1080, height: 1920 });
    });

    // O preset em cena viaja junto: a tela volta ao carrossel completo já
    // naquele estilo, em vez de pular para o primeiro.
    expect(onCapture).toHaveBeenCalledWith("blob:frame", { width: 1080, height: 1920 }, "noturno");
  });

  test("câmera indisponível avisa a tela em vez de mostrar quadro preto", async () => {
    const onIndisponivel = jest.fn();
    render(
      <ShareCameraStage
        data={DADOS}
        escala={0.5}
        onCapture={jest.fn()}
        onIndisponivel={onIndisponivel}
      />,
    );

    await act(async () => {
      aoErrar?.("negada");
    });

    expect(onIndisponivel).toHaveBeenCalledWith("negada");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test --workspace apps/mobile -- ShareCameraStage
```

Esperado: FAIL com `Cannot find module './ShareCameraStage'`.

- [ ] **Step 3: Implementar**

Cria `apps/mobile/components/domain/share/ShareCameraStage.tsx`:

```tsx
import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Camera } from "lucide-react-native";
import { CameraLive, type CameraLiveHandle } from "@/components/domain/CameraLive";
import { ShareCard, type ShareCardData } from "@/components/domain/ShareCard";
import { SwipeableTabs } from "@/components/domain/SwipeableTabs";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/share/geometry";
import { presetAt, presetsAoVivo, type SharePresetId } from "@/lib/share/presets";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { CardPreview } from "./CardPreview";

import type { CameraErro } from "@/lib/media/camera-constraints";
import type { Tamanho } from "@/lib/media/crop";

/**
 * Câmera ao vivo com a moldura do preset por cima.
 *
 * A `CameraLive` fica **fora** do `SwipeableTabs`, numa camada atrás: é UMA
 * câmera, e o pager carrega só o cromo (`ShareCard` com `fotoExterna`). Montar
 * uma câmera por cena pediria permissão cinco vezes e travaria o aparelho.
 *
 * **Não há arrastar nem pinçar aqui.** Com câmera ao vivo o enquadramento se faz
 * movendo o celular, então o arrasto fica inteiro para o carrossel — e o
 * conflito de gesto que obrigou o editor a substituir o carrossel não existe.
 */
export function ShareCameraStage({
  data,
  escala,
  onCapture,
  onIndisponivel,
}: {
  data: ShareCardData;
  escala: number;
  onCapture: (uri: string, tamanho: Tamanho, presetId: SharePresetId) => void;
  onIndisponivel: (motivo: CameraErro) => void;
}) {
  const camera = useRef<CameraLiveHandle>(null);
  const presets = presetsAoVivo();
  const [index, setIndex] = useState(0);
  const [pronta, setPronta] = useState(false);
  const preset = presetAt(presets, index);

  // O preset em cena viaja com a captura: a tela volta ao carrossel completo
  // já naquele estilo, em vez de jogar a pessoa de volta para o primeiro.
  const entregar = useCallback(
    (uri: string, tamanho: Tamanho) => onCapture(uri, tamanho, preset.id),
    [onCapture, preset.id],
  );

  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center">
        <CardPreview escala={escala}>
          <View style={{ width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT }}>
            {/* Camada única, atrás e fora do pager: o translateX do carrossel
                não a alcança, então a imagem não desliza junto com o cromo. */}
            <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
              <CameraLive
                ref={camera}
                aspect={SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT}
                onReady={() => setPronta(true)}
                onCapture={entregar}
                onError={onIndisponivel}
              />
            </View>
            <SwipeableTabs index={index} onIndexChange={setIndex}>
              {presets.map((p) => (
                <View key={p.id} className="flex-1">
                  <ShareCard data={data} preset={p} fotoExterna />
                </View>
              ))}
            </SwipeableTabs>
          </View>
        </CardPreview>
      </View>

      <View className="items-center pb-1 pt-3">
        <Text className="font-sans-medium text-sm text-neutral-600">{preset.label}</Text>
        <View className="mt-2 flex-row gap-1.5">
          {presets.map((p, i) => (
            <View
              key={p.id}
              className={[
                "h-1.5 rounded-full",
                i === index ? "w-5 bg-primary-400" : "w-1.5 bg-neutral-300",
              ].join(" ")}
            />
          ))}
        </View>
        <Text className="mt-2 font-sans text-xs text-neutral-400">
          Arraste para trocar de estilo · mova o celular para enquadrar
        </Text>
      </View>

      <View className="px-4 pb-4 pt-3">
        <Pressable
          onPress={() => camera.current?.capturar()}
          disabled={!pronta}
          accessibilityRole="button"
          accessibilityLabel="Tirar foto"
          style={shadows.card}
          className="min-h-[56px] flex-row items-center justify-center gap-2 rounded-full bg-primary-400 active:bg-primary-500 disabled:opacity-50"
        >
          <Camera size={20} color={colors.white} />
          <Text className="text-base font-sans-bold text-white">Tirar foto</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

**Nota sobre `SharePresetId`:** o tipo já é exportado de `lib/share/presets.ts`. Se o `presetAt` devolver `SharePreset` sem o `id` estreitado, use `preset.id as SharePresetId` — não invente um tipo novo.

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test --workspace apps/mobile -- ShareCameraStage
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add apps/mobile/components/domain/share/ShareCameraStage.tsx apps/mobile/components/domain/share/ShareCameraStage.test.tsx
git commit -m "$(cat <<'EOF'
feat(share): palco de câmera ao vivo com o preset por cima

UMA câmera, fora do pager, numa camada atrás; o carrossel carrega só o
cromo (ShareCard com fotoExterna). Montar uma câmera por cena pediria
permissão cinco vezes.

Sem arrastar nem pinçar: com câmera ao vivo o enquadramento se faz
movendo o celular, então o arrasto fica inteiro para o carrossel e o
conflito de gesto que obrigou o editor a substituir o carrossel não
existe aqui.

O preset em cena viaja com a captura, para a tela voltar ao carrossel
completo já naquele estilo.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Ligar na tela — entrada, captura, upload paralelo

**Files:**
- Modify: `apps/mobile/app/(app)/share/[type]/[id].tsx`

**Interfaces:**
- Consumes: `ShareCameraStage` (Tarefa 15); `uploadMealPhoto` (Tarefa 10); `patchMeal` (já existe em `lib/api/meals.ts`); `pickImage` (já existe em `lib/media/image-picker.ts`); `useAuthSession` para o `userId`.
- Produces: a feature completa na web.

**Três comportamentos, e a razão de cada um:**

1. **A foto local tem prioridade sobre a do servidor.** O export usa a `uri` local imediatamente; não espera upload.
2. **O upload não bloqueia.** Falha de rede não impede compartilhar — só não persiste. Quem abriu a tela queria compartilhar, não salvar.
3. **Câmera indisponível cai para a galeria.** `pickImage()`, que já existe. Sem tela de erro nova.

- [ ] **Step 1: Estado e helpers**

Adicionar ao componente `ShareScreen`, junto dos outros estados:

```ts
  // A foto tirada agora. Tem prioridade sobre a do servidor, e vive só nesta
  // visita à tela: o export usa esta uri, sem esperar upload.
  const [fotoLocal, setFotoLocal] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [semCamera, setSemCamera] = useState(false);
```

E, logo depois de `loadCardData`, no topo do arquivo:

```ts
/** Troca a foto do dado pela que acabou de ser tirada. */
function comFoto(data: ShareCardData, uri: string | null): ShareCardData {
  if (!uri || data.kind !== "meal") return data;
  return { ...data, imageUrl: uri };
}
```

Depois, onde `dados` é definido, passar a derivar:

```ts
  const dados = q.data ? comFoto(q.data, fotoLocal) : undefined;
```

**Importante:** `fotoDoPost` e `fotoBlob` passam a ler de `dados`, não de `q.data`, para que a medição da foto e a revogação do blob valham também para a foto local. Conferir as três ocorrências.

- [ ] **Step 2: Tratar a captura**

```ts
  const aoCapturar = useCallback(
    (uri: string, tamanho: Tamanho, presetId: SharePresetId) => {
      setFotoLocal(uri);
      setFotoNatural(tamanho);
      setEnquadramento(ENQUADRAMENTO_PADRAO);
      setCamera(false);
      // Volta ao carrossel completo já no estilo que estava em cena.
      const i = presetsFor({ temFoto: true, temMacros: true }).findIndex((p) => p.id === presetId);
      if (i >= 0) setPresetIndex(i);
      persistirFoto(uri);
    },
    [persistirFoto],
  );
```

- [ ] **Step 3: Persistir sem bloquear**

```ts
  /**
   * Sobe a foto e aponta a refeição para ela, em paralelo.
   *
   * Deliberadamente não bloqueia: o card já funciona com a uri local, e quem
   * abriu esta tela queria compartilhar, não salvar. Falha de rede só custa a
   * persistência.
   *
   * Só vale para `type === "meal"` — um post já tem foto própria, e trocá-la
   * aqui mudaria o que foi publicado no feed.
   */
  const persistirFoto = useCallback(
    (uri: string) => {
      if (type !== "meal" || !id || !userId) return;
      (async () => {
        try {
          await uploadMealPhoto({ userId, mealId: id, fileUri: uri });
          await patchMeal(id, { has_photo: true });
        } catch (err) {
          console.warn("[share-card] persistir foto falhou:", err);
          Sentry.captureException(err);
          toast({ variant: "error", message: "A foto não foi salva na refeição." });
        }
      })();
    },
    [type, id, userId, toast],
  );
```

`userId` vem do hook de sessão que o resto do app usa — conferir como `app/(app)/index.tsx` o obtém e seguir igual.

**Ordem das declarações:** `persistirFoto` tem que vir **antes** de `aoCapturar`, que o referencia.

- [ ] **Step 4: Queda para a galeria**

```ts
  const aoFaltarCamera = useCallback(
    (motivo: CameraErro) => {
      setCamera(false);
      setSemCamera(true);
      console.warn("[share-card] câmera indisponível:", motivo);
    },
    [],
  );

  async function daGaleria() {
    const uri = await pickImage();
    if (!uri) return;
    const tamanho = await medirImagem(uri).catch(() => null);
    setFotoLocal(uri);
    setFotoNatural(tamanho);
    setEnquadramento(ENQUADRAMENTO_PADRAO);
    persistirFoto(uri);
  }
```

- [ ] **Step 5: O botão de entrada**

Na barra de ações, **antes** do botão de ajustar. Só aparece para refeição, porque post já tem foto própria:

```tsx
          {type === "meal" ? (
            <Pressable
              onPress={() => (semCamera ? daGaleria() : setCamera(true))}
              accessibilityRole="button"
              accessibilityLabel={semCamera ? "Escolher foto da galeria" : "Tirar foto da refeição"}
              style={shadows.card}
              className="min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-white active:opacity-70"
            >
              {semCamera ? (
                <ImageIcon size={22} color={colors.neutral[700]} />
              ) : (
                <Camera size={22} color={colors.neutral[700]} />
              )}
            </Pressable>
          ) : null}
```

Importar `Camera` e `Image as ImageIcon` de `lucide-react-native`.

- [ ] **Step 6: O modo câmera na cadeia de modos**

Entre o ramo de loading e o de ajuste:

```tsx
        ) : dados && camera ? (
          <ShareCameraStage
            data={dados}
            escala={escala}
            onCapture={aoCapturar}
            onIndisponivel={aoFaltarCamera}
          />
        ) : dados && ajustando && fotoDoPost && fotoNatural ? (
```

E envolver a barra de ações com `camera ? null : (...)`, como já é feito com `ajustando`.

Quando `semCamera` for true, mostrar o motivo acima da barra — queda silenciosa é pior que queda explicada:

```tsx
      {semCamera ? (
        <Text className="px-4 pb-1 text-center font-sans text-xs text-neutral-500">
          Sem câmera aqui — escolha uma foto da galeria.
        </Text>
      ) : null}
```

- [ ] **Step 7: Rodar a suíte**

```bash
npm test --workspace apps/mobile
```

Esperado: PASS.

- [ ] **Step 8: Verificar o fluxo inteiro no navegador**

```bash
npm run dev:mobile
```

Com uma refeição de **texto** (sem foto):

1. Abrir compartilhar → carrossel com 4 presets tipográficos, botão de câmera visível.
2. Tocar na câmera → permitir → aparecem 5 presets com a câmera atrás.
3. Arrastar para o lado → o cromo troca, **a imagem da câmera não desliza junto**.
4. "Tirar foto" → volta ao carrossel, agora com 7 presets, no estilo que estava em cena.
5. Tocar no recorte → arrastar/pinçar → "Pronto" → o enquadramento aparece no card.
6. "Compartilhar" / baixar → conferir o PNG: 1080×1920, com a foto enquadrada como no preview.
7. Voltar, reabrir a tela → a foto **persistiu** (veio do servidor agora).

```bash
# Confirmar a persistência
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres -c \
  "SELECT id, source, image_path FROM public.meals WHERE image_path IS NOT NULL ORDER BY created_at DESC LIMIT 3;"
```

Depois, a queda: no DevTools, `delete navigator.mediaDevices`, recarregar, tocar no botão — tem que abrir o seletor de arquivo e mostrar a frase "Sem câmera aqui".

**Limpar os dados de teste depois.**

- [ ] **Step 9: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add "apps/mobile/app/(app)/share/[type]/[id].tsx"
git commit -m "$(cat <<'EOF'
feat(share): câmera ao vivo ligada na tela de compartilhar

A foto local tem prioridade sobre a do servidor e o export a usa na
hora. O upload e o PATCH correm em paralelo, de propósito: quem abriu
esta tela queria compartilhar, não salvar — falha de rede só custa a
persistência.

Câmera indisponível (http sem TLS, webview do Instagram, permissão
negada) cai para a galeria, que já existia, com o motivo escrito na
tela. Queda silenciosa é pior que queda explicada.

O botão só aparece para refeição: post já tem foto própria, e trocá-la
aqui mudaria o que foi publicado no feed.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: `CameraLive.tsx` — o nativo

**Files:**
- Create: `apps/mobile/components/domain/CameraLive.tsx`

**Interfaces:**
- Consumes: `expo-camera` (`CameraView`, `useCameraPermissions`); `CameraErro` (Tarefa 2); `Tamanho`.
- Produces: a mesma interface da Tarefa 4 — `CameraLiveHandle`, `CameraLiveProps`, `CameraLive`.

**Por que por último:** não há como verificar em aparelho nesta máquina, e o risco da feature estava todo na web. Entregar o nativo depois do caminho web verificado é o que evita mexer nos dois ao mesmo tempo quando algo dá errado.

**Sem teste unitário:** o `CameraView` nativo não renderiza em jest, e um teste que mocka o componente inteiro só verificaria o mock. O teste de contrato está no `.web.test.tsx`; este arquivo depende de verificação em aparelho (Tarefa 18).

- [ ] **Step 1: Implementar**

Cria `apps/mobile/components/domain/CameraLive.tsx`:

```tsx
import { useCallback, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

import type { Ref } from "react";
import type { CameraErro } from "@/lib/media/camera-constraints";
import type { Tamanho } from "@/lib/media/crop";

export type CameraLiveHandle = {
  capturar: () => Promise<void>;
};

export type CameraLiveProps = {
  aspect: number;
  ref?: Ref<CameraLiveHandle>;
  onReady?: () => void;
  onCapture: (uri: string, tamanho: Tamanho) => void;
  onError: (motivo: CameraErro) => void;
};

/**
 * Preview ao vivo da câmera, no nativo.
 *
 * Aqui o `CameraView` do expo-camera serve: no nativo o módulo controla a
 * resolução de verdade (`takePictureAsync` entrega o sensor, não um frame de
 * vídeo), e já está provado no `BarcodeScanner`. O caminho web precisa de
 * implementação própria por outro motivo — ver `CameraLive.web.tsx`.
 *
 * `skipProcessing: true` e `shutterSound: false`: a foto vira o fundo de um
 * card de story, não um arquivo da galeria. O processamento extra só adiciona
 * latência ao toque, e o som de obturador é estranho num fluxo que a pessoa
 * entende como "ajustar imagem".
 */
export function CameraLive({ aspect, ref, onReady, onCapture, onError }: CameraLiveProps) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [pronta, setPronta] = useState(false);
  const pediu = useRef(false);

  // Pede uma vez. O hook devolve `null` enquanto não sabe, e repetir o pedido
  // a cada render mostraria o diálogo em loop.
  if (permissao && !permissao.granted && permissao.canAskAgain && !pediu.current) {
    pediu.current = true;
    pedirPermissao().then((r) => {
      if (!r.granted) onError("negada");
    });
  } else if (permissao && !permissao.granted && !permissao.canAskAgain && !pediu.current) {
    pediu.current = true;
    onError("negada");
  }

  const capturar = useCallback(async () => {
    if (!camera.current || !pronta) return;
    const foto = await camera.current.takePictureAsync({
      skipProcessing: true,
      shutterSound: false,
    });
    if (!foto?.uri || !foto.width || !foto.height) throw new Error("frame_sem_dados");
    onCapture(foto.uri, { width: foto.width, height: foto.height });
  }, [pronta, onCapture]);

  useImperativeHandle(ref, () => ({ capturar }), [capturar]);

  return (
    <View style={{ width: "100%", aspectRatio: aspect }} className="overflow-hidden bg-neutral-900">
      {permissao?.granted ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onCameraReady={() => {
            setPronta(true);
            onReady?.();
          }}
          onMountError={() => onError("indisponivel")}
        />
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Rodar a suíte e o typecheck**

```bash
npm test --workspace apps/mobile && npm run typecheck
```

Esperado: PASS. O `CameraLive.web.test.tsx` continua testando o caminho web — o Metro resolve `.web.tsx` primeiro, mas o jest importa o arquivo pelo caminho explícito no teste, então os dois convivem.

Se o jest começar a resolver o `.tsx` nativo no lugar do `.web.tsx`, confira o `moduleFileExtensions` do `jest.config` do mobile — o teste importa `./CameraLive.web` com o sufixo escrito à mão exatamente para não depender dessa ordem.

- [ ] **Step 3: Lint e commit**

```bash
npm run lint
git add apps/mobile/components/domain/CameraLive.tsx
git commit -m "$(cat <<'EOF'
feat(camera): preview ao vivo no nativo via expo-camera

No nativo o CameraView serve: o módulo controla a resolução de verdade e
takePictureAsync entrega o sensor, não um frame de vídeo. O caminho web
precisa de implementação própria por outro motivo (ver CameraLive.web).

skipProcessing e sem som de obturador: a foto vira fundo de card de
story, não arquivo de galeria.

Sem teste unitário — CameraView não renderiza em jest, e mockar o
componente inteiro testaria o mock. O contrato está fixado no
.web.test.tsx; este arquivo depende de verificação em aparelho.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Verificação em aparelho

**Files:**
- Modify: `docs/PLAN.md` (registrar a entrega e o que ficou sem verificar)

**Interfaces:**
- Consumes: tudo.
- Produces: o registro honesto do que foi e do que não foi exercitado.

**Esta tarefa é do dono, não do agente.** Nada nesta família de features rodou em aparelho até hoje, e o dono já encontrou dois problemas reais testando no celular ("está travando bastante").

- [ ] **Step 1: Servir por HTTPS e exercitar na web mobile**

```bash
npx expo start --tunnel
```

No celular: o fluxo inteiro do Step 8 da Tarefa 16. Conferir em especial:

- a imagem da câmera **não** desliza quando se troca de preset;
- o obturador responde no primeiro toque;
- o PNG exportado tem a foto enquadrada como no preview;
- com o app na tela de início (PWA standalone), a câmera abre — ou cai para a galeria com a frase, se não abrir.

- [ ] **Step 2: Exercitar no build nativo**

O módulo de câmera exige o dev build EAS (o mesmo que o `BarcodeScanner` pediu — ver `eas.json`). Conferir:

- a câmera abre e o preview enche o quadro 9:16;
- `takePictureAsync` devolve foto na resolução do sensor;
- a captura do card (`captureRef` com `width`/`height`, no palco offscreen com `left: -9999`) funciona — **nunca foi exercitada em aparelho**, de nenhuma feature desta série;
- o `ShareLogo` nativo sai nítido no PNG.

- [ ] **Step 3: Registrar no PLAN.md**

Acrescentar a entrega ao `docs/PLAN.md`, no molde das outras: o que foi implementado, em que commits, com qual migration, **e o que ficou sem verificar**. As features anteriores desta série estão registradas lá; a do editor de enquadramento ficou de fora e vale corrigir junto.

- [ ] **Step 4: Commit**

```bash
git add docs/PLAN.md
git commit -m "$(cat <<'EOF'
docs(plan): registra a câmera ao vivo no compartilhar

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Auto-revisão deste plano

**Cobertura do spec, seção por seção:**

| Requisito do spec | Tarefa |
|---|---|
| Achado 1 — `meals` sem foto, path preso no `raw_input` | 8 (coluna + backfill), 11 (tela lê) |
| Achado 2 — `pickImage` é galeria | 16 (galeria vira a queda, não a entrada) |
| Achado 3 — vazamento de RLS | 1 (PR separado) |
| D1 — split por plataforma | 2, 3, 4 (web), 17 (nativo) |
| D2 — exceção de HTML + buraco no guard | 4 (guard primeiro) |
| D3 — só presets `fill` ao vivo | 12, 15 |
| D4 — guardar o frame inteiro | 3 (`drawImage` sem recorte, com teste) |
| D5 — servidor deriva o path | 7, 9 |
| D6 — queda para a galeria | 16 |
| Arquitetura — `CameraLive`, `camera-constraints`, `frame-capture` | 2, 3, 4, 17 |
| Arquitetura — tela quebrada em componentes | 14 |
| Arquitetura — `presetsFor` ganha irmão | 12 |
| Arquitetura — `uploadMealPhoto` com upsert | 10 |
| Arquitetura — `image_path` em shared/select/rota | 9 |
| Fluxo — upload paralelo e não bloqueante | 16 |
| Migration + ausência de constraint | 8 |
| Tabela de erros (7 linhas) | 2 (classificação), 4 (degradação, tracks), 15 (obturador travado), 16 (upload/PATCH) |
| Testes unitários listados | 2, 3, 4, 7, 9, 10, 12, 13, 15 |
| Verificação no navegador | 11, 14, 16 |
| **Medição obrigatória em aparelho, antes do resto** | 5, 6 (gate) |
| Fora de escopo | nenhuma tarefa — correto |
| Riscos 1–4 | 6 (resolução, PWA), 18 (aparelho, pinça) |

**Lacunas encontradas e fechadas durante a revisão:**

1. O spec dizia "medição obrigatória antes de construir o resto", mas uma primeira versão deste plano deixava a medição no fim. Virou a Fase B, com gate explícito (Tarefa 6, Step 4). **Corrigido depois:** a primeira redação do gate era uma tabela de limiares por resolução (`≥1080` / `720–1079` / `<720`), o que fazia parecer que o aparelho de quem testa é parâmetro do design. Não é — o runtime se adapta a qualquer frame. O gate é uma pergunta sim/não sobre o navegador honrar constraint `ideal`, que é a premissa da D1.
2. O spec listava testes de rota (`PATCH` grava o path derivado) que o repositório não suporta: `apps/server` usa vitest sobre helpers puros, não rota montada. Virou `buildMealPatch` exportado, no molde de `isOwnedAvatarPath` em `account.test.ts`.
3. `ShareCard` recebe a foto de `data`, não por prop — o palco de câmera não tinha como desenhar só o cromo. Virou a Tarefa 13 (`fotoExterna`), que o spec não previa explicitamente.
4. O refator da tela estava no spec como observação; sem ele a Tarefa 16 editaria um arquivo de ~600 linhas. Virou tarefa própria (14), antes do modo novo, com a exigência de que nenhum teste mude.

**Consistência de tipos:** `CameraLiveHandle`/`CameraLiveProps` idênticos nas Tarefas 4 e 17. `onCapture(uri, tamanho)` na câmera; `onCapture(uri, tamanho, presetId)` no palco (Tarefa 15) — nomes iguais em níveis diferentes, de propósito, porque o palco acrescenta o preset. `Tamanho` vem sempre de `lib/media/crop.ts`. `CameraErro` sempre de `lib/media/camera-constraints.ts`. `mealPhotoPath(userId, mealId)` com a mesma assinatura nas Tarefas 7, 9 e 10.
