# Câmera ao vivo no share, com o preset por cima — Design

> Data: 2026-10-11. Status: aprovado (brainstorming). Sucessor direto dos presets de story e do editor de enquadramento (`5f6201c`, `ade9f65`, `8dd3227`, branch `dev`).

## O pedido

Na tela de compartilhar uma refeição, oferecer **câmera ao vivo com a moldura do preset desenhada por cima do vídeo**, para enquadrar o prato já vendo como o story vai sair. Deslizar troca de preset com a câmera aberta.

## Contexto: o que a auditoria achou

Três achados mudaram o tamanho da feature. Nenhum era suposição — todos saíram de ler o código.

### 1. `meals` não guarda foto, mas a foto existe

`loadCardData` em `app/(app)/share/[type]/[id].tsx` documenta o estado:

```ts
// Refeição não guarda foto — `meals` só tem `audio_path`. Foto de comida
// vive no post.
imageUrl: null,
```

Consequência: em `/share/meal/:id` a foto é **sempre** null, e `presetsFor` descarta Moldura, Etiqueta e Discreto. Quem compartilha uma refeição vê 4 presets de 7, todos tipográficos.

Só que **registro por foto já existe e já sobe a foto**: `handlePhotoPress` (`app/(app)/index.tsx:355`) → `uploadMealPhoto` → `post-images/{userId}/meal-photos/{mealId}.jpg` → `POST /meals/photo` extrai macros com Gemini → meal com `source='app_photo'`. O caminho sobrevive **só** como texto em `raw_input: "Foto: {path}"` (`apps/server/src/routes/meals.ts:425`). Não existe coluna. A foto está no storage, com path determinístico, e nada no app lê de volta.

Logo: a câmera não é conveniência. É o que destrava 3 presets que já existem e ninguém alcança por esse caminho — e um backfill destrava para quem já registrou por foto, sem câmera nenhuma.

> Nota de deriva de doc: `2026-06-23-fase-3-polish-expansao-design.md` diz "bucket `meal-photos`". O bucket é `post-images`; `meal-photos/` é pasta dentro dele.

### 2. `pickImage` abre a galeria, não a câmera

`lib/media/image-picker.ts` usa `launchImageLibraryAsync`. "Registrar por foto" hoje significa "escolher uma foto que já existe". Não há câmera ao vivo em nenhum lugar do app fora do `BarcodeScanner`, que é **desligado na web** (`Platform.OS === "web"` cai no fallback manual).

### 3. A política de storage vaza foto de refeição para seguidores

`supabase/migrations/0076_post_images_follower_select.sql`:

```sql
USING ( bucket_id = 'post-images'
        AND EXISTS (SELECT 1 FROM public.follows f
                    WHERE f.follower_id = auth.uid()
                      AND f.followee_id::text = (storage.foldername(name))[1]) )
```

A intenção, no comentário da própria migration, era liberar a foto **de post** para quem segue o autor. Mas o `USING` casa com **qualquer objeto** sob `{authorId}/`, e `meal-photos/` mora na mesma pasta. Quem te segue tem SELECT nas suas fotos de refeição, que nunca foram publicadas.

E `storage.list()` também é um SELECT em `storage.objects`: um seguidor passando o prefixo `{userId}/meal-photos` **enumera** os arquivos. Não depende de adivinhar UUID.

**Não foi explorado** — é leitura de política, não teste. Se a leitura estiver certa, vaza hoje, sem esta feature. E esta feature agrava: passaríamos a guardar deliberadamente mais fotos ali, e o app passaria a expor quais refeições têm foto.

**Fica fora deste escopo, como pré-requisito** — ver "Pré-requisito (PR separado, antes)".

## Decisões

### D1 — `CameraView` do expo-camera não serve na web

Primeira avaliação (errada, registrada porque o erro é informativo): "`expo-camera` já é dependência e tem implementação web, então sai de graça".

O que a implementação faz de verdade — `build/web/useWebCameraStream.js` chama `Utils.getPreferredStreamDevice(preferredType)` passando **só** a câmera preferida, nunca largura/altura. E em `build/web/WebCameraUtils.js`:

```js
export function getIdealConstraints(preferredCameraType, width, height) {
  if (hasValidConstraints(preferredCameraType, width, height)) return MinimumConstraints;
  // width/height chegam undefined → hasValidConstraints false → MinimumConstraints
}
// WebConstants.js
export const MinimumConstraints = { audio: false, video: true };
```

`video: true` sem constraint é **640×480** no Safari e no Chrome Android. Recortado para 9:16 sobra 270×480; o card exporta 1080×1920 (`SHARE_EXPORT_SCALE = 3`). Upscale de 4×. E o `CameraView` não expõe prop para mudar isso.

