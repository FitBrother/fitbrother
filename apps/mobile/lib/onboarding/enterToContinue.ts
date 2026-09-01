import { useEffect, useRef } from "react";

/** Elementos que já tratam Enter sozinhos. O Pressable do React Native Web
 * vira `<div role="button" tabindex="0">` e dispara onPress no Enter — sem
 * essa exclusão, Enter com foco no botão "Voltar" voltaria e avançaria na
 * mesma tecla. `textarea` é o TextInput multiline do MealComposer, onde
 * Enter é quebra de linha. */
const SELF_HANDLED_SELECTOR =
  '[role="button"], [role="link"], [role="checkbox"], [role="radio"], a, button, textarea';

export interface EnterCandidate {
  key: string;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  target: unknown;
}

/** Decisão pura, separada do hook porque o ambiente de teste do app não tem
 * DOM (`jest-expo` sem jsdom). */
export function shouldAdvanceOnEnter(event: EnterCandidate): boolean {
  if (event.key !== "Enter") return false;
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;

  const target = event.target as { closest?: (selector: string) => unknown } | null;
  if (typeof target?.closest === "function" && target.closest(SELF_HANDLED_SELECTOR)) {
    return false;
  }
  return true;
}

/**
 * Enter avança a etapa do onboarding. Só faz efeito onde existe DOM — em
 * nativo o teclado físico não é o caminho principal e `document` não existe.
 */
export function useEnterToContinue({
  onNext,
  disabled,
  enabled = true,
}: {
  onNext?: () => void;
  disabled?: boolean;
  enabled?: boolean;
}): void {
  // Os valores entram por ref pra não re-registrar o listener a cada
  // digitação — o shell re-renderiza a cada tecla nos blocos com campo.
  const state = useRef({ onNext, disabled, enabled });
  state.current = { onNext, disabled, enabled };

  useEffect(() => {
    if (typeof document === "undefined") return;

    function handleKeyDown(event: KeyboardEvent) {
      const current = state.current;
      if (!current.enabled || !current.onNext) return;
      if (!shouldAdvanceOnEnter(event)) return;

      event.preventDefault();
      // O campo numérico do SliderInput faz o commit (parse + clamp) no
      // onBlur. Sem esse blur, digitar 185 e apertar Enter avançaria com o
      // valor antigo ainda no store.
      const active = document.activeElement as { blur?: () => void } | null;
      active?.blur?.();

      // Um frame pro React reconciliar o commit antes de reler `disabled` —
      // ler no mesmo tick pegaria o valor pré-blur.
      requestAnimationFrame(() => {
        const latest = state.current;
        if (latest.enabled && latest.onNext && !latest.disabled) latest.onNext();
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
