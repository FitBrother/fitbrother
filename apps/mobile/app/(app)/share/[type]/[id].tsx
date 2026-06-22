import { useRef } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { View as RNView } from "react-native";
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
    const imageUrl = p.image_path
      ? await getPostImageSignedUrl(p.image_path).catch(() => null)
      : null;
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
    } catch {
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
        <Text className="ml-2 text-xl font-display-bold text-white">Compartilhar</Text>
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
