# Web Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Fitbrother mobile app usable on tablet/desktop web widths — persistent sidebar nav, centered-card layout for most screens, real multi-column layout for Home/Feed/Histórico.

**Architecture:** Pure NativeWind responsive className additions (`md:`/`lg:` prefixes, Tailwind defaults 768px/1024px) — no new dependency, no native-behavior change below 768px. Three screen tiers: (1) auth/onboarding get a centered 440px card via their shared `_layout.tsx`; (2) most authenticated screens get a centered 640px card via either the shared `AccountScreen` wrapper or a one-line className edit per screen; (3) Home/Feed/Histórico get bespoke wide layouts (sidebar + 2-column dashboard, responsive card grids).

**Tech Stack:** React Native, Expo Router, NativeWind v4/Tailwind v3 (already in the project — see `apps/mobile/tailwind.config.ts`).

## Global Constraints

- Breakpoints: `md` = 768px (tablet), `lg` = 1024px (desktop) — Tailwind defaults, no custom `screens` config.
- Below 768px: zero behavior change. Every task must leave the base (no-prefix) classNames untouched.
- No hex colors inline — use `colors` from `@/lib/colors` or Tailwind color tokens per `apps/mobile/tailwind.config.ts` (project rule, see `CLAUDE.md`).
- `npm run typecheck` (in `apps/mobile/`) and `npm run lint` (repo root) must pass after every task.
- Verify visually via the dev-web server (`npm run web` in `apps/mobile/`) at 375px/768px/1024px/1440px widths before marking a task done.

---

### Task 1: Sidebar component

**Files:**
- Create: `apps/mobile/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `useProfile()` from `@/lib/profile/profile-context` (returns `Profile` with `full_name: string`), `useStreak()` from `@/lib/hooks/useStreak` (returns `{ data?: { streak: { current_streak: number }, atRisk: boolean } }`), `StreakCounter` from `@/components/domain/StreakCounter` (props `{ current: number; atRisk?: boolean }`), `profileInitials(name: string | null, email: string | null): string` from `@/lib/account-utils`, `colors` from `@/lib/colors`.
- Produces: `export function Sidebar()` — a self-contained component with no props, rendered by Task 2. Renders `null`-equivalent (via `hidden`) below 768px.

- [ ] **Step 1: Write the component**

```tsx
import { useRouter, usePathname } from "expo-router";
import { Calendar, Home as HomeIcon, Rss, Search, Sparkles, Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { StreakCounter } from "@/components/domain/StreakCounter";
import { profileInitials } from "@/lib/account-utils";
import { colors } from "@/lib/colors";
import { useStreak } from "@/lib/hooks/useStreak";
import { useProfile } from "@/lib/profile/profile-context";

type NavItem = {
  label: string;
  href: string;
  icon: typeof HomeIcon;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: HomeIcon },
  { label: "Histórico", href: "/(app)/history", icon: Calendar },
  { label: "Feed", href: "/(app)/feed", icon: Rss },
  { label: "Análises", href: "/(app)/insights", icon: Sparkles },
  { label: "Buscar pessoas", href: "/(app)/users/search", icon: Search },
  { label: "Amigos", href: "/(app)/friends", icon: Users },
];

