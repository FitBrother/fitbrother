import { router } from "expo-router";
import { ArrowRight, Flame, MessageCircle, Zap } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { LogoHomeLink } from "@/components/LogoHomeLink";
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
          <LogoHomeLink height={40} className="mb-4" />
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
