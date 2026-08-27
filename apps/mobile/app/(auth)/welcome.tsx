import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { supabase } from "@/lib/supabase";

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
      <View className="flex-1 justify-between p-12">
        <View className="flex-1 items-center justify-center">
          <Text className="mb-4 text-5xl font-display-bold text-primary-400">Fitbrother</Text>
          <Text className="text-center text-base font-sans text-neutral-600">
            Nutrição com IA. Registre suas refeições em linguagem natural — texto ou áudio.
          </Text>
        </View>

        <View className="gap-3">
          <Button
            label="Criar conta"
            variant="primary"
            rightIcon={<ArrowRight size={18} color="#fff" />}
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
