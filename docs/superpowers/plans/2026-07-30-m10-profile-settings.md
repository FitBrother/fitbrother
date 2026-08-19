# M10 — Perfil completo + menus internos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `profile.tsx` deixa de ser placeholder — mostra dados reais do usuário, concentra os atalhos de menu, e ganha uma seção de Configurações (preferências, consentimento LGPD, exportar/excluir conta, Sobre).

**Architecture:** Cliente HTTP novo (`lib/api/account.ts`) espelhando `lib/api/me.ts`, consumindo o contrato já pronto de `apps/server/src/routes/account.ts` (M6) sem nenhum schema novo. Hook de dados (`useAccountProfile`) separado de `useProfile()` porque os shapes divergem. Três telas novas sob `app/(app)/settings/`.

**Tech Stack:** Expo Router, TanStack Query, Zod (schemas já existentes em `@fitbrother/shared`), `expo-sharing` (já dependência), `expo-file-system` (nova).

## Global Constraints

- Tipografia: `font-sans`/`font-sans-medium`/`font-sans-semibold`/`font-sans-bold` — nunca `font-medium`/`font-semibold`/`font-bold`.
- Números com `style={{ fontVariant: ["tabular-nums"] }}` (não há números nesta fatia além da versão do app, que é string).
- Cores só via `@/lib/colors` — nunca hex inline em JSX.
- Hit target mínimo 44×44 pt em todo `Pressable`.
- `accessibilityLabel` obrigatório em botões só-ícone; `accessibilityRole` em interativos.
- Sem `dark:`. Ícones só `lucide-react-native`. Sem `<div>`/`<h1>`.
- Sem edição de nome/avatar/username nesta fatia (fora de escopo, sem endpoint).

---

## Task 1: `Button.tsx` — variante `danger`

**Files:**
- Modify: `apps/mobile/components/Button.tsx`

**Interfaces:**
- Produces: `variant="danger"` em `<Button>`, consumido pela Task 6 (botão "Excluir conta").

- [ ] **Step 1: Adicionar `"danger"` ao union type e aos 3 mapas de estilo**

```tsx
type ButtonVariant = "primary" | "dark" | "outline" | "ghost" | "danger";
```

```tsx
const containerStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary-400 border-transparent active:bg-primary-500",
  dark: "bg-neutral-900 border-transparent active:bg-neutral-700",
  outline: "bg-transparent border border-neutral-200 active:bg-neutral-100",
  ghost: "bg-transparent border-transparent active:bg-neutral-100",
  danger: "bg-danger-500 border-transparent active:bg-danger-600",
};

const containerDisabledStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary-200 border-transparent",
  dark: "bg-neutral-400 border-transparent",
  outline: "bg-transparent border border-neutral-200 opacity-50",
  ghost: "bg-transparent border-transparent opacity-50",
  danger: "bg-danger-500 border-transparent opacity-50",
};

const labelStyles: Record<ButtonVariant, string> = {
  primary: "text-white",
  dark: "text-white",
  outline: "text-neutral-800",
  ghost: "text-primary-400",
  danger: "text-white",
};
```

Na renderização do `ActivityIndicator`, `danger` deve cair no branch `"#ffffff"` (já é o default — só `outline`/`ghost` usam `colors.primary[400]`, `danger` não precisa de mudança ali).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/Button.tsx
git commit -m "feat(mobile): variante danger no Button (M10)"
```

---

## Task 2: `lib/constants.ts` — URLs de Termos/Privacidade

**Files:**
- Modify: `apps/mobile/lib/constants.ts`

**Interfaces:**
- Produces: `TERMS_URL`, `PRIVACY_URL` — consumidos pela Task 7 (`settings/about.tsx`).

- [ ] **Step 1: Adicionar as constantes**

```ts
/** Placeholder até existir uma URL publicada de verdade (item de Ops do M6,
    docs/PLAN.md "Política de Privacidade + Termos publicados em URL fixa").
    Trocar antes do lançamento — ver docs/runbook.md. */
