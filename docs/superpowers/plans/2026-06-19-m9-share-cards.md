# M9 — Compartilhamento externo (cards estilo Strava) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans / subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Gerar um card 9:16 (estilo Strava) a partir de um post, insight ou refeição e exportá-lo via share sheet nativo ou salvar na galeria — tudo client-side.

**Architecture:** Um componente `ShareCard` (variantes meal/insight) é renderizado numa tela de preview dentro de um `View` com `ref`; `react-native-view-shot` captura como PNG; `expo-sharing` abre o share sheet e `expo-media-library` salva na galeria. Sem backend/migrations.

**Tech Stack:** Expo Router, react-native-view-shot, expo-sharing, expo-media-library, expo-linear-gradient (já instalado), `@fitbrother/shared`.

**Base:** branch `feat/m9-share-cards` (empilhada em `feat/m8-2-insights` — precisa do `InsightCard`/insights do M8 e do `PostCard` do M7). Verificação: device-only (e2e manual) + `typecheck`/`lint`. **Sem migrations, sem checks SQL.**

---

## File Structure
- `apps/mobile/lib/share-card.ts` — captura + share + save (util).
- `apps/mobile/components/domain/ShareCard.tsx` — card 9:16 (variantes meal/insight).
- `apps/mobile/lib/api/insights.ts` — adiciona `fetchInsight(id)`.
- `apps/mobile/app/(app)/share/[type]/[id].tsx` — tela de preview + exportar/salvar.
- `apps/mobile/components/domain/PostCard.tsx` — botão "Exportar imagem".
- `apps/mobile/components/domain/InsightCard.tsx` — botão "Exportar imagem".
- `apps/mobile/app/(app)/meal/[id]/index.tsx` — botão "Exportar imagem" (distinto do share-to-feed).

---

## Task 1: Instalar dependências nativas

**Files:** `apps/mobile/package.json` (via expo install)

- [ ] **Step 1: Install**

Run (na raiz):
```bash
npm --workspace apps/mobile exec -- npx expo install react-native-view-shot expo-sharing expo-media-library
```
Expected: três pacotes adicionados a `apps/mobile/package.json` com versões compatíveis com o SDK 54.

- [ ] **Step 2: Verify install + typecheck**

Run: `npm install && npm run typecheck`
Expected: PASS (sem "Cannot find module").

> **Dev build:** esses módulos têm código nativo — exigem dev build EAS (o projeto já usa desde M2). Não funcionam no Expo Go.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json package-lock.json
git commit -m "chore(m9): deps view-shot + expo-sharing + expo-media-library"
```

---

## Task 2: Util de captura/saída

**Files:** Create `apps/mobile/lib/share-card.ts`

- [ ] **Step 1: Write the util**

```ts
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import type { RefObject } from "react";
import type { View } from "react-native";

/** Captura a view referenciada como PNG temporário e devolve o uri. */
export async function captureCard(ref: RefObject<View>): Promise<string> {
  if (!ref.current) throw new Error("share_card_ref_missing");
  return captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
}

/** Abre o share sheet nativo com a imagem. */
export async function shareCard(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("sharing_unavailable");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    dialogTitle: "Compartilhar",
    UTI: "public.png",
  });
}

/** Salva na galeria (pede permissão). Lança 'gallery_permission_denied' se negada. */
export async function saveCardToGallery(uri: string): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) throw new Error("gallery_permission_denied");
  await MediaLibrary.saveToLibraryAsync(uri);
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
```bash
git add apps/mobile/lib/share-card.ts
git commit -m "feat(m9): util de captura/compartilhamento/galeria"
```

---

## Task 3: Componente ShareCard