function isActive(pathname: string, href: string): boolean {
  const path = href.replace("/(app)", "") || "/";
  return pathname === path || (path !== "/" && pathname.startsWith(path));
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const profile = useProfile();
  const { data: streakView } = useStreak();

  return (
    <View className="hidden w-[248px] shrink-0 border-r border-neutral-200 bg-white p-4 md:flex">
      <Text className="mb-6 px-2 text-xl font-display-bold text-primary-400">Fitbrother</Text>

      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as never)}
            accessibilityRole="link"
            accessibilityLabel={item.label}
            className={`mb-1 min-h-[44px] flex-row items-center gap-3 rounded-xl px-3 ${
              active ? "bg-primary-50" : ""
            }`}
          >
            <Icon size={20} color={active ? colors.primary[600] : colors.neutral[600]} />
            <Text
              className={`font-sans-medium ${active ? "text-primary-600" : "text-neutral-700"}`}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}

      <View className="flex-1" />

      {streakView ? (
        <View className="mb-3 px-2">
          <StreakCounter current={streakView.streak.current_streak} atRisk={streakView.atRisk} />
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push("/(app)/profile")}
        accessibilityRole="link"
        accessibilityLabel="Perfil"
        className="min-h-[44px] flex-row items-center gap-3 rounded-xl px-2"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-100">
          <Text className="text-xs font-sans-bold text-primary-700">
            {profileInitials(profile.full_name, null)}
          </Text>
        </View>
        <Text className="flex-1 font-sans-medium text-neutral-800" numberOfLines={1}>
          {profile.full_name}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: no errors related to `Sidebar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/layout/Sidebar.tsx
git commit -m "feat(mobile): add desktop sidebar nav component"
```

---

### Task 2: Wire the sidebar into the app shell + hide HomeHeader's icon row at md+

**Files:**
- Modify: `apps/mobile/app/(app)/_layout.tsx`
- Modify: `apps/mobile/components/domain/HomeHeader.tsx`

**Interfaces:**
- Consumes: `Sidebar` from `@/components/layout/Sidebar` (Task 1).

- [ ] **Step 1: Wrap the Stack in a row shell with the sidebar**

In `apps/mobile/app/(app)/_layout.tsx`, add the import and change `GuardedStack`'s final return:

```tsx
import { Sidebar } from "@/components/layout/Sidebar";
```
(add alongside the other `@/` imports at the top)

Replace:
```tsx
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="meal/[id]/edit" options={{ presentation: "modal" }} />
      <Stack.Screen
        name="history/[day]/new"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetCornerRadius: 24,
          contentStyle: { backgroundColor: SHEET_BG },
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
```
with:
```tsx
  return (
    <View className="flex-1 md:flex-row">
      <Sidebar />
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="meal/[id]/edit" options={{ presentation: "modal" }} />
          <Stack.Screen
            name="history/[day]/new"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: "fitToContents",
              sheetCornerRadius: 24,
              contentStyle: { backgroundColor: SHEET_BG },
              gestureEnabled: false,
            }}
          />
        </Stack>
      </View>
    </View>
  );
```

`View` is already imported in this file (used by the loading-state branch above).

- [ ] **Step 2: Hide HomeHeader's icon row at md+**

In `apps/mobile/components/domain/HomeHeader.tsx`, find:
```tsx
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row items-center gap-2"
        className="ml-2 shrink-0"
      >
```
Replace with:
```tsx
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row items-center gap-2"
        className="ml-2 shrink-0 md:hidden"
      >
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd apps/mobile && npm run typecheck && cd .. && npm run lint`
Expected: clean.

- [ ] **Step 4: Visual check**

Start `npm run web` in `apps/mobile/`, log in with a test account, resize the browser to 375px (sidebar hidden, header icons visible — unchanged from before) then to 1024px (sidebar visible on the left, header icons gone, greeting still visible).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/_layout.tsx apps/mobile/components/domain/HomeHeader.tsx
git commit -m "feat(mobile): wire desktop sidebar into app shell, hide header nav icons at md+"
```

---

### Task 3: Centered card for auth and onboarding

**Files:**
- Modify: `apps/mobile/app/(auth)/_layout.tsx`
- Modify: `apps/mobile/app/(onboarding)/_layout.tsx`

- [ ] **Step 1: Auth layout**

Replace the full content of `apps/mobile/app/(auth)/_layout.tsx`:
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

- [ ] **Step 2: Onboarding layout**

Replace the full content of `apps/mobile/app/(onboarding)/_layout.tsx`:
```tsx
import { Stack } from "expo-router";
import { View } from "react-native";
import { colors } from "@/lib/colors";

export default function OnboardingLayout() {
  return (
    <View className="flex-1 flex-row bg-neutral-100 md:justify-center">
      <View className="w-full flex-1 md:max-w-[440px]">
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.neutral[50] },
            gestureEnabled: false,
          }}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd apps/mobile && npm run typecheck && cd .. && npm run lint`

- [ ] **Step 4: Visual check**

At 1440px width, `/welcome` and `/name` (onboarding) should show a centered ~440px-wide card on a slightly darker gutter background, not stretched edge-to-edge. At 375px, identical to before.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(auth\)/_layout.tsx apps/mobile/app/\(onboarding\)/_layout.tsx
git commit -m "feat(mobile): center auth and onboarding screens on wide viewports"
```

