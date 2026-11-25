import { useRef } from "react";
import { usePreventRemove } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { useDialog } from "@/lib/dialog/dialog-context";

export function useDiscardChangesGuard(dirty: boolean) {
  const navigation = useNavigation();
  const dialog = useDialog();
  const allowLeaveRef = useRef(false);

  // Covers the header back, the iOS swipe and the Android back button alike.
  usePreventRemove(dirty, ({ data }) => {
    if (allowLeaveRef.current) {
      allowLeaveRef.current = false;
      navigation.dispatch(data.action);
      return;
    }
    void dialog
      .confirm({
        title: "Descartar alterações?",
        description: "Você não salvou os ajustes.",
        confirmLabel: "Descartar",
        destructive: true,
      })
      .then((discard) => {
        if (discard) navigation.dispatch(data.action);
      });
  });

  return {
    allowLeave: () => {
      allowLeaveRef.current = true;
    },
  };
}
