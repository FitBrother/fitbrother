import { useEffect, useRef, useState } from "react";
import { Platform, View, Text, useWindowDimensions } from "react-native";
import Svg, { Defs, Mask, Rect as SvgRect } from "react-native-svg";
import { Button } from "@/components/Button";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { useTour } from "@/lib/tour/tour-context";
import { tourLayout, visibleSteps } from "@/lib/tour/steps";
import { shadows } from "@/lib/shadows";

/** Respiro entre o alvo real e a borda do recorte do spotlight. */
const CUTOUT_PADDING = 8;
const CUTOUT_RADIUS = 16;
const BALLOON_MARGIN = 16;
const BALLOON_SIDE_MARGIN = 20;

export function TourOverlay() {
  const { active, currentStepId, targets, next, skip } = useTour();
  const install = useInstallPrompt();
  const { width, height } = useWindowDimensions();
  // Origem do próprio overlay no mesmo sistema do `measureInWindow` dos
  // alvos. No Android edge-to-edge esse sistema começa abaixo da status bar
  // enquanto o overlay começa no topo da tela — subtrair a origem cancela o
  // deslocamento em qualquer plataforma.
  const rootRef = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  // Web: a página rola por baixo com a roda do mouse e o destaque ficaria
  // fora do lugar — trava a rolagem do documento enquanto o tour está ativo.
  useEffect(() => {
    if (Platform.OS !== "web" || !active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);

  if (!active || !currentStepId) return null;

  const steps = visibleSteps(install.status, tourLayout(width));
  const stepIndex = steps.findIndex((s) => s.id === currentStepId);
  const step = steps[stepIndex];
  if (!step) return null;

  const isLast = stepIndex === steps.length - 1;
  const measured = targets[currentStepId];
  const rect = measured
    ? { ...measured, x: measured.x - origin.x, y: measured.y - origin.y }
    : undefined;
  const hole = rect
    ? {
        x: Math.max(0, rect.x - CUTOUT_PADDING),
        y: Math.max(0, rect.y - CUTOUT_PADDING),
        width: rect.width + CUTOUT_PADDING * 2,
        height: rect.height + CUTOUT_PADDING * 2,
      }
    : null;

  // Sem retângulo ainda (alvo animando/tela entrando — ver TourTarget), só o
  // véu: o balão aparece junto com o recorte, já no lugar certo.
  const balloonBelow = rect !== undefined && rect.y < height / 2;

  return (
    <View
      ref={rootRef}
      collapsable={false}
      onLayout={() =>
        rootRef.current?.measureInWindow((x, y) =>
          setOrigin((o) => (o.x === x && o.y === y ? o : { x, y })),
        )
      }
      style={{
        // Web: `fixed` pra cobrir a viewport mesmo com o documento rolado
        // (layout desktop usa sticky + rolagem de página). O tipo do RN não
        // conhece "fixed"; o react-native-web aceita.
        position: (Platform.OS === "web" ? "fixed" : "absolute") as "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
      accessibilityViewIsModal
    >
      <Svg width={width} height={height} style={{ position: "absolute" }} pointerEvents="none">
        <Defs>
          <Mask id="tour-mask">
            <SvgRect x={0} y={0} width={width} height={height} fill="white" />
            {hole ? (
              <SvgRect
                x={hole.x}
                y={hole.y}
                width={hole.width}
                height={hole.height}
                rx={CUTOUT_RADIUS}
                fill="black"
              />
            ) : null}
          </Mask>
        </Defs>
        <SvgRect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="rgba(4, 16, 12, 0.72)"
          mask="url(#tour-mask)"
        />
      </Svg>

      {rect ? (
        <View
          style={{
            position: "absolute",
            left: BALLOON_SIDE_MARGIN,
            right: BALLOON_SIDE_MARGIN,
            ...(balloonBelow
              ? { top: rect.y + rect.height + CUTOUT_PADDING + BALLOON_MARGIN }
              : { bottom: height - rect.y + CUTOUT_PADDING + BALLOON_MARGIN }),
          }}
        >
          <View className="gap-3 rounded-2xl bg-white p-4" style={shadows.floating}>
            <Text className="font-sans-medium text-base text-neutral-900">{step.copy}</Text>
            <View className="flex-row justify-end gap-2">
              {isLast ? (
                <Button
                  label="Concluir"
                  size="sm"
                  onPress={next}
                  accessibilityLabel="Concluir tour"
                />
              ) : (
                <>
                  <Button
                    label="Pular"
                    variant="ghost"
                    size="sm"
                    onPress={skip}
                    accessibilityLabel="Pular tour"
                  />
                  <Button
                    label="Próximo"
                    size="sm"
                    onPress={next}
                    accessibilityLabel="Próximo passo"
                  />
                </>
              )}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