**Files:** Create `apps/mobile/components/domain/ShareCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Leaf } from "lucide-react-native";
import { colors } from "@/lib/colors";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export type ShareCardData =
  | {
      kind: "meal";
      title: string;
      imageUrl: string | null;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    }
  | {
      kind: "insight";
      title: string;
      headline: string;
      bullets: string[];
      score: number | null;
    };

function Watermark() {
  return (
    <View className="flex-row items-center gap-2">
      <Leaf size={28} color={colors.primary[400]} />
      <Text className="text-2xl font-sans-extrabold text-white">Fitbrother</Text>
    </View>
  );
}

/** Quadro 9:16 fixo. A tela de preview o envolve num View com ref p/ captura. */
export function ShareCard({ data }: { data: ShareCardData }) {
  return (
    <View style={{ width: 360, aspectRatio: 9 / 16 }} className="overflow-hidden rounded-3xl">
      <LinearGradient
        colors={[colors.primary[600], colors.primary[400]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        {data.kind === "meal" ? (
          <View className="flex-1">
            {data.imageUrl ? (
              <Image
                source={{ uri: data.imageUrl }}
                accessibilityIgnoresInvertColors
                style={{ width: "100%", height: "55%" }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ height: "20%" }} />
            )}
            <View className="flex-1 justify-between p-7">
              <Text className="text-3xl font-sans-extrabold text-white">{data.title}</Text>
              <View>
                <Text style={NUM} className="text-6xl font-sans-extrabold text-white">
                  {Math.round(data.kcal)}
                </Text>
                <Text className="text-lg font-sans-medium text-white/90">kcal</Text>
                <Text style={NUM} className="mt-3 text-xl font-sans-semibold text-white/90">
                  {Math.round(data.protein_g)}g P · {Math.round(data.carbs_g)}g C ·{" "}
                  {Math.round(data.fat_g)}g G
                </Text>
              </View>
              <Watermark />
            </View>
          </View>
        ) : (
          <View className="flex-1 justify-between p-7">
            <View>
              {data.score !== null ? (
                <Text style={NUM} className="text-7xl font-sans-extrabold text-white">
                  {data.score}
                </Text>
              ) : null}
              <Text className="mt-2 text-3xl font-sans-extrabold text-white">{data.title}</Text>
              <Text className="mt-2 text-xl font-sans-medium text-white/90">{data.headline}</Text>
            </View>
            <View className="gap-2">
              {data.bullets.slice(0, 3).map((b, i) => (
                <Text key={i} className="text-lg font-sans text-white/90">
                  • {b}
                </Text>
              ))}
            </View>
            <Watermark />
          </View>
        )}
      </LinearGradient>
    </View>
  );
}
```
> Cores via `lib/colors` (regra de ouro: sem hex em JSX; SVG/gradiente importam de `lib/colors`). `text-white`/`text-white/90` são utilitários de cor permitidos (não hex).

- [ ] **Step 2: Typecheck + lint + commit**

Run: `npm run typecheck && npm run lint`
```bash
git add apps/mobile/components/domain/ShareCard.tsx
git commit -m "feat(m9): componente ShareCard 9:16 (variantes meal/insight)"
```

---

## Task 4: fetchInsight(id) no api client

**Files:** `apps/mobile/lib/api/insights.ts`

- [ ] **Step 1: Add the fetcher**

Adicionar a `lib/api/insights.ts`:
```ts
import { InsightSchema, InsightsResponseSchema, type Insight } from "@fitbrother/shared";
// ... fetchInsights existente ...

export async function fetchInsight(id: string): Promise<Insight> {
  const res = await authedFetch(`/me/insights/${id}`);
  if (!res.ok) throw new Error(`insight_failed_${res.status}`);
  const body = (await res.json()) as { insight: unknown };
  return InsightSchema.parse(body.insight);
}
```
> Ajustar o import no topo para incluir `InsightSchema` junto de `InsightsResponseSchema`.

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
```bash
git add apps/mobile/lib/api/insights.ts
git commit -m "feat(m9): fetchInsight(id) no api client"
```

---

## Task 5: Tela de preview + exportar/salvar

**Files:** Create `apps/mobile/app/(app)/share/[type]/[id].tsx`

- [ ] **Step 1: Write the screen**