---

### Task 4: Centered card for the shared AccountScreen wrapper

**Files:**
- Modify: `apps/mobile/components/account/AccountScreen.tsx`

This single change covers `settings.tsx`, `privacy.tsx`, `delete-account.tsx`, and `about.tsx` (all four already render through `AccountScreen`).

- [ ] **Step 1: Wrap the header + ScrollView in a centered max-width container**

Replace:
```tsx
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[900]} />
        </Pressable>
        <Text className="ml-2 text-xl font-display-bold text-neutral-900">{title}</Text>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10 pt-3"
        keyboardShouldPersistTaps="handled"
      >
        {subtitle ? <Text className="font-sans text-sm text-neutral-600">{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
```
with:
```tsx
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="w-full flex-1 md:mx-auto md:max-w-[640px]">
        <View className="flex-row items-center px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            className="min-h-[44px] min-w-[44px] items-center justify-center"
          >
            <ChevronLeft size={24} color={colors.neutral[900]} />
          </Pressable>
          <Text className="ml-2 text-xl font-display-bold text-neutral-900">{title}</Text>
        </View>
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-5 px-5 pb-10 pt-3"
          keyboardShouldPersistTaps="handled"
        >
          {subtitle ? (
            <Text className="font-sans text-sm text-neutral-600">{subtitle}</Text>
          ) : null}
          {children}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
```

- [ ] **Step 2: Typecheck + lint, then existing unit test**

Run: `cd apps/mobile && npm run typecheck && npx jest components/account/AccountScreen.test.tsx`
Expected: existing test in `AccountScreen.test.tsx` still passes (it doesn't assert on width classes).

- [ ] **Step 3: Visual check**

At 1440px, `/settings`, `/about`, `/privacy`, `/delete-account` all show a centered ~640px column instead of stretching full width, and the sidebar (Task 2) is visible to the left.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/account/AccountScreen.tsx
git commit -m "feat(mobile): center AccountScreen content on wide viewports"
```

---

### Task 5: Centered card for the remaining Tier-2 screens (batch)

**Files (one-line className edit each, root container only):**
- Modify: `apps/mobile/app/(app)/history/[day]/index.tsx`
- Modify: `apps/mobile/app/(app)/history/[day]/new.tsx`
- Modify: `apps/mobile/app/(app)/meal/[id]/index.tsx`
- Modify: `apps/mobile/components/domain/EditMealModal.tsx`
- Modify: `apps/mobile/app/(app)/insights/index.tsx`
- Modify: `apps/mobile/app/(app)/friends.tsx`
- Modify: `apps/mobile/app/(app)/users/search.tsx`
- Modify: `apps/mobile/app/(app)/profile.tsx`
- Modify: `apps/mobile/app/(app)/achievements.tsx`
- Modify: `apps/mobile/app/(app)/scan-confirm.tsx`
- Modify: `apps/mobile/app/(app)/post/[id].tsx`
- Modify: `apps/mobile/app/(app)/post/new.tsx`
- Modify: `apps/mobile/app/(app)/share/[type]/[id].tsx`
- Modify: `apps/mobile/app/account-reactivation.tsx`

`apps/mobile/app/(app)/scan.tsx` is deliberately **excluded** — it's a full-bleed camera viewfinder (`<BarcodeScanner>` with no wrapper), and capping a camera UI to 640px in the middle of a desktop screen would look broken, not better. Leave it full-bleed.

Each step below is find-exact-string-replace on the screen's root container. All 14 follow the same pattern: append `md:mx-auto md:w-full md:max-w-[640px]` to the existing `className`.

- [ ] **Step 1: `history/[day]/index.tsx`**

File: `apps/mobile/app/(app)/history/[day]/index.tsx`
Find: `<SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>`
Replace: `<SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]" edges={["top", "left", "right"]}>`

