import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { View } from "react-native";
import { useTour } from "@/lib/tour/tour-context";
import type { TourStepId } from "@/lib/tour/steps";

/** Espera a tela recém-empilhada assentar (transição nativa + conteúdo
 * assíncrono acima do alvo) antes de medir de novo. */
const SETTLE_MS = 400;

/**
 * Envolve um elemento real (aba, avatar, card) que o tour pode apontar.
 * Fora do tour não faz nada além de repassar os filhos — sem custo de
 * `onLayout`/medição quando `active` é `false`.
 */
export function TourTarget({ id, children }: { id: TourStepId; children: ReactNode }) {
  const { active, currentStepId, registerTarget } = useTour();
  const ref = useRef<View>(null);
  const isCurrent = currentStepId === id;

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      registerTarget(id, { x, y, width, height });
    });
  }, [id, registerTarget]);

  useEffect(() => {
    if (!active) return;
    // Desregistra ao desmontar (ex.: saiu da tela) ou quando o tour acaba.
    return () => registerTarget(id, null);
  }, [active, id, registerTarget]);

  // O `onLayout` só dispara quando o layout relativo ao pai muda — numa tela
  // recém-empilhada (Perfil) a primeira medida pode sair antes da tela estar
  // na janela, ou antes de banners acima do alvo carregarem. Mede de novo
  // quando este passo vira o atual e depois que tudo assentou.
  useEffect(() => {
    if (!isCurrent) return;
    measure();
    const timeout = setTimeout(measure, SETTLE_MS);
    return () => clearTimeout(timeout);
  }, [isCurrent, measure]);

  if (!active) return <>{children}</>;

  return (
    <View
      ref={ref}
      // Obrigatório no Android: sem isso a view pode ser "achatada" na
      // otimização de hierarquia nativa, e `measureInWindow` para de
      // funcionar de forma confiável.
      collapsable={false}
      onLayout={measure}
    >
      {children}
    </View>
  );
}