**Decisão: split por plataforma**, o mesmo padrão já usado duas vezes (`lib/share/capture.web.ts`, `components/domain/share/ShareLogo.web.tsx`).

| Arquivo | Implementação | Por quê |
|---|---|---|
| `components/domain/CameraLive.tsx` | `expo-camera` `CameraView` + `takePictureAsync` | no nativo o módulo controla resolução; já provado no `BarcodeScanner` |
| `components/domain/CameraLive.web.tsx` | `getUserMedia` com constraints explícitas + `<video>` + `canvas.toBlob` | único jeito de pedir 1080 |

Interface idêntica nos dois:

```ts
type CameraLiveProps = {
  /** Proporção do quadro visível (o card de story: 360/640). */
  aspect: number;
  onReady?: () => void;
  onCapture: (uri: string, tamanho: Tamanho) => void;
  onError: (motivo: CameraErro) => void;
};
type CameraErro = "indisponivel" | "negada" | "sem_camera";
```

Três ganhos colaterais no caminho web:

1. **Ciclo do stream nosso** — paramos os tracks no unmount. O `CameraView` web deixa a luz da câmera acesa em alguns casos.
2. **Permissão do Safari tratada direto** — `useCameraPermissions` na web usa `navigator.permissions.query({ name: 'camera' })`, que o Safari **não implementa**; `handlePermissionsQueryAsync` lança `UnavailabilityError`. O `BarcodeScanner` nunca bateu nisso porque curto-circuita na web. Aqui bateria. Pedimos a permissão chamando `getUserMedia` e lemos o `err.name`.
3. **`canvas.toBlob` em vez de `toDataURL`** — o `captureImage` do expo-camera usa `toDataURL`, que é síncrono e bloqueia a thread, e sai PNG por padrão. É exatamente o custo que travou o celular na feature dos presets.

### D2 — A segunda exceção de tag HTML, e um buraco no guard

O caminho web precisa de `<video>`. Isso é a **segunda** exceção à regra de ouro nº 9 do `CLAUDE.md`, depois de `ShareLogo.web.tsx`.

E o guard tem um buraco: `lib/no-html-tags.test.ts` lista as tags vigiadas e **`video` e `canvas` não estão lá**. Um `<video>` passaria batido hoje.

**Decisão:** tapar o buraco primeiro (adicionar `video` e `canvas` ao `TAGS_HTML`), e só então registrar a exceção em `EXCECOES` com o motivo medido. Não aproveitar a falha do guard para escapar dele.

**Alternativa rejeitada:** `createElement('video', …)` de `react-native-web/dist/exports/createElement` — é como o próprio expo-camera monta o vídeo, e driblaria a exceção. Rejeitada por ser import em caminho interno da lib para contornar um guard cujo propósito é justamente manter HTML fora. A exceção documentada é honesta; o dribble não.

### D3 — Câmera ao vivo só nos presets `fill`

Não dá para montar uma câmera por cena do `SwipeableTabs`. O desenho é **uma camada de câmera única e fixa atrás**, com o carrossel deslizando por cima carregando só o cromo do preset.

Isso funciona para `photo: "fill"` — Noturno, Claro, Etiqueta, Discreto, Menta (5 de 7). Não funciona para:

- **Moldura** (`photo: "frame"`) — a foto é um retângulo interno. No meio do arrasto a câmera apareceria na área errada, e não existe buraco transparente dentro de uma `View` com degradê.
- **Pôster** (`photo: "none"`) — não usa foto.

**Decisão: 5 presets com a câmera aberta; depois de fotografar, o carrossel volta com os 7.**

Não é contorno disfarçado de regra. "Enquadrar vendo o preset" só significa algo quando a foto *é* o quadro; em Moldura ela é uma miniatura e em Pôster não existe.

**Corolário bom:** com câmera ao vivo a pessoa enquadra movendo o celular, então **não há arrastar/pinçar**. O arrasto fica inteiro para o carrossel e o conflito de gesto que obrigou o editor a substituir o carrossel (em vez de sobrepor) não existe aqui. Depois da captura o `PhotoAdjuster` volta a valer, porque o frame vem 4:3 ou 16:9 e sobra folga para o 9:16.

### D4 — Guardar o frame inteiro, sem recorte gravado

Diferente do feed, onde o 4:5 foi gravado na imagem ao publicar. Aqui a mesma foto serve o card 9:16, a Home e qualquer share futuro. O `Enquadramento` normalizado (`lib/media/crop.ts`) já existe para decidir o recorte por uso. Gravar o 9:16 destruiria a foto para os outros dois.

### D5 — O servidor deriva o path; o cliente não manda caminho

`PATCH /meals/:id` existe (`apps/server/src/routes/meals.ts:599`), mas o `PatchMealRequestSchema` só aceita `meal_type`, `consumed_at` e `items`. Precisa de um campo novo — e a forma dele é uma decisão de segurança, não de conveniência.

