# Design System — Fitbrother

App de nutrição com IA. Stack: **React Native · Expo · TypeScript · NativeWind v4 · Tailwind v3**.

Este documento é a **fonte de verdade da marca e dos tokens visuais**. A partir da v2 ele reflete a **marca real do FitBrother** (menta `#06D59F` + tinta `#04100C`, display Space Grotesk) — consolidada na landing e nos assets em [`assets/brand`](assets/brand).

> ⚠️ **O código do app ainda está em teal/Plus Jakarta** (`tailwind.config.ts`, `lib/colors.ts`). Este doc é o **alvo**; a migração do código está pendente — ver **§0**. Até a migração, doc e app divergem **por design**, não por bug.

Referência visual viva: **[`landing-page/public/styleguide.html`](landing-page/public/styleguide.html)** (`npm run dev` → `/styleguide.html`).

---

## 0. Migração da Marca (pendente)

A marca foi redefinida (menta + tinta, display Space Grotesk). O código do app ainda usa a paleta teal antiga e Plus Jakarta. Para sincronizar app ↔ marca:

| Arquivo | De | Para |
|---|---|---|
| `apps/mobile/tailwind.config.ts` → `primary` | teal `#2DD4BF` (400) | menta `#06D59F` (400) — escala em §2.1 |
| `apps/mobile/tailwind.config.ts` → neutro mais escuro | `neutral-900 #0F172A` (slate) | **tinta** `#04100C` (botões dark, contraste máximo) |
| `apps/mobile/lib/colors.ts` | espelho dos teal | espelho dos novos tokens |
| Fonte display | Plus Jakarta Sans | **Space Grotesk** (`@expo-google-fonts/space-grotesk`) p/ headings e números hero |
| Fonte corpo | Plus Jakarta Sans | **Inter** (decisão de marca; ver §3) |
| Macros | `#F43F5E / #F59E0B / #8B5CF6` | tons da landing `#E8506B / #D98A1C / #7A5BE0` (contraste sobre claro) |

**Importante:** os _nomes_ de token (`primary-400`, `font-sans-*`) permanecem — só mudam **valores** e **arquivos de fonte**. Componentes que referenciam `primary-400` continuam corretos após o swap. Fazer a migração em PR próprio, com revisão visual do app (Expo) tela a tela.

---

## Índice

