import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color="#1E293B" />
        </Pressable>
        <Text className="ml-2 text-xl font-sans-bold text-neutral-800">Perfil</Text>
      </View>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-base font-sans-medium text-neutral-500">
          Perfil completo chega no próximo update.
        </Text>
        <Pressable
          onPress={() => supabase.auth.signOut()}
          accessibilityLabel="Sair"
          accessibilityRole="button"
          className="min-h-[44px] items-center justify-center rounded-full border border-neutral-300 px-6 active:bg-neutral-100"
        >
          <Text className="text-sm font-sans-semibold text-neutral-700">Sair</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
