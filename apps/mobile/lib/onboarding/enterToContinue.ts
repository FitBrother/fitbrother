import { useEffect, useRef } from "react";

/** Elementos que já tratam Enter sozinhos. O Pressable do React Native Web
 * vira `<div role="button" tabindex="0">` e dispara onPress no Enter — sem
 * essa exclusão, Enter com foco no botão "Voltar" voltaria e avançaria na
 * mesma tecla. `textarea` é o TextInput multiline do MealComposer, onde
 * Enter é quebra de linha.
 *
 * `role="radio"` NÃO entra aqui, de propósito. Três dos oito blocos de dados
 * são radiogroups (gordura corporal, atividade, objetivo): o usuário clica na
 * opção, o foco fica no radio, e excluí-lo mataria o Enter justamente onde
 * ele é mais útil. Re-disparar a seleção do radio já selecionado é
 * idempotente, então deixar os dois handlers rodarem é seguro.
 *
 * `role="checkbox"` continua excluído porque alternar não é idempotente —
 * no ConsentBlock, Enter desmarcaria um consentimento e avançaria. */
const SELF_HANDLED_SELECTOR =
  '[role="button"], [role="link"], [role="checkbox"], a, button, textarea';

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

      if (current.disabled) return;

      event.preventDefault();
      // O campo numérico do SliderInput faz o commit (parse + clamp) no
      // onBlur. Sem esse blur, digitar 185 e apertar Enter avançaria com o
      // valor antigo ainda no store.
      //
      // Síncrono de propósito, sem esperar um frame: `blur()` despacha o
      // evento na hora, o commit escreve no store do zustand na hora, e o
      // `onNext` lê via getState() — nada aqui depende de o React ter
      // reconciliado. Uma versão anterior deferia com requestAnimationFrame
      // e nunca avançava em aba em segundo plano, onde rAF fica suspenso.
      const active = document.activeElement as { blur?: () => void } | null;
      active?.blur?.();

      current.onNext();
    }

    // Fase de CAPTURA, não bolha: o TextInput do React Native Web chama
    // stopPropagation no Enter pra implementar onSubmitEditing, então um
    // listener de bolha no window nunca veria a tecla vinda de um campo —
    // que é justamente o caso principal (digitar 185 e apertar Enter).
    // Ver o evento primeiro não atropela ninguém: a exclusão por seletor
    // acima continua devolvendo o Enter pros elementos que o tratam
    // sozinhos, e preventDefault não impede o handler do próprio campo.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);
}
