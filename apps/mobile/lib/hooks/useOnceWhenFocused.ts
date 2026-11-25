import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";

export function useOnceWhenFocused(ready: boolean, fire: () => void) {
  const fired = useRef(false);
  const fireRef = useRef(fire);

  useEffect(() => {
    fireRef.current = fire;
  });

  useEffect(() => {
    if (!ready) fired.current = false;
  }, [ready]);

  useFocusEffect(
    useCallback(() => {
      if (!ready || fired.current) return;
      fired.current = true;
      fireRef.current();
    }, [ready]),
  );
}
