# Compartilhar como stories — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar a tela de compartilhar por uma câmera de stories em tela cheia, com editor de foto e stickers, e dar ao Novo post uma câmera 4:5.

**Architecture:** o card continua sendo um layout em fluxo de 360×640, e cada sticker guarda só a diferença em relação à própria posição natural (`dx`, `dy`, `scale`, `rotation`). Assim o layout de cada preset segue no flexbox, sem medir nada para desenhar. Um único detector de gestos cobre o quadro e faz o hit-test com as caixas medidas, porque dois dedos num logo de 18dp não caberiam num detector por sticker. Os gestos mexem em shared values, e o estado React só recebe o resultado ao soltar. É desse estado que sai o nó fora da tela que o html2canvas captura.

**Tech Stack:** React Native, Expo Router, NativeWind v4, `react-native-gesture-handler` 2.28, `react-native-reanimated` 4, html2canvas 1.4.1, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-31-compartilhar-stories-design.md`

## Medição já feita (o primeiro passo que a spec pedia)

Rota temporária em RN-web, capturando pelo `captureCard` real, com a mesma foto desenhada em canvas 2D como referência:

- Foto com `translate + rotate + scale`: diferença média 0,12 de 255, com 1080×1920 e 286ms. **html2canvas fica, sem canvas próprio.**
- Sticker com `rotate`, `scale`, `textShadow`, e logo `<img>` girado: posição correta.
- Elemento com `opacity: 0`: não aparece no PNG, então remover sticker pode manter o lugar dele no fluxo.
- **Defeito encontrado, e que já existe nas exportações de hoje:** todo texto sai mais baixo que na tela, mesmo sem transform. A causa é o preflight do Tailwind (`img { display: block }`), que quebra o `FontMetrics` do html2canvas: ele mede o baseline com uma `<img>` inline dentro de um `<div>` invisível preso ao `body`. A regra `body > div[style*="visibility: hidden"] > img { display: inline !important; }` corrigiu, medido nos mesmos seis casos. Task 1.
- Restante conhecido e aceito: `tabular-nums` não chega ao canvas, então um número pode sair alguns dp mais estreito. Só afeta o número, que fica sozinho no próprio nó.

## Global Constraints

- Regras de UI do `CLAUDE.md`: famílias `font-sans-*`/`font-display-*`, `tabular-nums` em número, cor por token (exceção Reanimated/SVG via `lib/colors.ts`), 44×44pt, `accessibilityLabel`, `lucide-react-native`, sem tags HTML, sem `dark:`.
- Sem `className` em componente do Reanimated (`lib/reanimated-classname.test.ts`).
- Sem lib nova. `react-native-gesture-handler` e `reanimated` já existem.
- Vinheta: `ink` com alpha, paradas `0.4 / 0.72 / 1`, opacidades `0 / 0.28 / 0.8`.
- Exportação PNG 1080×1920, gerada no toque, sem pré-captura.
- Manter `PEDIDO_INICIAL` e a reabertura de `frameDeitado` na câmera web.
- Loading de tela é skeleton. `ActivityIndicator` só dentro de ação pontual.
- Testes: `cd apps/mobile && npx jest <arquivo>`. Checagem final: `npm run typecheck`, `npm run lint`, `npm test` em `apps/mobile`.

## Review Focus

1. Refeição com `image_path` cuja foto não carregou: abre a câmera sem perguntar e nunca sobrescreve a original. Teste na Task 9.
2. Exportar, voltar, tirar outra foto e exportar de novo na mesma visita: só o primeiro export salva. Teste na Task 9.
3. Logo girado encostado na borda ou com zoom enorme: continua inteiro no quadro. Teste na Task 2.
4. Voltar do editor para a câmera com foto local: a foto é descartada e a câmera remonta. Teste na Task 9.
5. Refeição sem legenda, sem macros, e análise sem nota: nenhum sticker vazio. Teste na Task 2.

---

### Task 1: Baseline do texto na exportação

**Files:**
- Modify: `apps/mobile/lib/share/capture.web.ts`
- Test: `apps/mobile/lib/share/capture.web.test.ts`

**Interfaces:**
- Produces: `garantirMetricasDeFonte(doc?: Document): void`, idempotente; `captureCard` chama antes do html2canvas.

- [ ] **Step 1: Teste falhando** em `capture.web.test.ts` (ambiente jsdom, html2canvas mockado):

```ts
test("corrige a <img> que o html2canvas usa para medir o baseline", () => {
  garantirMetricasDeFonte(document);
  expect(document.head.textContent).toContain(
    'body > div[style*="visibility: hidden"] > img',
  );
});