**Rejeitado: `{ image_path: "..." }`.** É o que o `POST /meals/photo` faz hoje (aceita o path do cliente), e a RLS de storage impede subir fora da própria pasta, então parece seguro. Mas com o vazamento do achado 3 acima um cliente malicioso poderia apontar `image_path` para a foto de refeição de **alguém que ele segue**, e a URL assinada funcionaria. Mesmo depois de corrigir a política, validar um path vindo do cliente é superfície que não precisa existir.

**Decisão: `{ has_photo: true }`.** O servidor monta o path a partir do `auth.uid()` e do id da refeição. Zero confiança no cliente e **menos** código que validar — não há o que validar.

A convenção do path passa a viver em `packages/shared` (`mealPhotoPath(userId, mealId)`), usada pelo upload no cliente e pela escrita no servidor. Hoje ela existe só em `lib/storage.ts:128`; duas cópias de uma convenção de path é como se produz foto órfã.

E `image_path` entra no `MEAL_DETAIL_SELECT` (`apps/server/src/services/meals.ts:28`), que é lista explícita de colunas — sem isso a coluna existe no banco e nunca chega ao app.

### D6 — Falha cai para a galeria

Um caminho só. `getUserMedia` indisponível (http sem TLS, webview do Instagram), permissão negada, sem câmera traseira — todos terminam em `pickImage()`, que já existe. Sem tela de erro nova, sem texto mandando a pessoa nas configurações do navegador.

O cabeçalho diz o motivo ("sem câmera aqui — escolher da galeria"): queda silenciosa é pior que queda explicada.

## Arquitetura

### Unidades novas

**`components/domain/CameraLive.tsx` / `.web.tsx`** — a câmera, sem saber nada de preset. Recebe `aspect`, devolve `(uri, tamanho)` na captura. Testável por contrato: o mock de `getUserMedia` no `.web` espelha o que `lib/audio/recorder.test.ts` já faz.

**`lib/media/camera-constraints.ts`** — puro, sem DOM. Monta o `MediaStreamConstraints` a partir do alvo de resolução e do `facingMode`, e aplica a mesma regra de degradação do `getAnyUserMediaAsync` (retry sem constraint quando vem `OverconstrainedError`). Pura para ser testada sem navegador.

**`lib/media/frame-capture.web.ts`** — `HTMLVideoElement` → blob URL via `canvas.toBlob`, com as dimensões reais do frame. Isolado porque é o único ponto que toca canvas, e porque o tamanho devolvido alimenta o `fotoNatural` do card.

### Mudanças em unidades existentes

- **`app/(app)/share/[type]/[id].tsx`** — já tem três modos (carrossel, ajuste, captura offscreen); ganha o quarto (câmera). Está em 462 linhas e é o maior arquivo da feature. **A tela extrai os modos para componentes** (`SharePresetCarousel`, `ShareAdjustStage`, `ShareCameraStage`), deixando a tela com estado e orquestração. Sem isso o quarto modo leva o arquivo para ~600 linhas de condicional encadeada.
- **`lib/share/presets.ts`** — `presetsFor` ganha um irmão `presetsAoVivo()` que filtra `photo === "fill"`. Função nova, não parâmetro novo: a pergunta "quais presets servem para este conteúdo" e "quais servem com câmera aberta" são diferentes.
- **`lib/storage.ts`** — `uploadMealPhoto` passa a `upsert: true`. Hoje é `false`, e refotografar a mesma refeição falharia com conflito.
- **`packages/shared/src/schemas.ts`** — `image_path` no schema de `Meal`; `has_photo` no `PatchMealRequestSchema`; `mealPhotoPath(userId, mealId)` como a única definição da convenção.
- **`apps/server/src/services/meals.ts`** — `image_path` no `MEAL_DETAIL_SELECT` (lista explícita).
- **`apps/server/src/routes/meals.ts`** — o `PATCH` traduz `has_photo: true` em `image_path = mealPhotoPath(userId, id)`.
- **`lib/no-html-tags.test.ts`** — `video`/`canvas` no regex, exceção registrada.

### Fluxo

```
tela de share (meal sem foto)
  └─ toque em "tirar foto"
       └─ ShareCameraStage
            ├─ CameraLive (camada única, atrás)
            └─ SwipeableTabs com o cromo dos 5 presets fill
                 └─ toque no obturador
                      ├─ onCapture(uri, tamanho)
                      ├─ setFotoLocal(uri) / setFotoNatural(tamanho)
                      ├─ volta ao carrossel com os 7 presets
                      └─ em paralelo, sem bloquear a UI:
                           uploadMealPhoto(upsert) → PATCH /meals/:id { has_photo: true }
```