- [ ] **Step 2: `history/[day]/new.tsx`**

File: `apps/mobile/app/(app)/history/[day]/new.tsx`
Find: `<View className="bg-neutral-50">`
Replace: `<View className="bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">`

- [ ] **Step 3: `meal/[id]/index.tsx`**

File: `apps/mobile/app/(app)/meal/[id]/index.tsx`
Find (the plain one, NOT the two loading/error variants that have extra `items-center justify-center` classes): `<SafeAreaView className="flex-1 bg-neutral-50">`
Replace: `<SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">`

- [ ] **Step 4: `EditMealModal.tsx`**

File: `apps/mobile/components/domain/EditMealModal.tsx`
Find: `<SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>`
Replace: `<SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]" edges={["top", "left", "right"]}>`

- [ ] **Step 5: `insights/index.tsx`**

File: `apps/mobile/app/(app)/insights/index.tsx`
Find: `<SafeAreaView className="flex-1 bg-neutral-50">`
Replace: `<SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">`

- [ ] **Step 6: `friends.tsx`**

File: `apps/mobile/app/(app)/friends.tsx`
Find: `<SafeAreaView className="flex-1 bg-neutral-50">`
Replace: `<SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">`

- [ ] **Step 7: `users/search.tsx`**

File: `apps/mobile/app/(app)/users/search.tsx`
Find: `<SafeAreaView className="flex-1 bg-neutral-50">`
Replace: `<SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">`

- [ ] **Step 8: `profile.tsx`**

File: `apps/mobile/app/(app)/profile.tsx`
Find (the main-content return, NOT the loading/error variants which use `items-center justify-center`): `<SafeAreaView className="flex-1 bg-canvas">`
Replace: `<SafeAreaView className="flex-1 bg-canvas md:mx-auto md:w-full md:max-w-[640px]">`

- [ ] **Step 9: `achievements.tsx`**

File: `apps/mobile/app/(app)/achievements.tsx`
Find: `<SafeAreaView className="flex-1 bg-neutral-50">`
Replace: `<SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">`

- [ ] **Step 10: `scan-confirm.tsx`**

File: `apps/mobile/app/(app)/scan-confirm.tsx`
Find: `<View className="flex-1 bg-neutral-50">`
Replace: `<View className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">`

- [ ] **Step 11: `post/[id].tsx`**

File: `apps/mobile/app/(app)/post/[id].tsx`
Find: `<SafeAreaView className="flex-1 bg-neutral-50">`
Replace: `<SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">`

- [ ] **Step 12: `post/new.tsx`**

File: `apps/mobile/app/(app)/post/new.tsx`
Find: `<SafeAreaView className="flex-1 bg-neutral-50">`
Replace: `<SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">`

- [ ] **Step 13: `share/[type]/[id].tsx`**

File: `apps/mobile/app/(app)/share/[type]/[id].tsx`
Find: `<SafeAreaView className="flex-1 bg-neutral-900">`
Replace: `<SafeAreaView className="flex-1 bg-neutral-900 md:mx-auto md:w-full md:max-w-[640px]">`

- [ ] **Step 14: `account-reactivation.tsx`**

