import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { ImageIcon } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { getPostImageSignedUrl } from "@/lib/storage";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

const WORD_SOURCES = new Set<MealResponse["source"]>([
  "app_text",
  "app_audio",
  "wa_text",
  "wa_audio",
]);

type Props = { meal: Pick<MealResponse, "source" | "raw_input" | "image_path" | "items"> };

function MealPhotoThumb({ path }: { path: string | null | undefined }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    if (!path) return undefined;
    getPostImageSignedUrl(path)
      .then((signed) => {
        if (active) setUrl(signed);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (url && !failed) {
    return (
      <Image
        testID="meal-source-photo"
        source={{ uri: url }}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
        className="h-14 w-14 rounded-xl bg-neutral-100"
      />
    );
  }
  return (
    <View
      testID="meal-source-photo-placeholder"
      className="h-14 w-14 items-center justify-center rounded-xl bg-neutral-100"
    >
      <ImageIcon size={22} color={colors.neutral[400]} />
    </View>
  );
}

export function MealSourceCard({ meal }: Props) {
  if (meal.source === "app_photo") {
    const count = meal.items.length;
    return (
      <View style={shadows.card} className="flex-row items-center gap-3 rounded-2xl bg-white p-3">
        <MealPhotoThumb path={meal.image_path} />
        <View className="flex-1 gap-0.5">
          <Text className="font-sans-semibold text-xs uppercase tracking-wide text-neutral-500">
            Foto do prato
          </Text>
          <Text style={NUM} className="font-sans-medium text-sm text-neutral-800">
            {`Identifiquei ${count} ${count === 1 ? "item" : "itens"} na foto`}
          </Text>
        </View>
      </View>
    );
  }

  const words = WORD_SOURCES.has(meal.source) ? meal.raw_input?.trim() : undefined;
  if (!words) return null;
  const spoken = meal.source === "app_audio" || meal.source === "wa_audio";

  return (
    <View style={shadows.card} className="gap-1 rounded-2xl bg-white p-3">
      <Text className="font-sans-semibold text-xs uppercase tracking-wide text-neutral-500">
        {spoken ? "Você disse" : "Você escreveu"}
      </Text>
      <Text numberOfLines={3} className="font-sans-medium text-sm text-neutral-800">
        {`“${words}”`}
      </Text>
    </View>
  );
}