```tsx
import { useRef } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Download, Share2 } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { ShareCard, type ShareCardData } from "@/components/domain/ShareCard";
import { captureCard, saveCardToGallery, shareCard } from "@/lib/share-card";
import { getMeal } from "@/lib/api/meals";
import { fetchPost } from "@/lib/api/posts";
import { fetchInsight } from "@/lib/api/insights";
import { useToast } from "@/lib/toast/toast-context";
import { getPostImageSignedUrl } from "@/lib/storage";
import { colors } from "@/lib/colors";
import type { View as RNView } from "react-native";

async function loadCardData(type: string, id: string): Promise<ShareCardData> {
  if (type === "meal") {
    const m = await getMeal(id);
    return {
      kind: "meal",
      title: m.items[0]?.description ?? "Refeição",
      imageUrl: null,
      kcal: m.total_kcal,
      protein_g: m.total_protein_g,
      carbs_g: m.total_carbs_g,
      fat_g: m.total_fat_g,
    };
  }
  if (type === "post") {
    const p = await fetchPost(id);
    const imageUrl = p.image_path ? await getPostImageSignedUrl(p.image_path).catch(() => null) : null;
    return {
      kind: "meal",
      title: p.caption ?? p.author.display_name ?? "Refeição",
      imageUrl,
      kcal: p.total_kcal,
      protein_g: p.total_protein_g,
      carbs_g: p.total_carbs_g,
      fat_g: p.total_fat_g,
    };
  }
  const ins = await fetchInsight(id);
  return {
    kind: "insight",
    title: ins.payload.title,
    headline: ins.payload.headline,
    bullets: ins.payload.bullets,
    score: ins.payload.score,
  };
}

export default function ShareScreen() {
  const router = useRouter();
  const toast = useToast();
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const cardRef = useRef<RNView>(null);

  const q = useQuery({
    queryKey: ["share-card", type, id],
    queryFn: () => loadCardData(type ?? "", id ?? ""),
    enabled: Boolean(type && id),
  });

  async function onShare() {
    try {
      const uri = await captureCard(cardRef);
      await shareCard(uri);
    } catch (err) {
      toast({ variant: "error", message: "Não foi possível compartilhar a imagem." });
    }
  }

  async function onSave() {
    try {
      const uri = await captureCard(cardRef);
      await saveCardToGallery(uri);
      toast({ variant: "success", message: "Salvo na galeria!" });
    } catch (err) {
      const msg =
        err instanceof Error && err.message === "gallery_permission_denied"
          ? "Permita o acesso às fotos pra salvar."
          : "Não foi possível salvar a imagem.";
      toast({ variant: "error", message: msg });
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-900">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[50]} />
        </Pressable>
        <Text className="ml-2 text-xl font-sans-bold text-white">Compartilhar</Text>
      </View>

      <View className="flex-1 items-center justify-center px-4">
        {q.isLoading ? (
          <ActivityIndicator color={colors.primary[400]} />
        ) : q.data ? (
          <View ref={cardRef} collapsable={false}>
            <ShareCard data={q.data} />
          </View>
        ) : (
          <Text className="font-sans text-white">Não foi possível carregar.</Text>
        )}
      </View>

      <View className="flex-row gap-3 px-4 pb-4">
        <Pressable
          onPress={onSave}
          disabled={!q.data}
          accessibilityRole="button"
          accessibilityLabel="Salvar na galeria"
          className="min-h-[44px] flex-1 flex-row items-center justify-center gap-2 rounded-full bg-neutral-700 disabled:opacity-50"
        >
          <Download size={20} color={colors.neutral[50]} />
          <Text className="font-sans-semibold text-white">Salvar</Text>
        </Pressable>
        <Pressable
          onPress={onShare}
          disabled={!q.data}
          accessibilityRole="button"
          accessibilityLabel="Compartilhar imagem"
          className="min-h-[44px] flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary-400 disabled:opacity-50"
        >
          <Share2 size={20} color={colors.neutral[50]} />
          <Text className="font-sans-semibold text-white">Compartilhar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```
> `getPostImageSignedUrl` já existe (M7.3, em `lib/storage.ts`). `useToast`/variantes confirmados em `lib/toast/toast-context.tsx`.

- [ ] **Step 2: Typecheck + lint + commit**