File: `apps/mobile/app/account-reactivation.tsx`
Find: `<SafeAreaView className="flex-1 bg-canvas px-5">`
Replace: `<SafeAreaView className="flex-1 bg-canvas px-5 md:mx-auto md:w-full md:max-w-[640px]">`

- [ ] **Step 15: Typecheck + lint**

Run: `cd apps/mobile && npm run typecheck && cd .. && npm run lint`
Expected: clean.

- [ ] **Step 16: Visual spot-check**

At 1440px: open `/settings` → `/profile` → any meal detail → `/friends` → `/achievements`. Each should render as a centered ~640px column next to the sidebar, not full-bleed. At 375px: pixel-identical to before this task.

- [ ] **Step 17: Commit**

```bash
git add apps/mobile/app/\(app\)/history apps/mobile/app/\(app\)/meal apps/mobile/components/domain/EditMealModal.tsx apps/mobile/app/\(app\)/insights apps/mobile/app/\(app\)/friends.tsx apps/mobile/app/\(app\)/users apps/mobile/app/\(app\)/profile.tsx apps/mobile/app/\(app\)/achievements.tsx apps/mobile/app/\(app\)/scan-confirm.tsx apps/mobile/app/\(app\)/post apps/mobile/app/\(app\)/share apps/mobile/app/account-reactivation.tsx
git commit -m "feat(mobile): center remaining Tier-2 screens on wide viewports"
```

---

### Task 6: Home — two-column dashboard at ≥1024px

**Files:**
- Modify: `apps/mobile/app/(app)/index.tsx`

**Interfaces:**
- Consumes: existing `TodaySummaryHeader`, `MealComposer`, `EmptyMealsState`, `MealCardSwipeable`, `MealCardSkeleton` — no prop changes to any of them.

Below 1024px, this screen must render **exactly** the JSX that exists today (byte-identical) — add a new desktop branch instead of restructuring the existing return.

- [ ] **Step 1: Add `useWindowDimensions` and branch on desktop width**

In `apps/mobile/app/(app)/index.tsx`, change the `react-native` import:
```tsx
import { Keyboard, Platform, Pressable, RefreshControl, useWindowDimensions } from "react-native";
```

Also add `ActivityIndicator` to that same import (needed for the desktop loading state):
```tsx
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
```

Inside `HomeScreen`, right after `const [banner, setBanner] = useState<ErrorBannerVariant | null>(null);`, add:
```tsx
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
```

- [ ] **Step 2: Insert the desktop branch before the existing return**

Immediately before the final `return (` of `HomeScreen` (the one starting with `<SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>`), insert:

```tsx
  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
        <HomeHeader name={profile.full_name} softMode={profile.soft_mode} />
        {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}
        <View className="mx-auto w-full max-w-[1120px] flex-1 flex-row gap-6 px-6">
          <View className="w-[380px] shrink-0 gap-4 pt-4">
            <TodaySummaryHeader summary={summaryQuery.data} softMode={profile.soft_mode} />
            <MealComposer
              onSend={handleSend}
              onAudioReady={handleAudioReady}
              onPhotoPress={handlePhotoPress}
              onScanPress={() => router.push("/(app)/scan" as never)}
              disabled={banner === "quota_exceeded"}
              processing={
                createMeal.isPending || createMealAudio.isPending || createMealPhoto.isPending
              }
            />
          </View>
          <View className="flex-1">
            {mealsQuery.isLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color={colors.primary[400]} />
              </View>
            ) : items.length === 0 ? (
              <EmptyMealsState />
            ) : (
              <FlatList
                data={items}
                keyExtractor={(m) => (m as OptimisticMeal).id}
                renderItem={renderItem as never}
                contentContainerStyle={{ paddingBottom: 40 }}
                itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(180)}
                refreshControl={
                  <RefreshControl
                    refreshing={mealsQuery.isRefetching || summaryQuery.isRefetching}
                    onRefresh={() => {
                      void mealsQuery.refetch();
                      void summaryQuery.refetch();
                    }}
                    tintColor={colors.primary[400]}
                  />
                }
              />
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

```

