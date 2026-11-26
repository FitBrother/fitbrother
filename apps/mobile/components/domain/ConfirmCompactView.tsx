import { Text, View } from "react-native";
import { AlertTriangle, Mic } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";
import { drawerLabel, headlineText } from "@/lib/confirm-drawer";
import type { MealConfirmation } from "@/lib/hooks/useMealConfirmation";
import { ConfirmButton, DiscardLink, KcalTotal } from "./ConfirmDrawerActions";
import { MealMetaLine } from "./MealMetaLine";
import { MealPhotoThumb, photoPath } from "./MealPhotoThumb";

const LOW_CONFIDENCE = 0.6;

export function ConfirmCompactView({
  meal,
  confirmation: c,
}: {
  meal: MealResponse;
  confirmation: MealConfirmation;
}) {
  const transcription = meal.source === "app_audio" ? meal.raw_input?.trim() : undefined;
  const uncertain = meal.confidence !== null && meal.confidence < LOW_CONFIDENCE;

  return (
    <View className="gap-3 px-5 pt-1">
      <View className="flex-row gap-3">
        {meal.source === "app_photo" ? <MealPhotoThumb path={photoPath(meal)} size="lg" /> : null}
        <View className="flex-1 gap-1">
          <Text className="font-sans-semibold text-xs uppercase tracking-wide text-neutral-500">
            {drawerLabel(c.items.length)}
          </Text>
          <Text numberOfLines={2} className="font-sans-semibold text-lg text-neutral-900">
            {headlineText(c.items)}
          </Text>
          {transcription ? (
            <View className="flex-row items-center gap-1.5">
              <Mic size={14} color={colors.neutral[400]} />
              <Text numberOfLines={1} className="flex-1 font-sans text-sm text-neutral-500">
                {`“${transcription}”`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <MealMetaLine
          mealType={c.mealType}
          consumedAt={c.consumedAt}
          onChangeMealType={c.setMealType}
          onChangeTime={c.setConsumedAt}
          disabled={c.busy}
        />
        <KcalTotal kcal={c.totals.kcal} size="lg" />
      </View>

      {uncertain ? (
        <View accessibilityRole="alert" className="flex-row items-center gap-2">
          <AlertTriangle size={16} color={colors.warning[700]} />
          <Text className="flex-1 font-sans-medium text-sm text-warning-700">
            Não tive certeza das quantidades.
          </Text>
        </View>
      ) : null}

      <View className="flex-row gap-3">
        <Button
          label="Ajustar"
          variant="outline"
          accessibilityRole="button"
          accessibilityState={{ disabled: c.busy }}
          onPress={c.adjust}
          disabled={c.busy}
          className="flex-1"
        />
        <ConfirmButton
          sending={c.sending}
          disabled={c.busy}
          onPress={c.confirm}
          className="flex-[1.4]"
        />
      </View>
      <DiscardLink disabled={c.busy} onPress={c.discard} />
    </View>
  );
}