0. [Migração da Marca (pendente)](#0-migração-da-marca-pendente)
1. [Convenções e Regras de Ouro](#1-convenções-e-regras-de-ouro)
2. [Paleta de Cores](#2-paleta-de-cores)
3. [Tipografia](#3-tipografia)
4. [Espaçamento](#4-espaçamento)
5. [Formas e Bordas](#5-formas-e-bordas)
6. [Elevação e Sombras](#6-elevação-e-sombras)
7. [Motion](#7-motion)
8. [Acessibilidade](#8-acessibilidade)
9. [Ícones](#9-ícones)
10. [Dark Mode](#10-dark-mode)
11. [Componentes Base](#11-componentes-base)
12. [Componentes do Domínio Nutricional](#12-componentes-do-domínio-nutricional)
13. [Referência NativeWind](#13-referência-nativewind)

---

## 1. Convenções e Regras de Ouro

### 1.1 Tipografia — leia ANTES de codar

⚠️ **Pegadinha do React Native:** os utilitários `font-medium` / `font-semibold` / `font-bold` aplicam **apenas `fontWeight`** — eles **não trocam a fontFamily**. Resultado: a família com o peso desejado (ex.: Inter Medium) nunca carrega e o RN renderiza Regular com peso sintetizado.

**Regra:** sempre use a família correspondente ao peso desejado.

| Peso | Classe correta ✅ | Classe ERRADA ❌ |
|---|---|---|
| 400 Regular | `font-sans` | (sem classe — vira `System`) |
| 500 Medium | `font-sans-medium` | `font-medium` |
| 600 SemiBold | `font-sans-semibold` | `font-semibold` |
| 700 Bold | `font-sans-bold` | `font-bold` |
| 800 ExtraBold | `font-sans-extrabold` | `font-extrabold` |

### 1.2 Números nutricionais → `tabular-nums`

Valores numéricos (kcal, gramas de macro, contador de streak) **devem** usar `tabular-nums`, senão a largura dos dígitos varia e o layout "pula" ao animar.

```tsx
<Text
  className="text-2xl font-sans-bold text-neutral-900"
  style={{ fontVariant: ["tabular-nums"] }}
>
  {kcal}
</Text>
```

### 1.3 Cores via tokens

**Proibido `#hex` inline** em JSX. Exceção: valores passados para `react-native-svg`, `react-native-skia` ou animações (Reanimated) — nesses casos, importar de `@/lib/colors.ts` que exporta o mesmo token.

### 1.4 Hit target mínimo

Todo elemento tocável: `min-w-[44px] min-h-[44px]` (iOS HIG) ou `hitSlop={8}` em alvos visuais menores.

### 1.5 Espaçamento

Base **4px** (grid Tailwind padrão). Não usar valores fora da escala (`p-[13px]` é proibido — adicionar ao theme se precisar).

---

## 2. Paleta de Cores

### 2.1 Marca — Menta (primary)

A cor de marca é uma **menta vibrante**: CTAs, ícones, anel de calorias, marca-texto, destaques. Sobre fundos claros é usada como **acento** (não como grandes áreas de texto — ver nota de contraste).

| Escala | HEX | Uso |
|---|---|---|
| 50 | `#E9FCF5` | Surface menta muito suave |
| 100 | `#C6F7E6` | Background de badge/chip menta |
| 200 | `#8FEFCD` | Decorações, disabled |
| 300 | `#4BE5AE` | Menta clara |
| **400** | **`#06D59F`** | **PRIMÁRIA — botões, ícones, anel de calorias, bordas ativas, marca-texto** |
| 500 | `#05B789` | Pressed/hover |
| 600 | `#04A87E` | **Menta de texto/realce sobre claro** (passa contraste melhor) |
| 700 | `#038266` | Ênfase alta |
| 800 | `#02624D` | Ênfase muito alta |
| 900 | `#014537` | Quase preto menta |

> **Contraste:** menta-400 (`#06D59F`) sobre branco **não** atinge AA para texto pequeno. Use menta como **preenchimento** (com texto tinta por cima) ou para áreas grandes; para _texto_ menta sobre claro, use menta-600 (`#04A87E`) em peso forte, ou prefira tinta. Texto tinta sobre menta-400 ✅.

### 2.1.1 Marca — Tinta &amp; superfícies

A âncora escura da marca não é slate, é **tinta** (verde-quase-preto). As superfícies claras formam três camadas.

| Token | HEX | Uso |
|---|---|---|
| `ink` | `#04100C` | Texto principal, réguas, botão dark, contraste máximo |
| `ink-soft` | `#0A1F17` | Variante levemente mais clara |
| `canvas` | `#F6F7F5` | Fundo de tela (off-white) |
| `surface` | `#FFFFFF` | Cards |
| `mist` | `#ECEEEE` | Seções/fills alternados |

> Na migração (§0), `ink #04100C` substitui `neutral-900 #0F172A` como tom escuro da marca. Os neutros intermediários (300–600 slate) seguem válidos para texto secundário até revisão.

### 2.2 Neutros

| Escala | HEX | Uso |
|---|---|---|
| 50 | `#F8FAFC` | Fundo de tela (branco frio) |
| 100 | `#F1F5F9` | Fundo de itens de lista, skeleton base |
| 200 | `#E2E8F0` | Bordas de inputs/cards, dividers, skeleton shimmer |
| 300 | `#CBD5E1` | Placeholder icons, elementos inativos |
| 400 | `#94A3B8` | Placeholder text |
| 500 | `#64748B` | Body text secundário, meta info |
| 600 | `#475569` | Texto secundário com mais peso |
| 700 | `#334155` | Texto de label, headings menores |
| **800** | **`#1E293B`** | **Headings principais** |
| **900** | **`#0F172A`** | **Botão dark, texto de máximo contraste** |

### 2.3 Feedback

| Token | HEX | Uso |
|---|---|---|
| `danger-50` | `#FEF2F2` | Fundo do banner de erro |
| `danger-500` | `#EF4444` | Texto/ícone de erro |
| `danger-600` | `#DC2626` | Borda do banner de erro |
| `success-500` | `#22C55E` | Confirmações, "goal hit" |
| `warning-400` | `#FBBF24` | Estrelas, badges de destaque |
| `warning-500` | `#F59E0B` | Avisos médios |

### 2.4 Macros (domínio Fitbrother)

Cores semânticas para os 3 macronutrientes. Calorias usam `primary-400` (anel central do dashboard).

| Token | HEX | Uso |
|---|---|---|
| `protein-500` | `#F43F5E` | Anel de proteína, badge "P", barra |
| `protein-100` | `#FFE4E6` | Background do badge |
| `protein-50` | `#FFF1F2` | Surface |
| `carbs-500` | `#F59E0B` | Anel de carboidrato, badge "C", barra |
| `carbs-100` | `#FEF3C7` | Background do badge |
| `carbs-50` | `#FFFBEB` | Surface |
| `fat-500` | `#8B5CF6` | Anel de gordura, badge "G", barra |
| `fat-100` | `#EDE9FE` | Background do badge |
| `fat-50` | `#F5F3FF` | Surface |

**Convenção de ícones (lucide-react-native):**
- Calorias: `Flame`
- Proteína: `Beef`
- Carboidrato: `Wheat`
- Gordura: `Droplet`

### 2.5 Streak (🔥 gamificação)

| Token | HEX | Uso |
|---|---|---|
| `streak-400` | `#FB923C` | Foguinho ativo (default) |
| `streak-500` | `#F97316` | Pressed/active state |
| `streak-600` | `#EA580C` | Ênfase alta |
| `streak-100` | `#FFEDD5` | Background do badge |
| `streak-50` | `#FFF7ED` | Surface do card de streak |

Estado "em risco" (faltam < 4h do reset): aplicar `opacity-50` no ícone + `neutral-400` no texto.

---

## 3. Tipografia

### 3.1 Famílias

Sistema de duas famílias (alinhado à marca/web):

- **Space Grotesk** — **display**: headings, títulos de card, números hero (kcal/macros). Geométrica, conversa com o corte do símbolo "FB".
- **Inter** — **corpo**: parágrafos, labels, inputs, metadados.

> O app ainda carrega Plus Jakarta Sans (ver §0). Após a migração, instalar as famílias da marca:

```bash
npx expo install expo-font @expo-google-fonts/space-grotesk @expo-google-fonts/inter
```

```ts
// app/_layout.tsx (alvo pós-migração)
import { useFonts } from "expo-font";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
```

**Mapa de papéis:** `font-display-*` (Space Grotesk) para títulos e números; `font-sans-*` (Inter) para corpo. A pegadinha de `fontWeight` da §1.1 vale para ambas.

### 3.2 Escala

| Token | px | line-height | Uso |
|---|---|---|---|
| `text-xs`   | 12 | 16 | Labels de gráfico, meta info, timestamps |
| `text-sm`   | 14 | 20 | Labels de input, helper text, subtítulos de card |
| `text-base` | 16 | 24 | Corpo padrão, texto de input |
| `text-lg`   | 18 | 28 | Item title, subtítulo de seção |
| `text-xl`   | 20 | 28 | Título menor de tela |
| `text-2xl`  | 24 | 32 | Valor numérico de destaque (kcal do dia) |
| `text-3xl`  | 28 | 36 | Heading de onboarding |
| `text-4xl`  | 32 | 40 | Heading grande |
| `text-5xl`  | 40 | 48 | Hero number (anel central do dashboard) |

### 3.3 Pesos (lembrar §1.1 — usar `font-sans-*`)

| Classe | Peso | Uso |
|---|---|---|
| `font-sans` | 400 | Body, placeholder |
| `font-sans-medium` | 500 | Labels, item subtítulos |
| `font-sans-semibold` | 600 | Botões, labels de campo, item titles |
| `font-sans-bold` | 700 | Headings de card, números de destaque |
| `font-sans-extrabold` | 800 | Headings de onboarding, hero numbers |

---

## 4. Espaçamento

Base: **4px** (Tailwind padrão).

| Classe | px | Uso |
|---|---|---|
| `p-1` | 4 | Micro espaço, ícones |
| `p-2` | 8 | Gaps apertados |
| `p-3` | 12 | Gap ícone↔label, padding de badge |
| `p-4` | 16 | Padding interno padrão (cards, inputs) |
| `p-5` | 20 | Padding horizontal de tela (`safe-horizontal`) |
| `p-6` | 24 | Seções maiores |
| `p-8` | 32 | Espaço entre seções principais |
| `p-12` | 48 | Separação topo/bottom em telas auth |
| `gap-2` | 8 | Linha de chips |
| `gap-3` | 12 | Inputs empilhados |
| `gap-4` | 16 | Cards |
| `gap-6` | 24 | Grupos de elementos |

Tokens semânticos extras em `tailwind.config.ts`:
- `safe-horizontal` (20px) — padding lateral de tela
- `input-height` (52px), `button-height` (52px), `button-height-sm` (40px), `button-height-lg` (60px)

---

## 5. Formas e Bordas

### 5.1 Raios

| Elemento | Valor | Classe |
|---|---|---|
| Botões (primário, dark) | 9999px | `rounded-full` |
| Inputs | 12px | `rounded-xl` |
| Cards | 16px | `rounded-2xl` |
| Badges/chips | 9999px | `rounded-full` |
| Ícones circulares (avatar) | 50% | `rounded-full` |
| Banner de feedback | 12px | `rounded-xl` |
| Bottom sheet (topo) | 24px | `rounded-t-3xl` |
| Progress ring (stroke) | round | `strokeLinecap="round"` |

### 5.2 Bordas

| Uso | Estilo |
|---|---|
| Input repouso | `border border-neutral-200` |
| Input focused | `border-[1.5px] border-primary-400` |
| Input error | `border-[1.5px] border-danger-500` |
| Card outlined | `border border-neutral-200` |
| Meal Card precisa revisão | `border-[1.5px] border-warning-500` |

---

## 6. Elevação e Sombras

> **iOS:** propriedades `shadow*` via `style`. **Android:** `elevation` via `style`. NativeWind v4 trata `shadow-*` para iOS, mas para Android **sempre** passar `elevation` explicitamente. Use `Platform.select(...)` (ver `components/Card.tsx`).

### Nível 1 — Card padrão
```ts
shadowColor: "#000000",
shadowOffset: { width: 0, height: 1 },
shadowOpacity: 0.06,
shadowRadius: 4,
elevation: 2,
```

### Nível 2 — Card em destaque
```ts
shadowColor: "#000000",
shadowOffset: { width: 0, height: 4 },
shadowOpacity: 0.10,
shadowRadius: 12,
elevation: 5,
```

### Nível 3 — Bottom sheet, modal flutuante
```ts
shadowColor: "#000000",
shadowOffset: { width: 0, height: -2 },
shadowOpacity: 0.15,
shadowRadius: 20,
elevation: 12,
```

---

## 7. Motion

⚠️ **Em React Native não há `transition` CSS.** Animações usam `react-native-reanimated`. Os tokens abaixo são **constantes JS**, não classes Tailwind.

Arquivo: `lib/motion.ts`

```ts
export const Motion = {
  duration: {
    fast: 120,    // tap feedback, press scale
    base: 200,    // bottom sheet, toast
    slow: 300,    // progress ring update
    slower: 500,  // streak pulse, hero transitions
  },
  easing: {
    standard: [0.4, 0, 0.2, 1],    // padrão (in-out)
    accelerate: [0.4, 0, 1, 1],    // saída
    decelerate: [0, 0, 0.2, 1],    // entrada
  },
} as const;
```

**Usos canônicos:**
- Botão pressed: scale `0.97`, `duration.fast`, easing standard
- Bottom sheet open: `duration.base`, decelerate
- Progress ring animation: `withTiming(value, { duration: 300, easing: easeOutCubic })`
- Streak 🔥 pulse: loop infinito, `duration.slower`, scale 1 ↔ 1.1
- Toast: slide-down `duration.base` decelerate, slide-up `duration.fast` accelerate

---

## 8. Acessibilidade

- **Hit target mínimo:** 44×44 pt — `min-w-[44px] min-h-[44px]` ou `hitSlop`.
- **Contraste mínimo:** 4.5:1 (texto < 18pt), 3:1 (texto ≥ 18pt). Combinações testadas: `neutral-500` em `white`, `neutral-800` em `neutral-50`, `white` em `primary-400` ✅.
- **`accessibilityLabel` obrigatório** em qualquer Pressable que não tenha label textual (ícone-only).
- **`accessibilityRole`** declarado em componentes interativos (`"button"`, `"link"`, `"checkbox"`).
- **`accessibilityState`** para estados (`checked`, `disabled`, `selected`).
- **Reduced Motion:** respeitar `useReducedMotion()` do Reanimated — pulse de streak desliga; durations vão para 0.
- **Dynamic Type:** todos os `text-*` devem permitir `allowFontScaling` (default true). Não fixar height em containers de texto sem `min-height`.

---

## 9. Ícones

**Biblioteca única: `lucide-react-native`.**

```bash
npx expo install lucide-react-native react-native-svg
```

Não usar `@expo/vector-icons` em código novo. (O `EyeIcon` "fake" feito com `<View>` em `Input.tsx` será substituído por `<Eye />` / `<EyeOff />` do lucide.)

**Tamanhos canônicos:**

| Contexto | Size |
|---|---|
| Inline em texto | 16 |
| Leading icon em input | 20 |
| Icon button (44×44 hit, ícone visual) | 24 |
| Feature icon (em empty state, hero) | 32–40 |
| Tab bar | 24 |

**Cor:** sempre via prop `color`, vinda de `@/lib/colors.ts` (mirror dos tokens).

---

## 10. Dark Mode

**Status: V2 — fora do MVP.**

NativeWind v4 já suporta `dark:` nativamente, mas a paleta dark do Fitbrother ainda **não está definida**. Não usar `dark:` em código no MVP. Pós-MVP, definir tokens dark e o switch para passar pelo design review novamente.

---

## 11. Componentes Base

### 11.1 Button (`components/Button.tsx`)

```
┌──────────────────────────────────────────────┐
│  [leftIcon?]    Label Text    [rightIcon?]   │  ← height: 52px (md)
└──────────────────────────────────────────────┘
       rounded-full · px-6 · font-sans-semibold
```

| Variante | Fundo | Texto | Borda |
|---|---|---|---|
| `primary` | `primary-400` | white | — |
| `dark` | `neutral-900` | white | — |
| `outline` | transparent | `neutral-800` | `neutral-200` |
| `ghost` | transparent | `primary-400` | — |
| `disabled` (variante × disabled) | `primary-200` (pri), `neutral-400` (dark), translúcido | — | — |

**Tamanhos:** `sm` (40px / `text-sm` / `px-4`), `md` (52px / `text-base` / `px-6`) — padrão, `lg` (60px / `text-lg` / `px-8`).

**Estados:** `loading` mostra `ActivityIndicator`; `pressed` aplica variante de cor mais escura.

### 11.2 Input (`components/Input.tsx`)

```
Label (text-sm · font-sans-medium · neutral-700)
┌─────────────────────────────────────────────┐
│ [icon]  Placeholder / Value      [eye?]    │  ← height: 52px
└─────────────────────────────────────────────┘
   rounded-xl · border neutral-200
   focused → border-[1.5px] primary-400
   error   → border-[1.5px] danger-500

Helper / Error (text-xs · font-sans-medium · danger-500)
```

Estados: `default`, `focused`, `filled`, `error`.

### 11.3 Card (`components/Card.tsx`)

3 variantes:

| Variante | Fundo | Borda | Sombra |
|---|---|---|---|
| `elevated` | white | — | Nível 1 |
| `outlined` | white | `neutral-200` | — |
| `flat` | `neutral-50` | — | — |

Padding padrão `p-4`, raio `rounded-2xl`. Quando recebe `onPress`, vira `Pressable` com feedback de cor (flat/outlined) ou de sombra (elevated → Nível 2 ao pressionar).

### 11.4 Onboarding Nav Buttons

```
  ┌───┐   ┌───┐
  │ < │   │ > │   ← rounded-full · w-12 h-12
  └───┘   └───┘
   bg-neutral-900 · white icon (lucide ChevronLeft/Right · 20)
```

### 11.5 Error Banner

```
┌──────────────────────────────────────────────┐
│ ⚠  ERROR: Senha incorreta                [×] │
└──────────────────────────────────────────────┘
  bg-danger-50 · border border-danger-600 · rounded-xl · p-3
  text: danger-500 · text-sm · font-sans-medium
  ícone: lucide AlertCircle 20
```

### 11.6 Progress Bar (Linear — Onboarding)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
█████████████████░░░░░░░░░░░░░░░░░░░   ← height: 3px
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  track: neutral-200 · fill: primary-400 · rounded-full
```

### 11.7 Password Strength Bar

```
█████  ░░░░░  ░░░░░  ░░░░░  → Weak    (danger-500)
█████  █████  ░░░░░  ░░░░░  → Medium  (warning-500)
█████  █████  █████  █████  → Strong  (success-500)
```

Segmentos: `rounded-full` · height 4 · gap 4.

### 11.8 Checkbox / Toggle

```
  ✓  Manter conectado
  ↑  rounded-full · w-5 h-5
     checked: bg-primary-400 + check branco (lucide Check 14)
     unchecked: border border-neutral-200
```

---

## 12. Componentes do Domínio Nutricional

> Specs para componentes que **ainda precisam ser construídos**. Implementar conforme as telas exigirem, sempre com os tokens deste documento.

### 12.1 Progress Ring (Macro Ring)

Anel circular SVG (`react-native-svg`) que mostra progresso de um macro.

```
   ╭─────╮
  ╱       ╲
 │  78 g   │   ← centro: valor (font-sans-bold · text-xl · tabular-nums)
 │ protein │   ← label inferior (text-xs · font-sans-medium · neutral-500)
  ╲       ╱
   ╰─────╯
```

Props:
- `value: number` (atual)
- `max: number` (meta)
- `color: 'protein' | 'carbs' | 'fat' | 'calories'`
- `size?: number` (default 80; hero 160)
- `strokeWidth?: number` (default 8; hero 14)
- `label?: string`
- `format?: (v: number) => string` (default: `${v}g`)

Comportamento: animar mudança de `value` com Reanimated, `duration.slow`, easing decelerate.

### 12.2 Macro Bar (alternativa horizontal compacta)

```
Proteína  ━━━━━━━━━━░░░░░░░░░  72 / 120g
                       ↑ track neutral-200, fill protein-500
```

Usar em Meal Card e em listas longas onde o ring ocupa muito espaço.

### 12.3 Meal Card

```
┌────────────────────────────────────────────────┐
│ 🍳 Café da manhã              08:32     ⋯      │ ← head
│ 2 ovos · 1 fatia de pão integral · café        │ ← items (text-base · font-sans-medium · neutral-800)
│ ─────────────────────────────────────────────  │
│ 320 kcal · 22g P · 18g C · 14g G               │ ← macros (text-sm · font-sans · neutral-500 · tabular-nums)
└────────────────────────────────────────────────┘
   Card elevated · p-4
```

Estados especiais:
- `review_required = true` → borda `border-[1.5px] border-warning-500` + chip "Confirmar" no head (tap → modal de edição).
- `source = "wa_audio"` → ícone WhatsApp (lucide `MessageCircle`) ao lado do horário.

### 12.4 Streak Counter

```
   🔥
   7
```
Foguinho (lucide `Flame` · 24 · `streak-400`) + número (`text-2xl` · `font-sans-bold` · `streak-600` · tabular-nums).

Estados:
- Ativo: animação pulse infinita (scale 1 ↔ 1.08, `duration.slower`, easing standard).
- Em risco (< 4h do reset): grayscale + texto `neutral-400`.
- Quebrado: ícone `FlameKindling`, cor `neutral-300`.

### 12.5 Audio Recorder Button

Botão circular grande no centro do FAB. 3 estados:

```
  IDLE              RECORDING (00:08)         PROCESSING
  ┌─────┐           ┌─────────────┐           ┌─────┐
  │  🎙 │           │  ●  00:08   │           │  ⏳ │
  └─────┘           └─────────────┘           └─────┘
  primary-400       danger-500 + pulse        neutral-200 + spinner
  w-16 h-16         w-32 h-16 (expande)       w-16 h-16
```

Hold-to-record (preferido) OU tap-to-toggle, decidido por UX test. Sempre dar feedback haptic (`Haptics.impactAsync(Medium)`).

### 12.6 Chat Bubble

Para preview da conversa de WhatsApp dentro do app.

```
                            ┌──────────────────────────┐
                            │ Comi 2 ovos e um café    │
                            └──────────────────────────┘  ← user (right, bg-primary-400, text white)
┌──────────────────────────┐
│ Anotei! 220 kcal · 14g P │
│ Faltam 80g de proteína.  │
└──────────────────────────┘  ← bot (left, bg-neutral-100, text neutral-800)
```

`rounded-2xl` · max `w-4/5` · `p-3` · `gap-2` entre bubbles.

### 12.7 Bottom Tab Bar

4 tabs: **Home** (`House`), **Adicionar** (`Plus` no centro, maior, destaque), **Amigos** (`Users`), **Perfil** (`User`).

```
┌─────────────────────────────────────────────────┐
│                                                 │ ← height 60 + safe-bottom
│  Home    Amigos   [ + ]   ...   Perfil          │
│   ◯       ◯       ●         ◯                  │
└─────────────────────────────────────────────────┘
   ícone lucide 24 · label text-xs font-sans-medium
   ativa: primary-400 + label visível
   inativa: neutral-400 + label hidden (ou cinza)
```

Tab central `+` é um botão flutuante elevado (eleva 8px acima da barra, `bg-primary-400`, sombra Nível 2).

### 12.8 Bottom Sheet

`@gorhom/bottom-sheet`. Snap points padrão: `["25%", "60%", "90%"]`. Handle 36×4 px `bg-neutral-300`, top center, margem 12px.

Backdrop: `bg-black/40`. Container: `rounded-t-3xl` · `bg-white` · sombra Nível 3.

### 12.9 Number Stepper / Wheel Picker

Onboarding (peso, altura, idade). Wheel picker estilo iOS.

Bibliotecas avaliadas: `react-native-wheel-pick` (mais leve) ou `@react-native-picker/picker` (nativo). Decidir na implementação. Altura 200, item ativo `text-2xl font-sans-bold`, demais `text-lg font-sans neutral-400`.

### 12.10 Empty State

```
        ╭───────╮
        │  🍽   │   ← lucide UtensilsCrossed · 64 · neutral-300
        ╰───────╯
   Nenhuma refeição hoje    ← text-lg · font-sans-bold · neutral-800
   Toque no + para começar  ← text-sm · font-sans · neutral-500
        [   Adicionar   ]   ← Button primary sm (opcional)
```

Centralizado vertical e horizontalmente. `gap-3` entre elementos.

### 12.11 Skeleton Loader

Componentes wrapper:
- `<SkeletonBlock width height />`
- `<SkeletonText lines={n} />`
- `<SkeletonCircle size />`

Base: `bg-neutral-100`. Shimmer: gradiente animado de `neutral-100` para `neutral-200`, Reanimated, loop `duration.slower`.

### 12.12 Toast

Top da tela, abaixo da safe area top (`mt-safe`). Auto-dismiss em 3s. Slide-down + fade.

```
┌───────────────────────────────────────┐
│ ✓  Refeição adicionada                │  ← success: bg-success-500 / text white
└───────────────────────────────────────┘
```

3 variantes: `success` (success-500), `error` (danger-500), `info` (neutral-800). `rounded-2xl · p-4 · text-sm · font-sans-medium`. Sombra Nível 2.

### 12.13 Leaderboard Row

```
┌──────────────────────────────────────────────────┐
│ #2   [avatar]   Maria Silva       🔥 14    ✓ 5  │
└──────────────────────────────────────────────────┘
  Card outlined · p-3
  posição: text-sm · font-sans-bold · neutral-500
  avatar: w-10 h-10 rounded-full
  nome: text-base · font-sans-semibold · neutral-800
  streak: 🔥 + número tabular-nums
  ✓ N: dias com goal_hit na semana
```

Usuário atual: variante `flat` com `bg-primary-50` + indicador "Você" antes do nome.

---

## 13. Referência NativeWind

```tsx
// ✅ Correto — primitivos nativos com className
<View className="flex-1 bg-primary-50 px-5">
  <Text className="text-3xl font-sans-extrabold text-neutral-800">
    Título
  </Text>
  <Text
    className="text-5xl font-sans-bold text-primary-400"
    style={{ fontVariant: ["tabular-nums"] }}
  >
    1.247 kcal
  </Text>
</View>

// ❌ Errado — não usar tags HTML, e nunca font-bold/font-medium/etc.
<div className="...">
  <h1 className="font-bold">Título</h1>
</div>
```

**Convenções de imports:**
```ts
// Tokens em JS quando NativeWind não cobre (SVG, Reanimated)
import { colors } from "@/lib/colors";
import { Motion } from "@/lib/motion";

// Componentes base
import { Button, Input, Card } from "@/components";

// Ícones
import { Flame, Beef, Wheat, Droplet } from "lucide-react-native";
```

---

*v2 (2026-06-22) — doc realinhado à marca real (menta/tinta, Space Grotesk). O código do app ainda está em teal/Plus Jakarta: ver §0 Migração. Style guide visual: `landing-page/public/styleguide.html`.*
