import { Modal, Pressable, Text, View } from "react-native";
import { shadows } from "@/lib/shadows";

/**
 * Diálogo de confirmação para ações que a pessoa pode não querer ter tocado.
 *
 * Existe como componente — e não como `Alert.alert` — porque o `Alert` do
 * react-native-web é literalmente `static alert() {}`. Num app cuja superfície
 * principal é a web, confirmar por `Alert` não mostra nada E engole a ação
 * junto, porque o callback mora dentro do botão que nunca é desenhado.
 *
 * O `Modal` do react-native-web, ao contrário, é implementado de verdade.
 */
export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  /** Opcional: sem uma consequência concreta a dizer, a linha vira ruído. */
  description?: string;
  confirmLabel: string;
  /**
   * `null` remove o botão de cancelar e o diálogo vira um aviso de um botão só
   * — para quando não há escolha a fazer, só algo que precisa ser lido. Nesse
   * caso o fundo também confirma, porque sair e confirmar são a mesma coisa.
   */
  cancelLabel?: string | null;
  /** Pinta a confirmação de vermelho. Para o que apaga ou desfaz algo. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const avulso = cancelLabel === null;
  const sair = avulso ? onConfirm : onCancel;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={sair}>
      <View className="flex-1 items-center justify-center px-6">
        {/* Tocar fora cancela — mesmo alvo do botão Cancelar, nunca da
            confirmação: um toque acidental no vazio não pode disparar a ação.
            É um atalho de ponteiro e só: o `accessibilityViewIsModal` do card
            já faz o leitor de tela ignorar tudo que é irmão dele, então dar
            `role="button"` aqui anunciaria um alvo para ninguém. Quem navega
            por leitor de tela sai pelo botão Cancelar. */}
        <Pressable
          testID="confirm-dialog-backdrop"
          onPress={sair}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute inset-0 bg-black/40"
        />
        <View
          style={shadows.card}
          accessibilityViewIsModal
          className="w-full max-w-sm rounded-2xl bg-white p-5"
        >
          <Text className="text-center font-display-bold text-xl text-neutral-900">{title}</Text>
          {description ? (
            <Text className="mt-2 text-center font-sans text-sm text-neutral-600">
              {description}
            </Text>
          ) : null}
          <View className="mt-5 flex-row gap-3">
            {avulso ? null : (
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                className="min-h-[52px] flex-1 items-center justify-center rounded-[26px] bg-neutral-100 active:bg-neutral-200"
              >
                <Text className="font-sans-semibold text-neutral-700">{cancelLabel}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              className={[
                "min-h-[52px] flex-1 items-center justify-center rounded-[26px]",
                destructive
                  ? "bg-danger-600 active:bg-danger-500"
                  : "bg-primary-400 active:bg-primary-500",
              ].join(" ")}
            >
              <Text
                className={
                  destructive
                    ? "font-sans-semibold text-white"
                    : "font-sans-semibold text-neutral-900"
                }
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