export const TERMS_URL = "https://fitbrother.app/termos";
export const PRIVACY_URL = "https://fitbrother.app/privacidade";
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/constants.ts
git commit -m "feat(mobile): placeholder de URLs de Termos/Privacidade (M10)"
```

---

## Task 3: Cliente API + hooks — `lib/api/account.ts`

**Files:**
- Create: `apps/mobile/lib/api/account.ts`
- Create: `apps/mobile/lib/hooks/useAccountProfile.ts`
- Create: `apps/mobile/lib/hooks/usePatchAccountSettings.ts`
- Create: `apps/mobile/lib/hooks/usePostAccountConsent.ts`
- Create: `apps/mobile/lib/hooks/useDeleteAccount.ts`

**Interfaces:**
- Consumes: `authedFetch` (`@/lib/api`), schemas de `@fitbrother/shared`
  (`AccountProfileResponseSchema`, `PatchAccountSettingsRequestSchema`,
  `AccountSettingsResponseSchema`, `PostAccountConsentRequestSchema`,
  `AccountConsentResponseSchema`, `DeleteAccountRequestSchema`,
  `DeleteAccountResponseSchema`, e os tipos correspondentes).
- Produces: `getAccountProfile`, `patchAccountSettings`,
  `postAccountConsent`, `getAccountExport`, `deleteAccount` (funções);
  `useAccountProfile`, `usePatchAccountSettings`, `usePostAccountConsent`,
  `useDeleteAccount` (hooks) — consumidos pelas Tasks 4, 5, 6.

- [ ] **Step 1: `lib/api/account.ts`**

```ts
import {
  AccountConsentResponseSchema,
  AccountProfileResponseSchema,
  AccountSettingsResponseSchema,
  DeleteAccountResponseSchema,
  type AccountConsentResponse,
  type AccountProfileResponse,
  type AccountSettingsResponse,
  type DeleteAccountResponse,
  type PatchAccountSettingsRequest,
  type PostAccountConsentRequest,
} from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";

type ApiError = Error & { status?: number };

async function parseOrThrow(res: Response): Promise<unknown> {
  if (res.ok) return res.json();
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const err: ApiError = new Error(body.error ?? `request_failed_${res.status}`);
  err.status = res.status;
  throw err;
}

export async function getAccountProfile(): Promise<AccountProfileResponse> {
  const res = await authedFetch("/account/profile");
  const body = await parseOrThrow(res);
  return AccountProfileResponseSchema.parse(body);
}

export async function patchAccountSettings(
  body: PatchAccountSettingsRequest,
): Promise<AccountSettingsResponse> {
  const res = await authedFetch("/account/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const parsed = await parseOrThrow(res);
  return AccountSettingsResponseSchema.parse(parsed);
}

export async function postAccountConsent(
  body: PostAccountConsentRequest,
): Promise<AccountConsentResponse> {
  const res = await authedFetch("/account/consent", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const parsed = await parseOrThrow(res);
  return AccountConsentResponseSchema.parse(parsed);
}

/** Stream cru do ZIP — sem parse, o caller decide como consumir. */
export async function getAccountExport(): Promise<Response> {
  const res = await authedFetch("/account/export");
  if (!res.ok) {
    const err: ApiError = new Error(`account_export_failed_${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

export async function deleteAccount(): Promise<DeleteAccountResponse> {
  const res = await authedFetch("/account", {
    method: "DELETE",
    body: JSON.stringify({ confirm: true }),
  });
  const parsed = await parseOrThrow(res);
  return DeleteAccountResponseSchema.parse(parsed);
}
```

- [ ] **Step 2: `lib/hooks/useAccountProfile.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { getAccountProfile } from "@/lib/api/account";

export const ACCOUNT_PROFILE_KEY = ["account-profile"];

export function useAccountProfile() {
  return useQuery({
    queryKey: ACCOUNT_PROFILE_KEY,
    queryFn: getAccountProfile,
  });
}
```

- [ ] **Step 3: `lib/hooks/usePatchAccountSettings.ts`**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchAccountSettings } from "@/lib/api/account";
import { ACCOUNT_PROFILE_KEY } from "./useAccountProfile";

export function usePatchAccountSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: patchAccountSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ACCOUNT_PROFILE_KEY }),
  });
}
```

- [ ] **Step 4: `lib/hooks/usePostAccountConsent.ts`**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postAccountConsent } from "@/lib/api/account";
import { ACCOUNT_PROFILE_KEY } from "./useAccountProfile";

export function usePostAccountConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAccountConsent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ACCOUNT_PROFILE_KEY }),
  });
}
```

