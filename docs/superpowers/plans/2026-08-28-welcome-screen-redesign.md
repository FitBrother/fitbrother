# Tela de boas-vindas (Welcome) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a Welcome de "logo + frase + botão" por uma introdução com 3 bullets de
valor, CTA "Comece agora", e layout responsivo próprio (uma coluna no mobile, duas em
`lg+`) — em vez de herdar o `md:max-w-[440px]` genérico do grupo `(auth)`.

**Architecture:** `(auth)/_layout.tsx` vira um `<Stack/>` puro (mesmo padrão de
`(onboarding)/_layout.tsx`); `sign-in.tsx` absorve o `max-w-[440px]` que perdeu; a nova
`welcome.tsx` implementa seu próprio layout de duas colunas com Tailwind/NativeWind
(`lg:flex-row`), sem componente compartilhado novo — é a única tela que precisa desse
layout específico.

**Tech Stack:** React Native, Expo Router, NativeWind v4, `lucide-react-native`.

## Global Constraints

- Tipografia: `font-sans`/`font-sans-medium`/`font-sans-semibold`/`font-sans-bold`/
  `font-display-bold` — nunca `font-bold` puro.
- Cores via token de `@/lib/colors` — nunca hex inline em JSX.
- Hit target 44×44pt em `Pressable` (`Button` já garante isso internamente).
- Ícones: `lucide-react-native` apenas.

---

## Task 1: `(auth)/_layout.tsx` — remove o max-width genérico

**Files:**
- Modify: `apps/mobile/app/(auth)/_layout.tsx`

- [ ] **Step 1: Simplificar pra `<Stack/>` puro**

Substituir o arquivo inteiro:
```tsx
import { Stack } from "expo-router";
import { View } from "react-native";
import { colors } from "@/lib/colors";

export default function AuthLayout() {
  return (
    <View className="flex-1 flex-row bg-neutral-100 md:justify-center">
      <View className="w-full flex-1 md:max-w-[440px]">
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.neutral[50] },
          }}
        />
      </View>
    </View>
  );
}
```

Por:
```tsx
import { Stack } from "expo-router";
import { colors } from "@/lib/colors";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.neutral[50] },
      }}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile 2>&1 | grep -E "\(auth\)/_layout|sign-in|welcome"`
Expected: erros em `sign-in.tsx`/`welcome.tsx` NÃO aparecem aqui (mudança de layout não
quebra tipos) — mas visualmente as duas telas ficam sem o max-width até os Tasks 2 e 3.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(auth\)/_layout.tsx
git commit -m "refactor(mobile): (auth)/_layout vira Stack puro, sem max-width genérico"
```

---

## Task 2: `sign-in.tsx` — absorve o max-width que perdeu

**Files:**
- Modify: `apps/mobile/app/(auth)/sign-in.tsx`

- [ ] **Step 1: Adicionar o max-width centralizado na View de conteúdo**

Substituir:
```tsx
        <View className="flex-1 p-5 pt-12">
```

Por:
```tsx
        <View className="w-full flex-1 p-5 pt-12 md:mx-auto md:max-w-[440px]">
```

- [ ] **Step 2: Typecheck e lint**

Run: `npx tsc --noEmit -p apps/mobile 2>&1 | grep sign-in; npx eslint apps/mobile/app/\(auth\)/sign-in.tsx`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(auth\)/sign-in.tsx
git commit -m "fix(mobile): sign-in mantém card centralizado de 440px em md+"
```

---

## Task 3: `welcome.tsx` — reescrita completa

**Files:**
- Modify: `apps/mobile/app/(auth)/welcome.tsx`

**Interfaces:**
- Consumes: `Button` (`@/components/Button`), `colors` (`@/lib/colors`), ícones
  `ArrowRight`/`MessageCircle`/`Zap`/`Flame` de `lucide-react-native`.

- [ ] **Step 1: Reescrever o arquivo inteiro**

```tsx
import { router } from "expo-router";
import { ArrowRight, Flame, MessageCircle, Zap } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";

const BULLETS = [
  { Icon: MessageCircle, label: "Registre em linguagem natural, texto ou áudio" },
  { Icon: Zap, label: "Macros calculados na hora, sem digitar nada" },
  { Icon: Flame, label: "Streaks e conquistas pra manter o ritmo" },
] as const;

export default function Welcome() {
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      router.push("/(onboarding)");
    } catch {
      setStarting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-1 lg:flex-row lg:items-center lg:justify-center">
        <View className="flex-1 justify-center px-8 pt-12 lg:flex-none lg:w-[480px] lg:justify-center lg:px-0 lg:pt-0">
          <Text className="mb-4 text-5xl font-display-bold text-primary-400">Fitbrother</Text>
          <Text className="mb-8 text-lg font-sans text-neutral-600">
            Nutrição com IA que entende como você já fala.
          </Text>
          <View className="gap-4">
            {BULLETS.map(({ Icon, label }) => (
              <View key={label} className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-50">
                  <Icon size={20} color={colors.primary[400]} />
                </View>
                <Text className="flex-1 text-base font-sans text-neutral-700">{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-3 p-8 lg:w-[360px] lg:p-0 lg:pl-16">
          <Button
            label="Comece agora"
            variant="primary"
            rightIcon={<ArrowRight size={18} color={colors.white} />}
            loading={starting}
            onPress={handleStart}
          />
          <Button
            label="Já tenho conta"
            variant="outline"
            onPress={() => router.push("/(auth)/sign-in")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck e lint**

Run: `npx tsc --noEmit -p apps/mobile 2>&1 | grep welcome; npx eslint apps/mobile/app/\(auth\)/welcome.tsx`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(auth\)/welcome.tsx
git commit -m "feat(mobile): Welcome ganha bullets de valor, CTA \"Comece agora\" e layout responsivo em lg+"
```

---

## Task 4: Verificação manual

**Files:** nenhum.

- [ ] **Step 1: Typecheck e lint do workspace inteiro**

Run: `npm run typecheck --workspace apps/mobile && npm run lint`
Expected: PASS.

- [ ] **Step 2: Browser — mobile (375×812)**

Abrir `/`  (redireciona pra Welcome se deslogado). Confirmar: bullets com ícone, botão
"Comece agora" (não mais "Criar conta"), sem scroll, botões visíveis sem rolar.

- [ ] **Step 3: Browser — desktop (1280×800 ou maior)**

Confirmar duas colunas lado a lado, conteúdo centralizado como grupo (não esticado
borda a borda), e que `sign-in.tsx` continua com o card estreito de ~440px centralizado
(sem regressão do Task 2).

- [ ] **Step 4: Fluxo funcional**

Clicar "Comece agora" → confirma sessão anônima criada e navegação pro onboarding
(mesmo comportamento de antes, só a UI mudou). Clicar "Já tenho conta" → vai pro
sign-in.

- [ ] **Step 5: Finalizar**

Seguir superpowers:finishing-a-development-branch.
