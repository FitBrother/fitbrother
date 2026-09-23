import { useEffect, useRef, type ReactNode } from "react";
import { View } from "react-native";
import { useTour, type Rect } from "@/lib/tour/tour-context";
import type { TourStepId } from "@/lib/tour/steps";

/** Frames seguidos com a mesma medida pra considerar o alvo parado. Mais de
 * 1-2: a animação de largura da aba só começa um frame ou dois depois da troca
 * de passo, e o layout antigo não pode passar por "estável". */
const STABLE_FRAMES = 4;
/** Teto: se o alvo nunca parar (animação em loop), registra a última medida. */
const MAX_WAIT_MS = 1000;

/**
 * Envolve um elemento real (aba, avatar, card) que o tour pode apontar.
 *
 * Quando o passo dele vira o atual, mede a cada frame — sem setState, então
 * sem re-render — até a posição parar de mudar (fim da animação de largura da
 * aba, da transição nativa da tela recém-empilhada, de banners carregando) e
 * só então registra o retângulo. O overlay mostra só o véu até lá, em vez de
 * um recorte errado que depois pula pro lugar certo.
 */
export function TourTarget({ id, children }: { id: TourStepId; children: ReactNode }) {
  const { active, currentStepId, registerTarget } = useTour();
  const ref = useRef<View>(null);
  const isCurrent = currentStepId === id;

  useEffect(() => {
    if (!active) return;
    // Desregistra ao desmontar (ex.: saiu da tela) ou quando o tour acaba.
    return () => registerTarget(id, null);
  }, [active, id, registerTarget]);

  useEffect(() => {
    if (!isCurrent) return;
    let cancelled = false;
    let raf = 0;
    let last: Rect | null = null;
    let stable = 0;
    const startedAt = Date.now();

    const tick = () => {
      const node = ref.current;
      if (!node) {
        raf = requestAnimationFrame(tick);
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        if (cancelled) return;
        const rect = { x, y, width, height };
        const same =
          last !== null &&
          width > 0 &&
          height > 0 &&
          last.x === x &&
          last.y === y &&
          last.width === width &&
          last.height === height;
        stable = same ? stable + 1 : 0;
        last = rect;
        if (stable >= STABLE_FRAMES) {
          registerTarget(id, rect);
          return;
        }
        if (Date.now() - startedAt > MAX_WAIT_MS) {
          // Alvo invisível (ex.: Sidebar com `display: none` no layout
          // estreito, que divide o id com a aba do HomeHeader) mede 0×0 e não
          // registra — o visível vence; sem nenhum, a rede de segurança de 2 s
          // do provider avança o passo.
          if (width > 0 && height > 0) registerTarget(id, rect);
          return;
        }
        raf = requestAnimationFrame(tick);
      });
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [isCurrent, id, registerTarget]);

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
