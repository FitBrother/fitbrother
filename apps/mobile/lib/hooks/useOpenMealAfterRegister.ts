import { useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

export function mealRoute(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { pathname: "/(app)/meal/[id]" as any, params: { id } };
}

export function useOpenMealAfterRegister(mode: "push" | "replace" = "push") {
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
      if (!focused.current || AppState.currentState !== "active") return;
      router[mode](mealRoute(meal.id));
    },
    [router, mode],
  );
}
