import { useEffect, useRef, type ReactNode } from "react";
import { View } from "react-native";
import { useTour } from "@/lib/tour/tour-context";
import type { TourStepId } from "@/lib/tour/steps";

/**
 * Envolve um elemento real (aba, avatar, card) que o tour pode apontar.
 * Fora do tour não faz nada além de repassar os filhos — sem custo de
 * `onLayout`/medição quando `active` é `false`.
 */
export function TourTarget({ id, children }: { id: TourStepId; children: ReactNode }) {
  const { active, registerTarget } = useTour();
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!active) return;
    // Desregistra ao desmontar (ex.: saiu da tela) ou quando o tour acaba.
    return () => registerTarget(id, null);
  }, [active, id, registerTarget]);

  if (!active) return <>{children}</>;

  return (
    <View
      ref={ref}
      // Obrigatório no Android: sem isso a view pode ser "achatada" na
      // otimização de hierarquia nativa, e `measureInWindow` para de
      // funcionar de forma confiável.
      collapsable={false}
      onLayout={() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          registerTarget(id, { x, y, width, height });
        });
      }}
    >
      {children}
    </View>
  );
}