Run: `npm run typecheck && npm run lint`
```bash
git add "apps/mobile/app/(app)/share/[type]/[id].tsx"
git commit -m "feat(m9): tela de preview + exportar (share sheet) / salvar (galeria)"
```

---

## Task 6: Pontos de entrada (post / insight / refeição)

**Files:** `apps/mobile/components/domain/PostCard.tsx`, `apps/mobile/components/domain/InsightCard.tsx`, `apps/mobile/app/(app)/meal/[id]/index.tsx`

- [ ] **Step 1: PostCard — botão exportar**

No footer do `PostCard` (onde estão Like/Comentário), adicionar um Pressable à direita que navega para a tela de share:
```tsx
        <Pressable
          onPress={() => router.push(`/(app)/share/post/${post.id}` as never)}
          accessibilityRole="button"
          accessibilityLabel="Exportar imagem"
          className="min-h-[44px] min-w-[44px] flex-row items-center justify-center"
        >
          <Share2 size={20} color={colors.neutral[500]} />
        </Pressable>
```
Importar `Share2` de `lucide-react-native` no `PostCard`. (`router` já existe no PostCard via `useRouter`.)

- [ ] **Step 2: InsightCard — botão exportar**

`InsightCard` é display-only; adicionar `useRouter` + um Pressable "Exportar" no canto. No topo:
```tsx
import { useRouter } from "expo-router";
import { Pressable } from "react-native";
import { Share2 } from "lucide-react-native";
import { colors } from "@/lib/colors";
```
E, dentro do card (ao lado do score, no header `flex-row justify-between`), trocar o score por um cluster com score + botão, ou adicionar abaixo do título:
```tsx
      <Pressable
        onPress={() => router.push(`/(app)/share/insight/${insight.id}` as never)}
        accessibilityRole="button"
        accessibilityLabel="Exportar imagem"
        className="mt-3 min-h-[44px] flex-row items-center gap-2 self-start rounded-full bg-neutral-100 px-4"
      >
        <Share2 size={18} color={colors.neutral[700]} />
        <Text className="font-sans-medium text-neutral-700">Exportar imagem</Text>
      </Pressable>
```
(Adicionar `const router = useRouter();` no corpo do componente.)

- [ ] **Step 3: Meal detail — "Exportar imagem" distinto do feed**

Em `meal/[id]/index.tsx`, perto da ação existente "Compartilhar no feed" (o `Share2` atual, que navega pra `post/new`), adicionar uma segunda ação rotulada **"Exportar imagem"** que navega para `share/meal/<id>`:
```tsx
        <Pressable
          onPress={() => router.push(`/(app)/share/meal/${meal.id}` as never)}
          accessibilityRole="button"
          accessibilityLabel="Exportar imagem"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <Download size={20} color={colors.neutral[700]} />
        </Pressable>
```
Importar `Download` de `lucide-react-native`. Garantir que o `Share2` existente fique claramente como "Compartilhar no feed" (a11y label) e o novo como "Exportar imagem".

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`

- [ ] **Step 5: Manual e2e (device)** — de um post, de um insight e de uma refeição: abrir preview → Compartilhar (share sheet abre) → Salvar (pede permissão → "Salvo na galeria").

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/domain/PostCard.tsx apps/mobile/components/domain/InsightCard.tsx "apps/mobile/app/(app)/meal/[id]/index.tsx"
git commit -m "feat(m9): pontos de entrada (post/insight/refeição) para exportar imagem"
```

---

## Verificação final
- [ ] `npm run typecheck && npm run lint` → limpos.
- [ ] e2e manual (device): card 9:16 renderiza com foto/macros (meal/post) e com título/bullets (insight) + marca d'água; Compartilhar abre share sheet; Salvar grava na galeria; permissão negada mostra toast sem quebrar.
- [ ] Atualizar `docs/PLAN.md` §M9 com **Status M9** e marcar **M9 + Fase 2 concluídos**.

**Feito quando:** das 3 origens, o usuário gera um card 9:16 com marca d'água e o compartilha (share sheet) ou salva na galeria; erros/permissões tratados sem quebrar a tela.