test("não duplica o estilo", () => {
  garantirMetricasDeFonte(document);
  garantirMetricasDeFonte(document);
  expect(document.head.querySelectorAll("style[data-share-metricas]")).toHaveLength(1);
});
```

- [ ] **Step 2: Rodar.** `npx jest lib/share/capture.web.test.ts`. Expected: FAIL, função não existe.
- [ ] **Step 3: Implementar** com um `<style data-share-metricas>` no `head`, e comentário dizendo por que a regra existe (preflight + `FontMetrics`, com a medida acima).
- [ ] **Step 4: Rodar.** Expected: PASS.
- [ ] **Step 5: Commit** `fix(share): corrige o baseline do texto na imagem exportada`

---

### Task 2: Modelo puro do story

**Files:**
- Create: `apps/mobile/lib/share/story.ts`
- Test: `apps/mobile/lib/share/story.test.ts`

**Interfaces:**
- Produces (todas com `"worklet"` quando usadas em gesto):

```ts
export type StickerId = "logo" | "data" | "itens" | "calorias" | "macros" | "placa"
  | "nota" | "titulo" | "resumo" | "topicos";
export type Sticker = { id: StickerId; dx: number; dy: number; scale: number;
  rotation: number; z: number; removido: boolean };
export type FotoLivre = { x: number; y: number; scale: number; rotation: number };
export type Caixa = { x: number; y: number; width: number; height: number };
export type Ponto = { x: number; y: number };
export type StoryPresetId = "completo" | "etiqueta" | "discreto" | "poster";
export type ConteudoStory = { kind: "meal" | "insight"; temLegenda: boolean;
  temMacros: boolean; temNota: boolean };

export const FOTO_PADRAO: FotoLivre;           // { x: 0, y: 0, scale: 1, rotation: 0 }
export const FOTO_ESCALA_MIN = 0.25;           // ZOOM_MAXIMO de crop.ts é o teto
export const STICKER_ESCALA_MIN = 0.4;
export const STICKER_ESCALA_MAX = 4;
export const LOGO_ESCALA_MIN = 0.8;
export const Z_LOGO = 1000;

export function stickersDoPreset(preset: StoryPresetId, c: ConteudoStory): StickerId[];
export function arranjoInicial(ids: StickerId[]): Sticker[];
export function moverSticker(s: Sticker, d: { dx: number; dy: number; k: number; rot: number }): Sticker;
export function prenderSticker(s: Sticker, caixa: Caixa): Sticker;
export function prenderLogo(s: Sticker, caixa: Caixa): Sticker;
export function moverFoto(f: FotoLivre, d: { dx: number; dy: number; k: number; rot: number }): FotoLivre;
export function alvoDoToque(p: Ponto, stickers: Sticker[], caixas: Partial<Record<StickerId, Caixa>>): StickerId | null;
export function trazerParaFrente(stickers: Sticker[], id: StickerId): Sticker[];
export function estiloSticker(s: Sticker): { zIndex: number; opacity: number; transform: object[] };
export function estiloFoto(f: FotoLivre, natural: Tamanho, quadro: Tamanho): { transform: object[] };
export function tamanhoDoQuadro(area: Tamanho, aspect: number): Tamanho;
export function zoomDaRoda(deltaY: number): number;   // Math.exp(-deltaY * 0.002)
export function deveSalvarFoto(a: { type: string; fotoLocal: string | null;
  temFotoSalva: boolean; jaSalvou: boolean }): boolean;
