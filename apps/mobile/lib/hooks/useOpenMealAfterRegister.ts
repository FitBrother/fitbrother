import { useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { mealRoute } from "@/lib/meal-route";

type Options = { requireActive?: boolean };

export function useOpenMealAfterRegister(
  mode: "push" | "replace" = "push",
  { requireActive = true }: Options = {},
) {
  const router = useRouter();
  const focused = useRef(false);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );

  return useCallback(
    (meal: { id: string }) => {
      if (!focused.current) return;
      if (requireActive && AppState.currentState !== "active") return;
      router[mode](mealRoute(meal.id));
    },
    [router, mode, requireActive],
  );
}