O upload é **paralelo e não bloqueante**: exportar o card usa a `uri` local. Falha de rede não impede compartilhar — só não persiste. Isso é deliberado: a pessoa abriu a tela para compartilhar, não para salvar.

### Migration

```sql
ALTER TABLE public.meals ADD COLUMN image_path text;

UPDATE public.meals
   SET image_path = substring(raw_input from 7)
 WHERE source = 'app_photo'
   AND raw_input LIKE 'Foto: %';
```

Sem constraint ligando `image_path` a `source`: ao contrário de `audio_path` (que o `meals_audio_path_matches_source` amarra), uma foto pode chegar depois, em refeição registrada por texto, áudio ou código de barras. É justamente o que esta feature faz.

Numeração a partir do ponto mais alto vigente quando a implementação começar.

## Erros

| Situação | Comportamento |
|---|---|
| `getUserMedia` ausente (http, webview) | cabeçalho explica, botão vira "escolher da galeria" |
| `NotAllowedError` / permissão negada | idem, sem segunda tentativa automática |
| `NotFoundError` / sem câmera | idem |
| `OverconstrainedError` | retry sem constraint de resolução antes de desistir |
| Frame sem dados (`readyState` baixo) | obturador desabilitado até `onReady` |
| Upload falha | toast discreto; o card já funciona com a uri local |
| `PATCH` falha | idem — a foto fica no storage, órfã; o backfill de `raw_input` não cobre esse caso e isso é aceito |

## Testes

**Unitários (jest, sem navegador):**
- `camera-constraints.ts` — constraints montadas, degradação em `OverconstrainedError`.
- `presetsAoVivo()` — devolve exatamente os 5 `fill`; não devolve Moldura nem Pôster.
- `CameraLive.web` — `getUserMedia` mockado como em `recorder.test.ts`: sucesso, negada, ausente, tracks parados no unmount.
- `no-html-tags` — a exceção nova é exigida (o guard falha se a tag sair) e `video`/`canvas` passam a ser vigiados.
- `storage.ts` — `uploadMealPhoto` com `upsert: true`, usando `mealPhotoPath`.
- `mealPhotoPath` — uma definição só, e o teste do servidor e o do cliente batem no mesmo helper.

**Servidor (jest):**
- `PATCH /meals/:id { has_photo: true }` grava o path derivado do `auth.uid()`, não do corpo.
- O mesmo `PATCH` com `image_path` no corpo é ignorado (campo não existe no schema) — fixa a decisão D5 contra regressão.
- `image_path` volta no `GET /meals/:id`.

**Verificação no navegador (Playwright/Browser pane):** fluxo inteiro com câmera falsa do Chrome, incluindo a queda para galeria com `getUserMedia` removido.

**Medição obrigatória em aparelho, antes de construir o resto:** a resolução real que o iPhone entrega com `width: {ideal: 1080}, height: {ideal: 1920}`. O número que importa é o **lado curto ≥ 1080**, para não haver upscale no export de 1080×1920. Não é mensurável aqui — o Chrome desta máquina só tem câmera falsa em 640×480. Se vier 720, a feature ainda vale, mas com o número declarado em vez de descoberto depois.

## Fora de escopo

- **Câmera como entrada de registro** (fotografar → Gemini extrai macros → refeição criada com foto já anexada). É um produto melhor e não foi pedido; o registro por foto existe e usa a galeria.
- **Bucket separado para foto de refeição.** Certo a prazo, exige migração de objetos.
- **Aviso de resolução baixa na UI.** Pedimos alto e aceitamos o que vem; um aviso que a pessoa não pode resolver é ruído.
- **Gravar vídeo.** `record` não existe no caminho web do expo-camera e não foi pedido.

## Pré-requisito (PR separado, antes)

Correção da `post_images_follower_select`: restringir o SELECT de seguidor ao padrão do arquivo de post em vez da pasta inteira —

```sql
AND name LIKE (storage.foldername(name))[1] || '/post-%'
```

Sem mover objeto. Vai separado porque é correção de segurança com risco próprio, e misturar com feature atrapalha a revisão de ambas.

## Riscos

1. **Resolução do stream na web** (alto, mensurável) — ver "Testes". É o risco que pode reduzir a feature a "funciona mas sai mole".
2. **Pinça e gesto em aparelho** (médio) — nada desta família de features rodou em device. Aqui o risco é menor que no editor, porque a câmera não usa pinça.
3. **`<video>` dentro de `SwipeableTabs` na web** (médio) — o pager aplica `translateX` num `Animated.View` ancestral. Um `<video>` não é afetado por transform de ancestral de forma diferente de uma `<img>`, mas a camada de câmera fica **fora** do pager justamente para não depender disso.
4. **iOS PWA standalone** (baixo) — `getUserMedia` em web app de tela de início funciona desde iOS 13.4. Verificar junto com a medição de resolução.