```

**Regras que os testes fixam:**
- `stickersDoPreset`, sempre com `logo` por último: Completo/Pôster de refeição = `data, itens, calorias, macros, logo`; Etiqueta = `placa, logo`; Discreto = `calorias, macros, logo`; análise Completo = `data, nota, titulo, resumo, topicos, logo`; análise Pôster sem `topicos`. `itens` sai sem legenda, `macros` sai sem macros, `nota` sai sem nota.
- `arranjoInicial`: `dx/dy/rotation` 0, `scale` 1, logo com `z = Z_LOGO`, demais `z` 1..n.
- `moverSticker` prende `scale` em `[STICKER_ESCALA_MIN, STICKER_ESCALA_MAX]`.
- `prenderSticker` mantém o centro do sticker dentro de 360×640, para ele não sumir do quadro.
- `prenderLogo` aplica `LOGO_ESCALA_MIN`, reduz a escala até o retângulo girado caber em 360×640, e prende o centro para o retângulo girado inteiro ficar dentro.
- `moverFoto` prende `scale` em `[FOTO_ESCALA_MIN, ZOOM_MAXIMO]` e o centro dentro do quadro.
- `alvoDoToque` testa do maior `z` para o menor, gira o ponto para o espaço do sticker, ignora `removido`, e dá ao menos 22dp de meia-altura e meia-largura de área de toque para stickers pequenos.
- `trazerParaFrente` dá ao sticker o maior `z` abaixo de `Z_LOGO`, e não muda o logo.
- `tamanhoDoQuadro`: `largura = min(area.width, area.height * aspect)`, altura pela proporção, valores inteiros arredondados para baixo.
- `deveSalvarFoto`: verdadeiro só com `type === "meal"`, `fotoLocal` preenchida, `temFotoSalva` falso e `jaSalvou` falso.

- [ ] **Step 1: Testes falhando** em `story.test.ts`, um por regra acima, incluindo:

```ts
test("logo girado na borda continua inteiro no quadro", () => {
  const caixa = { x: 26, y: 520, width: 112, height: 34 };
  const s = prenderLogo({ ...logo, dx: 400, dy: 400, rotation: 0.8, scale: 2 }, caixa);
  const c = cantosGirados(s, caixa); // helper local do teste
  for (const p of c) {
    expect(p.x).toBeGreaterThanOrEqual(-0.01);
    expect(p.x).toBeLessThanOrEqual(360.01);
    expect(p.y).toBeGreaterThanOrEqual(-0.01);
    expect(p.y).toBeLessThanOrEqual(640.01);
  }
});

test("zoom gigante no logo encolhe até caber", () => {
  const caixa = { x: 26, y: 520, width: 112, height: 34 };
  const s = prenderLogo({ ...logo, scale: 40 }, caixa);
  expect(112 * s.scale).toBeLessThanOrEqual(360.01);
});

test("sem legenda, macros ou nota, nenhum sticker vazio", () => {
  expect(stickersDoPreset("completo", { kind: "meal", temLegenda: false, temMacros: false, temNota: false }))
    .toEqual(["data", "calorias", "logo"]);
  expect(stickersDoPreset("poster", { kind: "insight", temLegenda: true, temMacros: false, temNota: false }))
    .toEqual(["data", "titulo", "resumo", "logo"]);
});