- [ ] **Step 5: `lib/hooks/useDeleteAccount.ts`**

```ts
import { useMutation } from "@tanstack/react-query";
import { deleteAccount } from "@/lib/api/account";

export function useDeleteAccount() {
  return useMutation({ mutationFn: deleteAccount });
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib/api/account.ts apps/mobile/lib/hooks/useAccountProfile.ts apps/mobile/lib/hooks/usePatchAccountSettings.ts apps/mobile/lib/hooks/usePostAccountConsent.ts apps/mobile/lib/hooks/useDeleteAccount.ts
git commit -m "feat(mobile): cliente HTTP + hooks de account (M10)"
```

---

## Task 4: `profile.tsx` — reescrita completa

**Files:**
- Modify: `apps/mobile/app/(app)/profile.tsx`

**Interfaces:**
- Consumes: `useAccountProfile` (Task 3).

**Reference:** conteúdo atual completo (49 linhas) — header com back+título,
uma linha de atalho pra Achievements, texto placeholder, botão Sair. Este
task substitui tudo exceto o padrão de header (`SafeAreaView` +
`ChevronLeft`/`router.back()`) e o botão Sair (`supabase.auth.signOut()`),
que permanecem.

- [ ] **Step 1: Reescrever o arquivo**

```tsx
import { useState, useEffect } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Settings, UserCircle2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/colors";
import { useAccountProfile } from "@/lib/hooks/useAccountProfile";

const SHORTCUTS = [
  { label: "Conquistas", href: "/(app)/achievements" },
  { label: "Amigos", href: "/(app)/friends" },
  { label: "Análises", href: "/(app)/insights" },
  { label: "Histórico", href: "/(app)/history" },
  { label: "Configurações", href: "/(app)/settings" },
] as const;

function useAvatarSignedUrl(avatarPath: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!avatarPath) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from("post-images")
      .createSignedUrl(avatarPath, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [avatarPath]);

  return url;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { data, isLoading } = useAccountProfile();
  const avatarUrl = useAvatarSignedUrl(data?.profile.avatar_url ?? null);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Perfil</Text>
      </View>

      {isLoading || !data ? (
        <ActivityIndicator className="mt-10" color={colors.primary[400]} />
      ) : (
        <ScrollView contentContainerClassName="px-5 pb-10 gap-6">
          <View className="items-center gap-3 pt-4">
            <View className="h-28 w-28 items-center justify-center rounded-full border border-neutral-200 bg-white">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} className="h-28 w-28 rounded-full" />
              ) : (
                <UserCircle2 size={56} color={colors.neutral[400]} />
              )}
            </View>
            <View className="items-center">
              <Text className="text-xl font-display-bold text-neutral-800">
                {data.profile.full_name}
              </Text>
              {data.profile.username && (
                <Text className="font-sans text-neutral-500">@{data.profile.username}</Text>
              )}
            </View>
          </View>

          <View className="gap-3">
            {SHORTCUTS.map((s) => (
              <Pressable
                key={s.href}
                onPress={() => router.push(s.href as never)}
                accessibilityRole="button"
                accessibilityLabel={s.label}
                className="min-h-[44px] flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <Text className="font-sans-medium text-base text-neutral-800">{s.label}</Text>
                <ChevronRight size={20} color={colors.neutral[400]} />
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => void supabase.auth.signOut()}
            accessibilityRole="button"
            accessibilityLabel="Sair"
            className="min-h-[44px] items-center justify-center rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <Text className="text-sm font-sans-semibold text-neutral-700">Sair</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
```

`Settings` (o ícone importado de `lucide-react-native`) não é usado no JSX
acima — remova esse import se o linter acusar `no-unused-vars` (o atalho
"Configurações" usa só texto, sem ícone dedicado, igual aos outros 4).

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/profile.tsx
git commit -m "feat(mobile): profile.tsx real — dados do usuário + atalhos (M10)"
```

---

## Task 5: `HomeHeader.tsx` — remove os 3 ícones que migraram pro Perfil

**Files:**
- Modify: `apps/mobile/components/domain/HomeHeader.tsx`

- [ ] **Step 1: Remover os botões `Calendar`/`Sparkles`/`Users` e seus imports**

Remova os 3 blocos `<Pressable>` (history/insights/friends) e ajuste o
import de ícones pra `import { Rss, Search, User } from "lucide-react-native";`.
Mantém `Rss` (feed), `Search` (buscar pessoas) e `User` (profile) — nessa
ordem, sem mudar a posição relativa dos que ficam.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/HomeHeader.tsx
git commit -m "feat(mobile): remove atalhos de history/insights/friends do header (M10)"
```