`FlatList` needs to be imported — add it to the `react-native` import from Step 1 (it isn't imported today because the mobile branch uses `Animated.FlatList`, not the base one). Final import line:
```tsx
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: clean. If `renderItem` or `items` types complain, they're unchanged from the existing mobile branch — the desktop branch reuses the same `renderItem` and `items` values already defined above in the function body.

- [ ] **Step 4: Visual check — both branches**

- At 375px and 900px (below 1024): Home renders identically to before this task (rings scroll with the list, composer overlays the bottom, keyboard-follow animation intact).
- At 1024px+: left column shows rings + composer stacked, right column shows the scrollable meal list, both within a ~1120px-max centered area to the right of the sidebar. Log a meal via the left-column composer and confirm it appears in the right-column list (same `handleSend`/mutation wiring as mobile, just re-rendered in the new layout).

- [ ] **Step 5: Lint**

Run: `npm run lint` (repo root)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/\(app\)/index.tsx
git commit -m "feat(mobile): two-column Home dashboard at desktop widths"
```

---

### Task 7: Feed — responsive card grid at ≥768px

**Files:**
- Modify: `apps/mobile/app/(app)/feed.tsx`

- [ ] **Step 1: Compute column count and wrap in a centered container**

Add the import:
```tsx
import { ActivityIndicator, FlatList, Pressable, Text, useWindowDimensions, View } from "react-native";
```

Inside `FeedScreen`, after `usePostsRealtime(userId);`, add:
```tsx
  const { width } = useWindowDimensions();
  const numColumns = width >= 768 ? 2 : 1;
```

- [ ] **Step 2: Cap the content width and pass `numColumns` to the FlatList**

Replace the `{feed.isLoading ? ... : (<FlatList ... />)}` block:

Find:
```tsx
      {feed.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary[400]} />
        </View>
      ) : (
        <FlatList
          data={feed.data ?? []}
          keyExtractor={(post) => post.id}
          contentContainerClassName="gap-4 px-4 pb-8"
          refreshing={feed.isRefetching}
          onRefresh={() => void feed.refetch()}
          ListEmptyComponent={
            <View className="mt-16 items-center px-6">
              <Text className="text-center text-lg font-sans-bold text-neutral-800">
                Seu feed ainda está vazio
              </Text>
              <Text className="mt-2 text-center text-sm font-sans text-neutral-500">
                Siga pessoas e compartilhe uma refeição para ver posts aqui.
              </Text>
            </View>
          }
          renderItem={({ item }) => <PostCard post={item} />}
        />
      )}
```

Replace with:
```tsx
      {feed.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary[400]} />
        </View>
      ) : (
        <View className="mx-auto w-full flex-1 md:max-w-[900px]">
          <FlatList
            key={numColumns}
            data={feed.data ?? []}
            numColumns={numColumns}
            keyExtractor={(post) => post.id}
            contentContainerClassName="gap-4 px-4 pb-8"
            columnWrapperStyle={numColumns > 1 ? { gap: 16 } : undefined}
            refreshing={feed.isRefetching}
            onRefresh={() => void feed.refetch()}
            ListEmptyComponent={
              <View className="mt-16 items-center px-6">
                <Text className="text-center text-lg font-sans-bold text-neutral-800">
                  Seu feed ainda está vazio
                </Text>
                <Text className="mt-2 text-center text-sm font-sans text-neutral-500">
                  Siga pessoas e compartilhe uma refeição para ver posts aqui.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View className="flex-1">
                <PostCard post={item} />
              </View>
            )}
          />
        </View>
      )}
```

The `key={numColumns}` forces a FlatList remount when the column count changes (React Native requirement — `numColumns` cannot change on a mounted FlatList).

- [ ] **Step 3: Typecheck + lint**

Run: `cd apps/mobile && npm run typecheck && cd .. && npm run lint`

- [ ] **Step 4: Visual check**

At 375px: single column, unchanged. At 768px+: two-column grid of `PostCard`s within a centered ~900px area. Resize the window across the 768px threshold while the feed has posts (seed at least 3 via the demo account from the previous session) and confirm no crash/blank frame on the remount.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/feed.tsx
git commit -m "feat(mobile): responsive 2-column feed grid at md+"
```

---

### Task 8: Histórico — responsive card grid at ≥768px

**Files:**
- Modify: `apps/mobile/app/(app)/history/index.tsx`

- [ ] **Step 1: Compute column count**

Add the import:
```tsx
import { ActivityIndicator, FlatList, Pressable, Text, useWindowDimensions, View } from "react-native";
```

Inside `HistoryScreen`, after `const query = useDailySummaries(today, cutoff);`, add:
```tsx
  const { width } = useWindowDimensions();
  const numColumns = width >= 1280 ? 3 : width >= 768 ? 2 : 1;
```

- [ ] **Step 2: Cap the content width and pass `numColumns`**

Find:
```tsx
        <FlatList
          data={entries}
          keyExtractor={(e) => e.day}
          renderItem={({ item }) =>
            item.type === "filled" ? (
              <HistoryDayCard summary={item.summary} softMode={profile.soft_mode} />
            ) : (
              <HistoryEmptyDayCard day={item.day} />
            )
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color={colors.primary[400]} />
              </View>
            ) : null
          }
        />
