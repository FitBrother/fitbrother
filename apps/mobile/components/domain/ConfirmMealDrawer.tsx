import { useEffect, useRef } from "react";
import type { MealResponse } from "@fitbrother/shared";
import { useMealConfirmation } from "@/lib/hooks/useMealConfirmation";
import { ConfirmAdjustView } from "./ConfirmAdjustView";
import { ConfirmCompactView } from "./ConfirmCompactView";
import { ConfirmItemView } from "./ConfirmItemView";

type Props = {
  meal: MealResponse;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function ConfirmMealDrawer({ meal, onClose, onDirtyChange }: Props) {
  const confirmation = useMealConfirmation(meal, onClose);
  const { dirty, view } = confirmation;

  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);

  if (view.name === "item")
    return <ConfirmItemView index={view.index} confirmation={confirmation} />;
  if (view.name === "adjust") return <ConfirmAdjustView confirmation={confirmation} />;
  return <ConfirmCompactView meal={meal} confirmation={confirmation} />;
}
