import { useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useConfirmMealSheet } from "@/lib/confirm-meal/confirm-meal-context";
import { Motion } from "@/lib/motion";
import { backOrHome } from "@/lib/navigation";

// A native formSheet covers the overlay drawer, so the drawer waits for its dismiss animation.
export const SHEET_DISMISS_MS = Motion.duration.slow;

type Options = { requireActive?: boolean; leaveScreen?: boolean };

export function useOpenMealAfterRegister({
  requireActive = true,
  leaveScreen = false,
}: Options = {}) {
  const router = useRouter();
  const { open } = useConfirmMealSheet();
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
      if (!leaveScreen) {
        open(meal.id);
        return;
      }
      backOrHome(router);
      setTimeout(() => open(meal.id), SHEET_DISMISS_MS);
    },
    [router, open, requireActive, leaveScreen],
  );
}
