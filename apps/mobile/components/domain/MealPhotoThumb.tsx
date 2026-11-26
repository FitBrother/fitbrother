import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { ImageIcon } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { getPostImageSignedUrl } from "@/lib/storage";

const PHOTO_PREFIX = "Foto: ";

// Meals created before the photo route stored image_path only carry it in raw_input (same rule as 0082).
export function photoPath(meal: Pick<MealResponse, "raw_input" | "image_path">): string | null {
  if (meal.image_path) return meal.image_path;
  const raw = meal.raw_input;
  if (raw?.startsWith(PHOTO_PREFIX) && raw.length > PHOTO_PREFIX.length) {
    return raw.slice(PHOTO_PREFIX.length);
  }
  return null;
}

const THUMB_SIZE = { md: "h-14 w-14 rounded-xl", lg: "h-[72px] w-[72px] rounded-2xl" };

export function MealPhotoThumb({
  path,
  size = "md",
}: {
  path: string | null | undefined;
  size?: keyof typeof THUMB_SIZE;
}) {
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
        className={`${THUMB_SIZE[size]} bg-neutral-100`}
      />
    );
  }
  return (
    <View
      testID="meal-source-photo-placeholder"
      className={`${THUMB_SIZE[size]} items-center justify-center bg-neutral-100`}
    >
      <ImageIcon size={22} color={colors.neutral[400]} />
    </View>
  );
}