```

Replace with:
```tsx
        <View className="mx-auto w-full flex-1 md:max-w-[1100px]">
          <FlatList
            key={numColumns}
            data={entries}
            numColumns={numColumns}
            keyExtractor={(e) => e.day}
            renderItem={({ item }) => (
              <View className="flex-1">
                {item.type === "filled" ? (
                  <HistoryDayCard summary={item.summary} softMode={profile.soft_mode} />
                ) : (
                  <HistoryEmptyDayCard day={item.day} />
                )}
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
            onEndReached={() => {
              if (query.hasNextPage && !query.isFetchingNextPage) {
                void query.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              query.isFetchingNextPage ? (
                <View className="py-4">
                  <ActivityIndicator color={colors.primary[400]} />
                </View>
              ) : null
            }
          />
        </View>
```

No `columnWrapperStyle` gap here — `HistoryDayCard` and `HistoryEmptyDayCard` already carry their own `mx-4 mt-3` self-margins, which double up as inter-column gutters when wrapped two/three per row. Don't touch those two components — adding an explicit gap on top would create uneven spacing.

- [ ] **Step 3: Typecheck + lint**

Run: `cd apps/mobile && npm run typecheck && cd .. && npm run lint`

- [ ] **Step 4: Visual check**

At 375px: single column, unchanged. At 768–1279px: 2 columns. At 1280px+: 3 columns. Confirm tapping any card still navigates to `/history/[day]` (which is Tier-2, centered, from Task 5).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/history/index.tsx
git commit -m "feat(mobile): responsive card grid for Histórico at md+/lg+"
```

---

### Task 9: Full regression pass

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck + lint**

Run: `cd apps/mobile && npm run typecheck && cd .. && npm run lint`
Expected: clean, zero warnings (repo lint runs with `--max-warnings 0`).

- [ ] **Step 2: Resize sweep**

With `npm run web` running and logged into the demo account seeded in the previous session, resize the browser through 375px → 768px → 1024px → 1440px and check, at each width: Home, Feed, Histórico, one meal detail, Profile, Settings, and `/welcome` (auth). Nothing should render broken, overlapping, or with dead sidebar space below 768px.

- [ ] **Step 3: Commit any final fixups**

If Step 2 surfaces a small issue, fix it directly and commit with a `fix(mobile): ...` message referencing the specific screen.
