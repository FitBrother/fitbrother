import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Download, Share, SquarePlus, X } from "lucide-react-native";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";

export function InstallPrompt() {
  const install = useInstallPrompt();
  const [showIosGuide, setShowIosGuide] = useState(false);

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
        <Button
          label="Instalar"
          size="sm"
          leftIcon={<Download size={18} color="#fff" />}
          onPress={async () => {
            await install.promptEvent.prompt();
            await install.promptEvent.userChoice;
          }}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setShowIosGuide(true)}
        accessibilityRole="button"
        accessibilityLabel="Adicionar à Tela de Início"
        className="min-h-[44px] flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4"
      >
        <View className="flex-1 pr-3">
          <Text className="font-sans-medium text-base text-neutral-800">
            Adicionar à Tela de Início
          </Text>
          <Text className="font-sans text-sm text-neutral-500">
            Acesse o Fitbrother direto da tela inicial do seu iPhone.
          </Text>
        </View>
        <SquarePlus size={20} color={colors.neutral[400]} />
      </Pressable>

      <Modal
        visible={showIosGuide}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIosGuide(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full max-w-sm gap-4 rounded-2xl bg-white p-6">
            <View className="flex-row items-start justify-between">
              <Text className="flex-1 font-sans-bold text-lg text-neutral-800">
                Adicionar à Tela de Início
              </Text>
              <Pressable
                onPress={() => setShowIosGuide(false)}
                accessibilityLabel="Fechar"
                accessibilityRole="button"
                className="min-h-[44px] min-w-[44px] items-center justify-center"
              >
                <X size={20} color={colors.neutral[500]} />
              </Pressable>
            </View>

            <View className="flex-row items-center gap-3">
              <Share size={20} color={colors.primary[400]} />
              <Text className="flex-1 font-sans-medium text-sm text-neutral-700">
                1. Toque em Compartilhar na barra do Safari
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <SquarePlus size={20} color={colors.primary[400]} />
              <Text className="flex-1 font-sans-medium text-sm text-neutral-700">
                2. Toque em &ldquo;Adicionar à Tela de Início&rdquo;
              </Text>
            </View>

            <Button label="Entendi" variant="outline" onPress={() => setShowIosGuide(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
