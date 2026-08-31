import { useMemo, useState, type ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Download, MoreHorizontal, Share, SquarePlus, X } from "lucide-react-native";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";
import { iosGuideBrowser, useInstallPrompt } from "@/lib/hooks/useInstallPrompt";

type GuideStepData = { icon: ReactNode; text: string };

// Chrome iOS põe "Adicionar à Tela de Início" direto no menu (⋯) — sem
// passar por Compartilhar, e isso não muda com versão/configuração
// (comportamento fixo do app). Safari e os demais navegadores variam
// demais pra apostar num layout: o ícone de Compartilhar às vezes some
// atrás de um menu (⋯/☰), e desde o iOS 15 dá pra trocar a posição da
// barra inteira nos Ajustes — por isso o passo cobre as duas
// possibilidades no próprio texto em vez de fingir uma aparência fixa.
function stepsFor(browser: "chrome" | "other"): GuideStepData[] {
  const shareIcon = <Share size={18} color={colors.primary[400]} />;
  const menuIcon = <MoreHorizontal size={18} color={colors.primary[400]} />;
  const addIcon = <SquarePlus size={20} color={colors.primary[400]} />;
  if (browser === "chrome") {
    return [
      { icon: menuIcon, text: "Toque no menu (⋯) do navegador" },
      { icon: addIcon, text: "Toque em “Adicionar à Tela de Início”" },
    ];
  }
  return [
    {
      icon: (
        <View className="flex-row gap-1">
          {shareIcon}
          {menuIcon}
        </View>
      ),
      text: "Toque no ícone de Compartilhar — se não aparecer direto, toque no menu do navegador primeiro",
    },
    {
      icon: addIcon,
      text: "Toque em “Adicionar à Tela de Início” (dentro de Compartilhar, se for o caso)",
    },
  ];
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

  const browser = useMemo(
    () => (install.status === "installable-ios" ? iosGuideBrowser() : "other"),
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
          icon: <Share size={18} color={colors.primary[400]} />,
          text: "Clique no ícone de Compartilhar na barra de endereço",
        },
        {
          icon: <SquarePlus size={20} color={colors.primary[400]} />,
          text: "Escolha “Adicionar ao Dock”",
        },
      ]
    : stepsFor(browser);

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

            <View>
              {steps.map((step, i) => (
                <GuideStepRow key={i} number={i + 1} step={step} isLast={i === steps.length - 1} />
              ))}
            </View>

            <Button label="Entendi" variant="outline" onPress={() => setShowGuide(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