---

## Task 6: `settings/index.tsx` — Preferências + Consentimentos

**Files:**
- Create: `apps/mobile/app/(app)/settings/index.tsx`

**Interfaces:**
- Consumes: `useAccountProfile`, `usePatchAccountSettings`,
  `usePostAccountConsent` (Task 3), `clampHour` (`@/lib/masks`, já existe).

- [ ] **Step 1: Implementar**

```tsx
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { ConsentScope } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { Input } from "@/components/Input";
import { clampHour } from "@/lib/masks";
import { useAccountProfile } from "@/lib/hooks/useAccountProfile";
import { usePatchAccountSettings } from "@/lib/hooks/usePatchAccountSettings";
import { usePostAccountConsent } from "@/lib/hooks/usePostAccountConsent";

const FIXED_SCOPES: ConsentScope[] = ["terms", "privacy", "ai_processing"];
const TOGGLEABLE_SCOPES: ConsentScope[] = ["marketing", "data_export"];
const SCOPE_LABELS: Record<ConsentScope, string> = {
  terms: "Termos de uso",
  privacy: "Política de privacidade",
  ai_processing: "Processamento de dados por IA",
  marketing: "Comunicações de marketing",
  data_export: "Permitir exportação de dados",
};

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const { data, isLoading } = useAccountProfile();
  const patchSettings = usePatchAccountSettings();
  const postConsent = usePostAccountConsent();
  const [dayStartHour, setDayStartHour] = useState<string | null>(null);

  const currentDayStartHour = dayStartHour ?? String(data?.profile.day_start_hour ?? 0);

  function saveDayStartHour() {
    patchSettings.mutate({ day_start_hour: clampHour(currentDayStartHour) });
  }

  function redetectTimezone() {
    patchSettings.mutate({ timezone: detectTimezone() });
  }

  function toggleConsent(scope: ConsentScope, granted: boolean) {
    postConsent.mutate({ scope, granted, policy_version: "v1.0" });
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Configurações</Text>
      </View>

      {isLoading || !data ? (
        <ActivityIndicator className="mt-10" color={colors.primary[400]} />
      ) : (
        <ScrollView contentContainerClassName="px-5 pb-10 gap-6">
          <View className="gap-3">
            <Text className="font-sans-semibold text-sm text-neutral-500">Preferências</Text>
            <Input
              label="A que horas seu dia nutricional vira? (0-23)"
              value={currentDayStartHour}
              onChangeText={(v) => setDayStartHour(String(clampHour(v)))}
              onBlur={saveDayStartHour}
              keyboardType="number-pad"
              maxLength={2}
            />
            <View className="rounded-xl border border-neutral-200 bg-white p-4">
              <Text className="text-sm font-sans-medium text-neutral-700">Fuso horário</Text>
              <Text className="mt-1 text-base font-sans text-neutral-800">
                {data.profile.timezone}
              </Text>
              <Pressable onPress={redetectTimezone} accessibilityRole="button">
                <Text className="mt-2 text-sm font-sans-medium text-primary-500">
                  Detectar novamente
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="gap-3">
            <Text className="font-sans-semibold text-sm text-neutral-500">Consentimentos</Text>
            {FIXED_SCOPES.map((scope) => (
              <View
                key={scope}
                className="min-h-[52px] flex-row items-center justify-between rounded-xl border border-neutral-200 bg-neutral-100 p-3"
              >
                <Text className="flex-1 text-sm font-sans text-neutral-600">
                  {SCOPE_LABELS[scope]}
                </Text>
                <Text className="text-xs font-sans-medium text-neutral-500">
                  Concedido — obrigatório
                </Text>
              </View>
            ))}
            {TOGGLEABLE_SCOPES.map((scope) => (
              <View
                key={scope}
                className="min-h-[52px] flex-row items-center justify-between rounded-xl border border-neutral-200 bg-white p-3"
              >
                <Text className="flex-1 text-sm font-sans text-neutral-800">
                  {SCOPE_LABELS[scope]}
                </Text>
                <Switch
                  value={data.consents[scope]?.granted ?? false}
                  onValueChange={(v) => toggleConsent(scope, v)}
                  accessibilityLabel={SCOPE_LABELS[scope]}
                />
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => router.push("/(app)/settings/privacy" as never)}
            accessibilityRole="button"
            accessibilityLabel="Dados e privacidade"
            className="min-h-[44px] flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <Text className="font-sans-medium text-base text-neutral-800">
              Dados e privacidade
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(app)/settings/about" as never)}
            accessibilityRole="button"
            accessibilityLabel="Sobre"
            className="min-h-[44px] flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <Text className="font-sans-medium text-base text-neutral-800">Sobre</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/settings/index.tsx"
git commit -m "feat(mobile): tela de configurações — preferências + consentimentos (M10)"
```

