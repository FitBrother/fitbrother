import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ImagePlus, X } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { getMeal } from "@/lib/api/meals";
import { colors } from "@/lib/colors";
import { friendlyApiError } from "@/lib/errors";
import { mealDetailKey } from "@/lib/hooks/useMealsForDay";
import { useCreatePost } from "@/lib/hooks/useCreatePost";
import { pickImage } from "@/lib/media/image-picker";
import { uploadPostImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast/toast-context";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export default function NewPostScreen() {
  const router = useRouter();
  const { meal_id } = useLocalSearchParams<{ meal_id: string }>();
  const [caption, setCaption] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const create = useCreatePost();
  const toast = useToast();

  async function pickPhoto() {
    const uri = await pickImage({ allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (uri) setPhotoUri(uri);
  }
  const mealQuery = useQuery({
    queryKey: mealDetailKey(meal_id ?? ""),
    queryFn: () => getMeal(meal_id!),
    enabled: Boolean(meal_id),
  });

  const meal = mealQuery.data;

  async function publish() {
    if (!meal) return;
    try {
      const postId = randomUUID();
      let imagePath: string | undefined;
      if (photoUri) {
        setUploading(true);
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) throw new Error("not_authenticated");
        const uploaded = await uploadPostImage({ userId, postId, fileUri: photoUri });
        imagePath = uploaded.path;
      }
      create.mutate(
        {
          id: postId,
          meal_id: meal.id,
          caption: caption.trim() || undefined,
          image_path: imagePath,
        },
        {
          onSuccess: () => router.replace("/(app)/feed" as never),
          onError: () => toast({ variant: "error", message: friendlyApiError() }),
        },
      );
    } catch {
      toast({ variant: "error", message: "Não foi possível enviar a foto" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Novo post</Text>
      </View>

      {/* Era um Pressable com onPress={() => Keyboard.dismiss()} — na web,
          Keyboard.dismiss() do react-native-web tira o foco do campo ativo
          (TextInputState.blurTextInput), e o clique dentro do próprio
          TextInput borbulhava pro Pressable pai: focava e perdia o foco no
          mesmo toque, tornando impossível digitar a legenda. Nenhuma outra
          tela do app (nem o MealComposer, o TextInput mais usado) usa esse
          padrão — trocado por View simples, sem a conveniência de fechar o
          teclado tocando fora. */}
      <View className="flex-1 gap-4 px-4 pt-4">
        <TextInput
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={280}
          placeholder="Escreva uma legenda..."
          placeholderTextColor={colors.neutral[400]}
          className="min-h-[112px] rounded-2xl border border-neutral-200 bg-white p-4 text-base font-sans text-neutral-800"
          textAlignVertical="top"
        />

        {photoUri ? (
          <View className="relative">
            <Image
              source={{ uri: photoUri }}
              accessibilityIgnoresInvertColors
              className="h-56 w-full rounded-2xl"
              resizeMode="cover"
            />
            <Pressable
              onPress={() => setPhotoUri(null)}
              accessibilityLabel="Remover foto"
              accessibilityRole="button"
              className="absolute right-2 top-2 h-11 w-11 items-center justify-center rounded-full bg-neutral-800/70"
            >
              <X size={20} color={colors.neutral[50]} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={pickPhoto}
            accessibilityLabel="Adicionar foto"
            accessibilityRole="button"
            className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-4"
          >
            <ImagePlus size={20} color={colors.neutral[500]} />
            <Text className="font-sans-medium text-neutral-600">Adicionar foto (opcional)</Text>
          </Pressable>
        )}

        <View className="rounded-2xl bg-white p-4">
          <Text className="font-sans-semibold text-neutral-800">Snapshot de macros</Text>
          {meal ? (
            <>
              <Text style={NUM} className="mt-3 text-3xl font-display-bold text-neutral-800">
                {Math.round(meal.total_kcal)} kcal
              </Text>
              <Text style={NUM} className="mt-2 text-sm font-sans text-neutral-500">
                {Math.round(meal.total_protein_g)}g P · {Math.round(meal.total_carbs_g)}g C ·{" "}
                {Math.round(meal.total_fat_g)}g G
              </Text>
            </>
          ) : (
            <Text className="mt-3 font-sans text-neutral-500">Carregando refeição...</Text>
          )}
        </View>
      </View>

      <View className="px-4 pb-4">
        <Button
          label="Publicar no feed"
          variant="primary"
          loading={create.isPending || uploading}
          disabled={!meal || create.isPending || uploading}
          onPress={publish}
        />
      </View>
    </SafeAreaView>
  );
}
