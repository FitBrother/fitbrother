import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { View } from "react-native";
import { useTour } from "@/lib/tour/tour-context";
import type { TourStepId } from "@/lib/tour/steps";

/** Espera a animação de largura da aba (Motion.duration.base), a transição
 * nativa da tela recém-empilhada e conteúdo assíncrono acima do alvo
 * assentarem antes de medir de novo. */
const SETTLE_MS = 400;

/**
 * Envolve um elemento real (aba, avatar, card) que o tour pode apontar.
 * Só mede quando o passo dele é o atual — nada de `onLayout`: a aba ativa
 * anima a largura frame a frame, e medir (e re-renderizar a Home) a cada
 * frame travava a transição.
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

  // Mede ao virar o passo atual (hole aparece já) e de novo depois que
  // animação/tela recém-empilhada/banners assentaram (posição final).
  useEffect(() => {
    if (!isCurrent) return;
    measure();
    const timeout = setTimeout(measure, SETTLE_MS);
    return () => clearTimeout(timeout);
  }, [isCurrent, measure]);

  // Wrapper sempre presente: alternar entre fragment e View remontaria os
  // filhos (abas, avatar) no início e no fim do tour.
  return (
    <View
      ref={ref}
      // Obrigatório no Android: sem isso a view pode ser "achatada" na
      // otimização de hierarquia nativa, e `measureInWindow` para de
      // funcionar de forma confiável.
      collapsable={false}
    >
      {children}
    </View>
  );
}