---

## Task 7: `settings/privacy.tsx` — Exportar dados + Excluir conta

**Files:**
- Create: `apps/mobile/app/(app)/settings/privacy.tsx`

**Interfaces:**
- Consumes: `getAccountExport`, `useDeleteAccount` (Task 3), `Button`
  variante `danger` (Task 1).

- [ ] **Step 1: Instalar `expo-file-system`**

Run: `npx expo install expo-file-system` (rodar de dentro de `apps/mobile/`)
Expected: adiciona a dependência ao `apps/mobile/package.json` na versão
compatível com o SDK do projeto (o comando resolve a versão certa
automaticamente — não fixar manualmente).

- [ ] **Step 2: Implementar**

```tsx
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/colors";
import { Button } from "@/components/Button";
import { getAccountExport } from "@/lib/api/account";
import { useDeleteAccount } from "@/lib/hooks/useDeleteAccount";
import { apiBaseUrl } from "@/lib/dev-host";

export default function PrivacyScreen() {
  const router = useRouter();
  const deleteAccount = useDeleteAccount();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      // Confirma que o endpoint responde OK antes de baixar (reaproveita a
      // mesma lógica de auth/erro de getAccountExport), depois usa
      // downloadAsync direto pra não duplicar a leitura do stream em memória.
      await getAccountExport();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("not_authenticated");

      const dest = `${FileSystem.cacheDirectory}fitbrother-dados.zip`;
      const result = await FileSystem.downloadAsync(`${apiBaseUrl()}/account/export`, dest, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (result.status !== 200) throw new Error(`account_export_failed_${result.status}`);

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("sharing_unavailable");
      }
      await Sharing.shareAsync(result.uri, {
        mimeType: "application/zip",
        dialogTitle: "Exportar meus dados",
      });
    } catch (err) {
      Alert.alert(
        "Não foi possível exportar",
        err instanceof Error ? err.message : "Tente novamente em instantes.",
      );
    } finally {
      setExporting(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      "Excluir conta?",
      "Sua conta será desativada e vai sumir das telas sociais. Você pode reativar fazendo login de novo dentro do prazo — depois disso, os dados são apagados de vez.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir conta",
          style: "destructive",
          onPress: () => {
            deleteAccount.mutate(undefined, {
              onSuccess: async () => {
                await supabase.auth.signOut();
                router.replace("/(auth)/welcome" as never);
              },
              onError: (err) =>
                Alert.alert("Não foi possível excluir", err.message),
            });
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">
          Dados e privacidade
        </Text>
      </View>

      <View className="gap-4 px-5 pt-4">
        <Button
          label="Exportar meus dados"
          variant="outline"
          loading={exporting}
          onPress={() => void handleExport()}
        />
        {exporting && <ActivityIndicator color={colors.primary[400]} />}
        <Button
          label="Excluir conta"
          variant="danger"
          loading={deleteAccount.isPending}
          onPress={handleDelete}
        />
      </View>
    </SafeAreaView>
  );
}
```

