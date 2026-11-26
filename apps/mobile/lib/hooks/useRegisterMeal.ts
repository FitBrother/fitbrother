import { useCallback, useRef } from "react";
import type { ErrorBannerVariant } from "@/components/domain/ErrorBanner";
import { registerErrorKind } from "@/lib/meal-registration-errors";
import { useCreateMealAudio } from "./useCreateMealAudio";
import { useCreateMealPhoto } from "./useCreateMealPhoto";
import { useCreateMealText } from "./useCreateMealText";
import { useOpenMealAfterRegister } from "./useOpenMealAfterRegister";

type TextArgs = Parameters<ReturnType<typeof useCreateMealText>["mutate"]>[0];
type AudioArgs = Parameters<ReturnType<typeof useCreateMealAudio>["mutate"]>[0];
type PhotoArgs = Parameters<ReturnType<typeof useCreateMealPhoto>["mutate"]>[0];

type Options = {
  leaveScreen?: boolean;
  requireActive?: boolean;
  onError: (kind: ErrorBannerVariant) => void;
};

export function useRegisterMeal({ leaveScreen, requireActive, onError }: Options) {
  const openMeal = useOpenMealAfterRegister({ leaveScreen, requireActive });
  const text = useCreateMealText();
  const audio = useCreateMealAudio();
  const photo = useCreateMealPhoto();

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const onSuccess = useCallback((r: { meal: { id: string } }) => openMeal(r.meal), [openMeal]);
  const fail = useCallback((err: Error) => onErrorRef.current(registerErrorKind(err)), []);

  const textMutate = text.mutate;
  const audioMutate = audio.mutate;
  const photoMutate = photo.mutate;

  const submitText = useCallback(
    (args: TextArgs) => textMutate(args, { onSuccess, onError: fail }),
    [textMutate, onSuccess, fail],
  );
  const submitAudio = useCallback(
    (args: AudioArgs) =>
      audioMutate(args, {
        onSuccess,
        onError: (err: Error) => {
          // eslint-disable-next-line no-console
          console.warn("[registerMeal] audio mutation error:", err);
          fail(err);
        },
      }),
    [audioMutate, onSuccess, fail],
  );
  const submitPhoto = useCallback(
    (args: PhotoArgs) => photoMutate(args, { onSuccess, onError: fail }),
    [photoMutate, onSuccess, fail],
  );

  return {
    submitText,
    submitAudio,
    submitPhoto,
    isPending: text.isPending || audio.isPending || photo.isPending,
  };
}
