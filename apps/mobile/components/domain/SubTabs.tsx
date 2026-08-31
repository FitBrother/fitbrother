import { Pressable, Text, View } from "react-native";

/**
 * Classe do rótulo de uma sub-aba.
 *
 * Só peso e cor mudam entre ativa e inativa — nada de pill nem de fundo. As
 * sub-abas do Social e de Análises usavam o mesmo segmented control da barra
 * de navegação principal e disputavam a mesma hierarquia; texto puro com o
 * ativo em negrito deixa claro que são um nível abaixo.
 */
export function subTabLabelClass(selected: boolean): string {
  return selected ? "font-sans-bold text-neutral-800" : "font-sans text-neutral-500";
}

/**
 * Linha de sub-abas em texto, alinhada à esquerda.
 *
 * Alinhada à esquerda, e não distribuída em `flex-1`: ocupar a largura toda em
 * fatias iguais é justamente o que faz um grupo de abas parecer navegação
 * principal, mesmo sem fundo.
 */
export function SubTabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { key: K; label: string }[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <View className="mx-4 mb-1 mt-2 flex-row gap-2">
      {tabs.map(({ key, label }) => {
        const selected = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            // `min-w-[44px]` porque sem o pill o rótulo curto ("Dia") deixaria
            // o alvo de toque abaixo dos 44pt exigidos.
            className="min-h-[44px] min-w-[44px] items-center justify-center px-2 active:opacity-70"
          >
            <Text className={subTabLabelClass(selected)}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
