import { Pressable, Text, View } from "react-native";

export const SEARCH_EXAMPLES = ["arroz", "frango", "pão", "banana"];

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="px-3 pb-1 pt-3 font-sans-semibold text-xs uppercase text-neutral-500">
      {children}
    </Text>
  );
}

export function SearchHint() {
  return (
    <Text className="px-3 pb-1 pt-2 font-sans text-xs text-neutral-500">
      A busca começa a partir de 2 letras.
    </Text>
  );
}

function TextAction({
  label,
  onPress,
  strong = false,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-[44px] min-w-[44px] items-center justify-center px-3"
    >
      <Text
        className={`text-sm text-center ${strong ? "font-sans-semibold text-neutral-800" : "font-sans-medium text-neutral-600"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ShortQueryPanel({ onPickExample }: { onPickExample: (term: string) => void }) {
  return (
    <View className="px-3 py-3">
      <Text className="font-sans-semibold text-sm text-neutral-800">
        Falta só mais 1 letra para buscar.
      </Text>
      <Text className="mt-1 font-sans text-xs text-neutral-500">
        Escreva o nome do alimento ou toque num exemplo para ver as opções.
      </Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {SEARCH_EXAMPLES.map((term) => (
          <Pressable
            key={term}
            onPress={() => onPickExample(term)}
            accessibilityRole="button"
            accessibilityLabel={`Buscar ${term}`}
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-neutral-200 px-4 active:bg-neutral-50"
          >
            <Text className="font-sans-medium text-sm text-neutral-800">{term}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function NoResultPanel({ term, onUseTyped }: { term: string; onUseTyped: () => void }) {
  return (
    <View className="items-center px-3 py-3">
      <Text className="text-center font-sans-semibold text-sm text-neutral-800">
        {`Não achamos “${term}” no catálogo`}
      </Text>
      <Text className="mt-1 text-center font-sans text-xs text-neutral-500">
        Você pode usar o nome do jeito que escreveu e informar as calorias e os macros depois.
      </Text>
      <View className="mt-2">
        <TextAction label={`Usar “${term}” mesmo assim`} onPress={onUseTyped} strong />
      </View>
      <Text className="text-center font-sans text-xs text-neutral-500">
        Dica: tente só uma palavra, como “peixe” ou “arroz”.
      </Text>
    </View>
  );
}

export function SearchErrorPanel({
  term,
  onRetry,
  onUseTyped,
}: {
  term: string;
  onRetry: () => void;
  onUseTyped: () => void;
}) {
  return (
    <View className="items-center px-3 py-3">
      <Text className="text-center font-sans-semibold text-sm text-neutral-800">
        Não foi possível buscar agora
      </Text>
      <Text className="mt-1 text-center font-sans text-xs text-neutral-500">
        Confira sua conexão e tente de novo.
      </Text>
      <View className="mt-2">
        <TextAction label="Tentar de novo" onPress={onRetry} strong />
        <TextAction label={`Usar “${term}” sem o catálogo`} onPress={onUseTyped} />
      </View>
    </View>
  );
}