test("toque num sticker removido passa direto", () => { /* alvoDoToque devolve null */ });
```

- [ ] **Step 2: Rodar.** `npx jest lib/share/story.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar `lib/share/story.ts`.** `estiloSticker` gera `[{translateX},{translateY},{rotate:"<r>rad"},{scale}]`. `estiloFoto` usa `escalaCover(natural, quadro) * f.scale`.
- [ ] **Step 4: Rodar.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(share): modelo puro de foto e stickers do story`

---

### Task 3: Logo com sombra

**Files:**
- Create: `apps/mobile/scripts/gerar-logo-sombra.mjs`, `apps/mobile/assets/brand/logo-horizontal-branco-sombra.png`
- Modify: `apps/mobile/components/domain/share/ShareLogo.tsx`, `ShareLogo.web.tsx`

**Interfaces:**
- Produces: `ShareLogoVariant = "white" | "menta" | "sombra"`. A variante `sombra` tem proporção própria, exportada como `LOGO_SOMBRA_ASPECT`, e `height` continua sendo a altura do lockup, sem a margem da sombra.

A sombra é assada no PNG porque `filter: drop-shadow` não existe no html2canvas, e sombra de view em imagem transparente seria um retângulo. O script usa `pngjs`: lê `logo-horizontal-branco.png`, adiciona 24px de margem, faz blur em caixa de 3 passes com raio 10 no alpha, aplica `ink` a 45% com deslocamento y de 2px, e compõe o logo por cima.

- [ ] **Step 1: Escrever e rodar o script.** `node scripts/gerar-logo-sombra.mjs`. Expected: PNG de 1230×239.
- [ ] **Step 2: Adicionar a variante** nos dois `ShareLogo`. No nativo, `Image` direto, porque `Logo` não conhece o asset. Na web segue `<img>`, com a exceção já registrada.
- [ ] **Step 3: Rodar** `npx jest lib/no-html-tags.test.ts`. Expected: PASS.
- [ ] **Step 4: Commit** `feat(share): logo branco com sombra para ler sobre qualquer foto`

---

### Task 4: Virar câmera e permissão nativa

**Files:**
- Modify: `apps/mobile/lib/media/camera-constraints.ts`, `apps/mobile/lib/media/frame-capture.web.ts`, `apps/mobile/components/domain/CameraLive.web.tsx`, `apps/mobile/components/domain/CameraLive.tsx`, `apps/mobile/app.json`
- Test: `apps/mobile/lib/media/camera-constraints.test.ts`, `apps/mobile/lib/media/frame-capture.web.test.ts`, `apps/mobile/components/domain/CameraLive.web.test.tsx`

**Interfaces:**
- Produces: `type Lado = "back" | "front"`; `constraintsDeCamera(alvo?, lado: Lado = "back")`; `capturarFrame(video, { espelhar?: boolean })`; prop `facing?: Lado` em `CameraLive`, padrão `"back"`.

- [ ] **Step 1: Testes falhando:**
  - `constraintsDeCamera(PEDIDO_INICIAL, "front")` pede `facingMode: { ideal: "user" }`.
  - `capturarFrame` com `espelhar` chama `ctx.translate(width, 0)` e `ctx.scale(-1, 1)` antes do `drawImage`.
  - Trocar `facing` de `back` para `front` para os tracks do stream antigo, abre um novo com `user`, e o `<video>` nunca desmonta.
  - Com `front`, o `<video>` recebe `transform: scaleX(-1)`.
- [ ] **Step 2: Rodar os três arquivos.** Expected: FAIL.
- [ ] **Step 3: Implementar.** O efeito de abertura passa a depender de `facing`, e chama `setPronto(false)` ao reabrir. No nativo, `facing={facing}`.
- [ ] **Step 4: Em `app.json`**, adicionar `NSCameraUsageDescription` em `ios.infoPlist` e o plugin `["expo-camera", { "cameraPermission": "O Fitbrother usa a câmera para fotografar suas refeições." }]`.
- [ ] **Step 5: Rodar.** Expected: PASS.
- [ ] **Step 6: Commit** `feat(camera): vira a câmera e declara a permissão no nativo`

---

### Task 5: Presets e card do story

**Files:**
- Create: `apps/mobile/lib/share/story-presets.ts`, `apps/mobile/components/domain/share/StoryCard.tsx`
- Test: `apps/mobile/lib/share/story-presets.test.ts`, `apps/mobile/components/domain/share/StoryCard.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`Sticker`, `FotoLivre`, `estiloSticker`, `estiloFoto`), Task 3 (`ShareLogo variant="sombra"`).
- Produces:

```ts
export type StoryPreset = { id: StoryPresetId; label: string; text: string; textDim: string;
  accent: string; track: string; info: "full" | "chip" | "line"; vinheta: boolean };
export const STORY_PRESETS: readonly StoryPreset[];
export function presetsDoStory(a: { temFoto: boolean; temMacros: boolean }): readonly StoryPreset[];
export function presetPorId(id: StoryPresetId): StoryPreset;

export type StoryCardData;     // o ShareCardData atual, movido, com `temFotoSalva: boolean` em meal
export function conteudoDoStory(d: StoryCardData): ConteudoStory;
export function fotoDoCard(d: StoryCardData): string | null;
export function temMacros(d: StoryCardData): boolean;
export type CaixaStickerProps = { sticker: Sticker; style?: ViewStyle;
  onLayout?: (e: LayoutChangeEvent) => void; children: ReactNode };
export type CamadaFotoProps = { uri: string; natural: Tamanho | null; foto: FotoLivre };
export function StoryCard(p: { data: StoryCardData; preset: StoryPreset; stickers: Sticker[];
  vinheta: boolean; foto?: string | null; fotoNatural?: Tamanho | null; fotoLivre?: FotoLivre;
  fotoExterna?: boolean; CaixaSticker?: ComponentType<CaixaStickerProps>;
  CamadaFoto?: ComponentType<CamadaFotoProps>; aoMedir?: (id: StickerId, c: Caixa) => void }): ReactElement;
```