`getAccountExport()` é chamado só pra validar auth/erro antes do download
via `FileSystem.downloadAsync` (que não passa pelo `authedFetch`, então
não herda o tratamento de 401/timeout — por isso a checagem prévia).
Confira `apps/mobile/lib/dev-host.ts` pra confirmar que `apiBaseUrl()` é
exportado com esse nome exato antes de finalizar este passo.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(app)/settings/privacy.tsx" apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "feat(mobile): exportar dados (download+share) e excluir conta (M10)"
```

---

## Task 8: `settings/about.tsx`

**Files:**
- Create: `apps/mobile/app/(app)/settings/about.tsx`

**Interfaces:**
- Consumes: `TERMS_URL`, `PRIVACY_URL` (Task 2).

- [ ] **Step 1: Implementar**

```tsx
import { Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { colors } from "@/lib/colors";
import { PRIVACY_URL, TERMS_URL } from "@/lib/constants";

export default function AboutScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? "—";

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Sobre</Text>
      </View>

      <View className="gap-4 px-5 pt-4">
        <Text className="font-sans text-neutral-600">Fitbrother — versão {version}</Text>
        <Pressable
          onPress={() => void Linking.openURL(TERMS_URL)}
          accessibilityRole="link"
          className="min-h-[44px] justify-center"
        >
          <Text className="font-sans-medium text-primary-500">Termos de uso</Text>
        </Pressable>
        <Pressable
          onPress={() => void Linking.openURL(PRIVACY_URL)}
          accessibilityRole="link"
          className="min-h-[44px] justify-center"
        >
          <Text className="font-sans-medium text-primary-500">Política de privacidade</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/settings/about.tsx"
git commit -m "feat(mobile): tela Sobre — versão + links de Termos/Privacidade (M10)"
```

---

## Task 9: Verificação final + status no `PLAN.md`

**Files:**
- Modify: `docs/PLAN.md`

- [ ] **Step 1: Typecheck + lint do monorepo inteiro**

Run: `npm run typecheck && npm run lint`
Expected: 0 erros, 0 warnings.

- [ ] **Step 2: Walkthrough manual via Expo**

Suba `npm run dev:mobile` (ou o preview do harness), logue com um usuário
existente e confirme:
- Perfil carrega nome/username/avatar reais (ou fallback se sem avatar).
- HomeHeader não mostra mais os ícones de Calendar/Sparkles/Users.
- Os 5 atalhos do Perfil levam pras telas certas.
- Editar `day_start_hour` e clicar "Detectar novamente" no fuso horário
  persistem (sair e voltar da tela confirma).
- Toggle de `marketing`/`data_export` liga/desliga e persiste.
- "Exportar meus dados" baixa e abre o share sheet com um ZIP de verdade.
- "Excluir conta" mostra o alert, confirma, desloga; logar de novo com a
  mesma conta faz ela reaparecer (janela de reativação do M6, testada
  ponta a ponta pela primeira vez nesta sessão).
- Tela Sobre mostra a versão e os 2 links abrem o navegador.

- [ ] **Step 3: Atualizar `docs/PLAN.md`**

Marcar M10 como concluído na seção Fase 3, mesmo formato dos milestones
anteriores.

- [ ] **Step 4: Commit**

```bash
git add docs/PLAN.md
git commit -m "docs: marca M10 (perfil completo + menus internos) como concluído"
```

---

## Self-Review

**Cobertura do spec:** §1 (estrutura/navegação) → Tasks 4, 5. §2 (fonte de
dados/avatar) → Tasks 3, 4. §3 (profile.tsx) → Task 4. §4 (settings —
preferências/consentimento) → Task 6. §5 (privacy — exportar/excluir) →
Tasks 1, 7. §6 (about) → Tasks 2, 8. §7 (cliente API) → Task 3. §8
(verificação) → Task 9.

**Placeholder scan:** sem TBD/TODO. `TERMS_URL`/`PRIVACY_URL` (Task 2) são
deliberadamente placeholder por decisão do brainstorm, marcados como tal
no comentário do código — não é um placeholder de plano, é a especificação.

**Consistência de tipos:** `useAccountProfile`/`usePatchAccountSettings`/
`usePostAccountConsent`/`useDeleteAccount` (Task 3) usados com os mesmos
nomes exatos nas Tasks 4, 6, 7. `ACCOUNT_PROFILE_KEY` exportado na Task 3
e importado idêntico nas Tasks 6-7 (via os hooks de mutation, não direto).
`Button` variante `"danger"` (Task 1) usada exatamente assim na Task 7.
