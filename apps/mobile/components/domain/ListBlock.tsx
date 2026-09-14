import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { shadows } from "@/lib/shadows";

/**
 * Card único que agrupa uma lista de linhas, com título fora dele.
 *
 * O Ranking e o Seguindo davam um card com sombra para CADA pessoa. Empilhados,
 * viravam uma escadinha de caixas soltas: a sombra repetida a cada linha pesava
 * a tela e nada dizia que aquelas seis caixas eram uma lista só. Aqui a sombra é
 * do bloco, e as pessoas se separam por um filete de 1px — hierarquia certa,
 * porque o agrupamento é a informação.
 *
 * `overflow-hidden` é o que faz uma linha com fundo próprio (a do "Você", em
 * menta) ser recortada pelo raio do card em vez de vazar quadrada nos cantos.
 */
export function ListBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="gap-1.5">
        <Text className="font-sans-bold text-base text-neutral-800">{title}</Text>
        {subtitle}
      </View>
      <View style={shadows.card} className="overflow-hidden rounded-[26px] bg-white">
        {children}
      </View>
    </View>
  );
}

/**
 * Filete entre duas linhas de um `ListBlock`.
 *
 * `mx-4` e não largura cheia: um separador que encosta nas duas bordas corta o
 * card em pedaços; recuado, ele agrupa. É a mesma régua usada entre os itens do
 * MealCard.
 */
export function BlockDivider() {
  return <View className="mx-4 h-px bg-neutral-100" />;
}