**Regras:**
- Tabela de presets da spec. Completo é o antigo Noturno em cores, Etiqueta e Discreto mantêm as cores, Pôster também. `vinheta`: Etiqueta `false`, demais `true`.
- `presetsDoStory`: foto + macros = `completo, etiqueta, discreto`; foto sem macros = `completo`; sem foto = `poster, completo`.
- Fundo sempre `colors.ink`, ou transparente com `fotoExterna`. Sem `LinearGradient` colorido.
- Vinheta só com foto ou `fotoExterna`.
- Reaproveitar `MacroBar`, `MacroLegend`, `Hero`, `DateLine` e os tamanhos dos corpos atuais de `ShareCard.tsx`, cada elemento numa `CaixaSticker` filha direta da coluna, com a margem no estilo da caixa. Os comentários que explicam medidas sobem junto.
- Etiqueta perde a `Brand` de dentro: `placa` traz número, data, barra e legenda; `logo` é outra caixa.
- Sticker `logo`: `ShareLogo variant="sombra"` com altura 18, e `fitbrother.app` abaixo, em `text-white` com `textShadow`. O endereço fica junto do logo porque é o que traz gente nova e não pode ser removido.
- Stickers de caixa justa usam `alignSelf: "flex-start"`, para o hit-test não pegar a coluna inteira: `logo`, `data`, `itens`, `calorias`.
- `withAlpha` e `truncate` são importados de `presets.ts` até a Task 9, que os move para `story-presets.ts`.

- [ ] **Step 1: Testes falhando:**
  - `presetsDoStory` nas três situações, e nenhum preset com a palavra `gradient` (o tipo não tem campo de fundo).
  - `StoryCard` com refeição desenha `612`, os itens e o logo.
  - Sticker `removido` fica com `opacity: 0` e continua no fluxo.
  - Vinheta aparece com `vinheta` e foto, e some com `vinheta={false}` ou sem foto. Use `testID="vinheta"`.
  - `fotoExterna` deixa o fundo transparente e não desenha a foto do dado.
  - Etiqueta: remover `placa` mantém o logo visível.
  - `aoMedir` recebe a caixa do `onLayout` de cada sticker.
- [ ] **Step 2: Rodar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(share): card do story com presets sem gradiente`

---

### Task 6: Fila de presets

**Files:**
- Create: `apps/mobile/components/domain/share/PresetRow.tsx`
- Test: `apps/mobile/components/domain/share/PresetRow.test.tsx`

**Interfaces:**
- Consumes: `StoryPreset`.
- Produces:

```ts
export const PASSO_PRESET = 72;
export function proximoIndice(index: number, arrasto: number, total: number): number;
export function PresetRow(p: { presets: readonly StoryPreset[]; index: number;
  onSelecionar: (i: number) => void; onCentro: () => void; centroDesabilitado?: boolean;
  rotuloCentro: string; ocupado?: boolean }): ReactElement;
```

Bolinhas de 56 (lado) em fila deslizante, com `Tag`, `Minus`, `Flame`, `Type` do lucide por preset. O anel central é um `Pressable` fixo de 76, com borda `primary-400`, sobre a fila. O nome do preset fica acima, em `font-sans-semibold` branco. Arrasto > `PASSO_PRESET / 3` troca um índice. Sem bolinhas laterais quando `presets.length === 1`.

- [ ] **Step 1: Testes falhando:** `proximoIndice(0, -30, 3) === 1`, `proximoIndice(0, 30, 3) === 0`, `proximoIndice(2, -30, 3) === 2`, arrasto curto mantém; tocar numa lateral chama `onSelecionar(i)`; tocar no centro chama `onCentro`; `centroDesabilitado` não chama.
- [ ] **Step 2: Rodar.** Expected: FAIL.
- [ ] **Step 3: Implementar** com `Gesture.Pan().activeOffsetX([-8, 8])` e `withTiming` usando `lib/motion.ts`.
- [ ] **Step 4: Rodar.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(share): fila de presets ao redor do disparo`

---

### Task 7: Palco de câmera

**Files:**
- Create: `apps/mobile/components/domain/share/CameraStage.tsx`
- Test: `apps/mobile/components/domain/share/CameraStage.test.tsx`

**Interfaces:**
- Consumes: `CameraLive` com `facing`, `tamanhoDoQuadro`.
- Produces:

```ts
export type Disparo = { disparar: () => void; habilitado: boolean; ocupado: boolean };
export function CameraStage(p: { aspect: number; rotulo: string;
  onCapture: (uri: string, tamanho: Tamanho) => void; onGaleria: () => void;
  onSemFoto: () => void; onFechar: () => void; onErroCaptura: (err: unknown) => void;
  sobreposicao?: ReactNode; topoDireita?: ReactNode;
  fila?: (d: Disparo) => ReactNode }): ReactElement;
```

Fundo `bg-ink`. A área flexível mede o próprio tamanho e centraliza o quadro de `tamanhoDoQuadro`, com raio 18. ✕ no topo esquerdo da área, "Sem foto" (`ImageOff` + rótulo) na lateral esquerda, `fila` no pé da área, com o disparo simples como padrão. Barra inferior de 76: `Image` da galeria (ícone), `rotulo`, `SwitchCamera`. Com a câmera indisponível, o quadro mostra "Sem câmera aqui. Use a galeria ou siga sem foto." e o disparo fica desabilitado.

- [ ] **Step 1: Testes falhando**, adaptando `ShareCameraStage.test.tsx`: uma câmera só; disparo bloqueado até `onReady`; toque duplo não captura duas vezes; rejeição chama `onErroCaptura`; virar passa `facing="front"` sem remontar; indisponível mostra a mensagem e mantém galeria e "Sem foto"; ✕, galeria e "Sem foto" chamam os callbacks.
- [ ] **Step 2: Rodar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(share): palco de câmera em tela cheia`

---

### Task 8: Editor com gestos

**Files:**
- Create: `apps/mobile/components/domain/share/useStoryGestos.ts`, `apps/mobile/components/domain/share/StoryEditor.tsx`
- Modify: `apps/mobile/lib/share-card.ts`
- Test: `apps/mobile/components/domain/share/StoryEditor.test.tsx`, `apps/mobile/lib/share-card.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 5, 6.
- Produces:

```ts
export function podeCompartilharArquivos(): boolean;   // lib/share-card.ts; nativo: true
export function StoryEditor(p: { data: StoryCardData; foto: string | null;
  fotoNatural: Tamanho | null; presetInicial: StoryPresetId; vinhetaInicial: boolean;
  onVoltar: () => void; onExportar: () => void }): ReactElement;
```

**Gestos (`useStoryGestos`):** um `GestureDetector` numa camada transparente do tamanho exibido, por cima do `StoryCard`, com `touchAction="none"`. Assim `e.x / escala` vale nas duas plataformas, sem depender da escala CSS do preview.

- `Gesture.Simultaneous(Pan.minPointers(1).maxPointers(2), Pinch, Rotation)`, todos por **`onChange` incremental** (`changeX`, `scaleChange`, `rotationChange`), nunca por total acumulado. É isso que deixa o segundo dedo entrar sem salto.
- O alvo é escolhido no primeiro `onBegin` do conjunto com `alvoDoToque`. Sem sticker no ponto, o alvo é a foto. Fica fixo até todos os gestos acabarem, então o segundo dedo pode cair fora de um sticker pequeno.
- Foto com um dedo não faz nada: só aplica com `numberOfPointers >= 2` ou `pointerType === PointerType.MOUSE`.
- Sticker: `moverSticker` + `prenderSticker`, ou `prenderLogo` no logo. Foto: `moverFoto`.
- Lixeira: ao arrastar sticker que não é o logo, avisa o JS, e o editor esconde a fila e mostra `Trash2` no pé do quadro. Soltar dentro do raio de 44dp marca `removido`.
- No fim do conjunto, `runOnJS` passa stickers e foto para o estado React.
- `trazerParaFrente` no início do gesto em sticker.
- Na web, `wheel` com `{ passive: false }` na camada aplica `zoomDaRoda` ao alvo sob o cursor, com commit após 120ms sem roda.

**Editor:** usa `CaixaSticker` e `CamadaFoto` animadas no quadro visível e as estáticas no nó fora da tela (`left: -9999`, 360×640), que é o que `captureCard` recebe. Topo: voltar e vinheta (`Contrast`, com `accessibilityState.selected`, oculto sem foto). Fila: `PresetRow`, cujo centro refaz o arranjo do preset atual. Trocar de preset refaz o arranjo e aplica a vinheta do preset. Ações: Baixar (web) ou Salvar na galeria (nativo), e Compartilhar se `podeCompartilharArquivos()`. `onExportar` é chamado antes de gerar a imagem, em Baixar e em Compartilhar. Mensagens de erro e o texto "Gerando imagem…" são os da tela atual.

