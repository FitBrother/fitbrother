import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  ChevronDown,
  ChevronUp,
  Download,
  MoreHorizontal,
  Share,
  SquarePlus,
  X,
} from "lucide-react-native";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";
import { Motion } from "@/lib/motion";
import { iosGuideInfo, useInstallPrompt } from "@/lib/hooks/useInstallPrompt";

type GuideStepData = { icon: ReactNode; text: string };

// Chrome iOS põe "Adicionar à Tela de Início" direto no menu (⋯) — sem
// passar por Compartilhar. Safari usa o ícone de Compartilhar. Qualquer
// outro navegador (Firefox/Edge iOS, minoria residual) cai num roteiro
// genérico de 3 passos que cobre os dois casos.
function stepsFor(browser: "safari" | "chrome" | "other"): GuideStepData[] {
  const shareIcon = <Share size={20} color={colors.primary[400]} />;
  const menuIcon = <MoreHorizontal size={20} color={colors.primary[400]} />;
  const addIcon = <SquarePlus size={20} color={colors.primary[400]} />;
  if (browser === "chrome") {
    return [
      { icon: menuIcon, text: "Toque no menu (⋯) do navegador" },
      { icon: addIcon, text: "Toque em “Adicionar à Tela de Início”" },
    ];
  }
  if (browser === "safari") {
    return [
      { icon: shareIcon, text: "Toque no ícone de Compartilhar" },
      { icon: addIcon, text: "Toque em “Adicionar à Tela de Início”" },
    ];
  }
  return [
    { icon: menuIcon, text: "Toque no menu do navegador" },
    { icon: shareIcon, text: "Toque em “Compartilhar”" },
    { icon: addIcon, text: "Toque em “Adicionar à Tela de Início”" },
  ];
}

/** Seta pulsando na direção da barra de ferramentas real do navegador —
 * o guia não sabe o pixel exato (varia por navegador/versão), mas apontar
 * "é ali embaixo"/"é ali em cima" já reduz a procura. */
function ToolbarHint({ direction }: { direction: "down" | "up" }) {
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    const distance = direction === "down" ? 5 : -5;
    offset.value = withRepeat(
      withSequence(
        withTiming(distance, { duration: 500, easing: Motion.easing.standard }),
        withTiming(0, { duration: 500, easing: Motion.easing.standard }),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, direction]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const Icon = direction === "down" ? ChevronDown : ChevronUp;

  return (
    <Animated.View style={style}>
      <Icon size={18} color={colors.primary[300]} />
    </Animated.View>
  );
}

function GuideStepRow({
  number,
  step,
  isLast,
}: {
  number: number;
  step: GuideStepData;
  isLast: boolean;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View className="h-6 w-6 items-center justify-center rounded-full bg-primary-100">
          <Text
            className="font-sans-bold text-xs text-primary-600"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {number}
          </Text>
        </View>
        {!isLast && <View className="my-1 w-px flex-1 bg-neutral-200" />}
      </View>
      <View className={`flex-1 flex-row items-center gap-2 ${isLast ? "" : "pb-4"}`}>
        {step.icon}
        <Text className="flex-1 font-sans-medium text-sm text-neutral-700">{step.text}</Text>
      </View>
    </View>
  );
}

export function InstallPrompt() {
  const install = useInstallPrompt();
  const [showGuide, setShowGuide] = useState(false);

  const guideInfo = useMemo(
    () => (install.status === "installable-ios" ? iosGuideInfo() : null),
    [install.status],
  );

  if (install.status === "native" || install.status === "installed") return null;
  if (install.status === "unsupported") return null;

  if (install.status === "installable-chrome") {
    return (
      <View className="min-h-[44px] flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
        <View className="flex-1 pr-3">
          <Text className="font-sans-medium text-base text-neutral-800">Instalar o app</Text>
          <Text className="font-sans text-sm text-neutral-500">
            Acesse o Fitbrother direto da tela inicial do seu celular.
          </Text>
        </View>
        {/* Ícone em neutral-900, a mesma cor do label do botão primary
            (`text-neutral-900`). Estava `#fff`: ícone claro ao lado de texto
            escuro, os dois sobre o mesmo fundo menta. */}
        <Button
          label="Instalar"
          size="sm"
          leftIcon={<Download size={18} color={colors.neutral[900]} />}
          onPress={async () => {
            await install.promptEvent.prompt();
            await install.promptEvent.userChoice;
          }}
        />
      </View>
    );
  }

  const isMacSafari = install.status === "installable-mac-safari";
  const title = isMacSafari ? "Adicionar ao Dock" : "Adicionar à Tela de Início";
  const subtitle = isMacSafari
    ? "Acesse o Fitbrother direto do Dock do seu Mac."
    : "Acesse o Fitbrother direto da tela inicial do seu celular.";
  const steps: GuideStepData[] = isMacSafari
    ? [
        {
          icon: <Share size={20} color={colors.primary[400]} />,
          text: "Clique no ícone de Compartilhar na barra de endereço",
        },
        {
          icon: <SquarePlus size={20} color={colors.primary[400]} />,
          text: "Escolha “Adicionar ao Dock”",
        },
      ]
    : stepsFor(guideInfo?.browser ?? "other");
  // No Mac o menu de compartilhar fica na barra de endereço, no topo — sem
  // ambiguidade, então o ponteiro só entra pro fluxo do iOS (varia por
  // iPhone/iPad).
  const hintDirection = !isMacSafari && guideInfo?.device === "pad" ? "up" : "down";

  return (
    <>
      <Pressable
        onPress={() => setShowGuide(true)}
        accessibilityRole="button"
        accessibilityLabel={title}
        className="min-h-[44px] flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4"
      >
        <View className="flex-1 pr-3">
          <Text className="font-sans-medium text-base text-neutral-800">{title}</Text>
          <Text className="font-sans text-sm text-neutral-500">{subtitle}</Text>
        </View>
        <SquarePlus size={20} color={colors.neutral[400]} />
      </Pressable>

      <Modal
        visible={showGuide}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGuide(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full max-w-sm gap-4 rounded-2xl bg-white p-6">
            <View className="flex-row items-start justify-between">
              <Text className="flex-1 font-sans-bold text-lg text-neutral-800">{title}</Text>
              <Pressable
                onPress={() => setShowGuide(false)}
                accessibilityLabel="Fechar"
                accessibilityRole="button"
                className="min-h-[44px] min-w-[44px] items-center justify-center"
              >
                <X size={20} color={colors.neutral[500]} />
              </Pressable>
            </View>

            {!isMacSafari && hintDirection === "up" && (
              <View className="items-center">
                <ToolbarHint direction="up" />
              </View>
            )}

            <View>
              {steps.map((step, i) => (
                <GuideStepRow key={i} number={i + 1} step={step} isLast={i === steps.length - 1} />
              ))}
            </View>

            {!isMacSafari && hintDirection === "down" && (
              <View className="items-center">
                <ToolbarHint direction="down" />
              </View>
            )}

            <Button label="Entendi" variant="outline" onPress={() => setShowGuide(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
