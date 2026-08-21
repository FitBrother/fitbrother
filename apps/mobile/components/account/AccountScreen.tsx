import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";

export function AccountScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const router = useRouter();
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
          {subtitle ? <Text className="font-sans text-sm text-neutral-600">{subtitle}</Text> : null}
          {children}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export function AccountCard({ children }: { children: ReactNode }) {
  return <View className="rounded-2xl border border-neutral-200 bg-white p-4">{children}</View>;
}