- [ ] **Step 1: Testes falhando:**
  - `podeCompartilharArquivos`: falso sem `navigator.canShare`, verdadeiro quando ele aceita o arquivo.
  - Editor: sem `canShare` não há botão Compartilhar, e Baixar segue lá.
  - Baixar captura o nó fora da tela e chama `onExportar`.
  - Trocar de preset refaz os stickers e aplica `vinheta` do novo preset.
  - Tocar no preset selecionado restaura sticker removido. Injete o removido pelo mock de `useStoryGestos`.
  - Vinheta alterna e some sem foto.
- [ ] **Step 2: Rodar.** Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(share): editor com gestos de foto e stickers`

---

### Task 9: Fluxo completo na tela de compartilhar

**Files:**
- Create: `apps/mobile/components/domain/share/ShareFlow.tsx`
- Modify: `apps/mobile/app/(app)/share/[type]/[id].tsx`, `apps/mobile/app/(app)/_layout.tsx`, `apps/mobile/lib/share/story-presets.ts`
- Delete: `components/domain/ShareCard.tsx`, `components/domain/ShareCard.test.tsx`, `components/domain/share/ShareCameraStage.tsx`, `ShareCameraStage.test.tsx`, `ShareAdjustStage.tsx`, `SharePresetCarousel.tsx`, `lib/share/presets.ts`, `lib/share/presets.test.ts`
- Test: `apps/mobile/components/domain/share/ShareFlow.test.tsx`

**Interfaces:**
- Consumes: tudo acima, `useDialog().confirm`, `uploadMealPhoto`, `patchMeal`, `pickImage`, `medirImagem`, `toDisplayableImageUri`.
- Produces: `ShareFlow({ type, id })`. A rota só lê os params e renderiza `ShareFlow`, porque `app/` não pode conter arquivo de teste.

**Fluxo:** `loadCardData` e `persistirFoto` saem da rota para `ShareFlow`. `loadCardData` preenche `temFotoSalva: Boolean(m.image_path)`. Depois de carregar, uma única vez:

- `post` e `insight`: editor direto, com a foto do dado. Análise e post sem foto abrem em Pôster.
- `meal` com `imageUrl`: `confirm({ title: "Usar a foto salva?", description: "Esta refeição já tem uma foto.", confirmLabel: "Usar a foto salva", cancelLabel: "Tirar outra" })`. Sim abre o editor com a foto salva. Não abre a câmera. Enquanto a resposta não chega, o quadro mostra `ShareCardSkeleton`.
- `meal` sem `imageUrl`: câmera direto.

Câmera do story: `CameraStage` com `sobreposicao` = `StoryCard` com `fotoExterna` e stickers do preset, escalado para o quadro, sem gestos (`pointerEvents: "none"`). `PresetRow` na `fila` e vinheta em `topoDireita`. Preset e vinheta passam para o editor. Galeria no web passa por `toDisplayableImageUri` antes de virar foto do editor. "Sem foto" abre o editor com `foto = null`, mesmo havendo foto salva.

Voltar do editor: `meal` volta à câmera e zera a foto local. `post`/`insight` fecha a tela. Ao exportar, `deveSalvarFoto(...)` decide o `persistirFoto`, e um `useRef` guarda `jaSalvou`. A revogação de blob continua no `useEffect` da foto.

`_layout.tsx`: `presentation: "fullScreenModal"`, ajustando o comentário.

Mover `withAlpha` e `truncate` para `story-presets.ts`.

- [ ] **Step 1: Testes falhando** (mocks de `CameraLive`, API, `useDialog`, `pickImage`, `captureCard`):
  - Refeição sem foto: não pergunta e abre a câmera.
  - Refeição com foto: pergunta com os dois rótulos, e "Usar a foto salva" abre o editor sem montar `CameraLive`.
  - "Tirar outra" abre a câmera; exportar a foto nova não chama `uploadMealPhoto`.
  - `image_path` preenchido com foto que não carregou: não pergunta, abre a câmera, e exportar não chama `uploadMealPhoto`.
  - Refeição sem foto: capturar, exportar duas vezes chama `uploadMealPhoto` uma vez, e `patchMeal(id, { has_photo: true })` uma vez.
  - Capturar, exportar, voltar, capturar outra e exportar: `uploadMealPhoto` continua em uma chamada.
  - Capturar e voltar sem exportar: nenhum upload, a câmera volta, e a foto local foi descartada.
  - "Sem foto" com foto salva: editor sem foto.
  - Post abre o editor com a foto do post, e voltar chama `router.back`.
  - Análise abre em Pôster.
- [ ] **Step 2: Rodar.** Expected: FAIL.
- [ ] **Step 3: Implementar, apagar os arquivos antigos e ajustar imports** (`ShareCardSkeleton` é mantido; o comentário passa a citar `StoryCard`).
- [ ] **Step 4: Rodar.** `npx jest components/domain/share lib/share && npx tsc --noEmit`. Expected: PASS, sem erro de tipo.
- [ ] **Step 5: Commit** `feat(share): fluxo de story no lugar do carrossel`

---

### Task 10: Novo post, entradas e rótulos

**Files:**
- Create: `apps/mobile/components/domain/share/PostCameraStep.tsx`
- Modify: `apps/mobile/app/(app)/post/new.tsx`, `apps/mobile/app/(app)/meal/[id]/index.tsx`, `apps/mobile/components/domain/ShareMealPrompt.tsx`, `apps/mobile/components/domain/MealCardSwipeable.tsx`
- Test: `apps/mobile/components/domain/share/PostCameraStep.test.tsx`

**Interfaces:**
- Consumes: `CameraStage`, `FEED_PHOTO_ASPECT`.
- Produces: `PostCameraStep({ onFoto: (uri: string) => void; onSemFoto: () => void; onFechar: () => void })`.

- [ ] **Step 1: Teste falhando:** capturar chama `onFoto(uri)`; "Sem foto" chama `onSemFoto`; galeria chama `pickImage({ quality: 1 })` e `onFoto`; `CameraLive` recebe `aspect` 0.8; sem `PresetRow`.
- [ ] **Step 2: Rodar.** Expected: FAIL.
- [ ] **Step 3: Implementar** `PostCameraStep` e, em `post/new.tsx`, um estado `etapa` que começa em `"camera"` e vai para `"form"`. O resto da tela segue igual.
- [ ] **Step 4: Atualizar as entradas.** Detalhe da refeição: **Compartilhar** (primário, `Share2`, vai para `share/meal/:id`) e **Novo post** (secundário, `ImagePlus`, vai para `post/new`), com o comentário reescrito. `ShareMealPrompt`: rótulo e `accessibilityLabel` "Compartilhar", ícone `Share2`. `MealCardSwipeable`: `Compartilhar ${...}`, rótulo "Compartilhar", ícone `Share2`, com o maior rótulo cabendo na ação de 80dp. `InsightCard` e `PostCard` não mudam.
- [ ] **Step 5: Rodar.** `npx jest components/domain lib` Expected: PASS.
- [ ] **Step 6: Commit** `feat(post): abre o novo post pela câmera 4:5`

---

### Task 11: Limpeza e verificação

**Files:**
- Delete: `apps/mobile/app/debug-camera.tsx`
- Modify: `docs/PLAN.md`

- [ ] **Step 1: Apagar `debug-camera.tsx`** e qualquer referência a ele.
- [ ] **Step 2: Registrar em `docs/PLAN.md`** o gate da Task 6 (iPhone, Safari e Vivaldi: 1080×1920 pedindo 1920×1080; D1 de pé; Android não medido) e um status desta entrega, incluindo o defeito de baseline do html2canvas e a limitação de ambiente.
- [ ] **Step 3: Rodar a checagem completa.** `cd apps/mobile && npm run typecheck && npm test`, e `npm run lint` na raiz. Expected: tudo verde.
- [ ] **Step 4: Verificar no navegador** (viewport mobile, usuário de teste local, câmera falsa do Chromium ou galeria): refeição sem foto até exportar; refeição com foto; "Sem foto"; análise; Novo post; gesto de foto e de sticker por `PointerEvent` sintético de toque; lixeira; PNG exportado comparado ao editor; desktop com mouse e roda.
- [ ] **Step 5: Commit** `chore(share): remove a tela de medição e registra o gate da câmera`
