import { Text, View } from "react-native";
import { colors } from "@/lib/colors";
import { macroEnergySplit, type MacroSplit } from "@/lib/social/post-format";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

/**
 * Ordem fixa proteína → carboidrato → gordura, igual à do resumo da Home e à
 * da leitura dos macros no resto do app. Uma barra que reordena por tamanho
 * ficaria mais bonita e impediria comparar dois posts de relance.
 */
const MACROS = [
  { key: "protein", label: "proteína", short: "P", fill: colors.protein[500] },
  { key: "carbs", label: "carboidrato", short: "C", fill: colors.carbs[500] },
  { key: "fat", label: "gordura", short: "G", fill: colors.fat[500] },
] as const;

/**
 * Assinatura visual do post de refeição: a "impressão digital" nutricional.
 *
 * Uma barra contínua dividida pela fatia de CALORIAS de cada macro, com as
 * gramas logo abaixo. Substitui a linha densa `48g P · 58g C · 19g G`, que
 * obrigava a ler três números e fazer a conta de cabeça para entender se a
 * refeição era proteica ou gordurosa — a informação que faz alguém parar no
 * feed de um app de nutrição.
 *
 * Os números continuam escritos: a barra dá a proporção de relance, o texto dá
 * o valor exato. Nenhum dos dois sozinho serve.
 */
export function MacroSplitBar({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) {
  const gramas: MacroSplit = { protein, carbs, fat };
  const split = macroEnergySplit(gramas);
  if (!split) return null;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${Math.round(protein)} gramas de proteína, ${Math.round(
        carbs,
      )} de carboidrato, ${Math.round(fat)} de gordura`}
    >
      {/* `overflow-hidden` no trilho para as pontas arredondadas recortarem os
          segmentos — sem ele o primeiro e o último segmento vazam quadrados. */}
      <View className="h-1.5 flex-row overflow-hidden rounded-full bg-neutral-100">
        {MACROS.map(({ key, fill }) => (
          // Largura em `style`: é uma porcentagem calculada, fora da escala
          // estática que o Tailwind consegue gerar.
          <View key={key} style={{ width: `${split[key] * 100}%`, backgroundColor: fill }} />
        ))}
      </View>

      <View className="mt-2.5 flex-row">
        {MACROS.map(({ key, label, short, fill }) => (
          <View key={key} className="flex-1 flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: fill }} />
            <Text style={NUM} className="font-sans-semibold text-sm text-neutral-700">
              {Math.round(gramas[key])}g
            </Text>
            {/* Abreviação em telas estreitas, nome inteiro quando cabe: "P/C/G"
                só é legível para quem já usa o app, e o feed é justamente onde
                aparece gente nova. */}
            <Text className="font-sans text-xs text-neutral-500 sm:hidden">{short}</Text>
            <Text className="hidden font-sans text-xs text-neutral-500 sm:flex">{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * A mesma divisão, mas só a faixa colorida — para encostar na borda de baixo de
 * um card e virar a própria aresta dele.
 *
 * Economiza a linha inteira que a barra ocupava no meio do conteúdo (barra mais
 * as margens de cima e de baixo) sem perder a leitura de proporção. Precisa de
 * `overflow-hidden` no card: é o raio dele que recorta as pontas da faixa.
 *
 * Os segmentos não têm raio próprio e a faixa não tem trilho de fundo — ela não
 * é um elemento pousado no card, é a borda dele.
 *
 * Sem papel de acessibilidade: as gramas vêm escritas no conteúdo logo acima
 * (`MacroLegendInline`), e anunciar os mesmos três números de novo só alonga a
 * leitura por voz.
 */
export function MacroSplitBorder({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) {
  const split = macroEnergySplit({ protein, carbs, fat });
  if (!split) return null;

  return (
    <View className="h-1.5 flex-row" accessibilityElementsHidden importantForAccessibility="no">
      {MACROS.map(({ key, fill }) => (
        <View key={key} style={{ width: `${split[key] * 100}%`, backgroundColor: fill }} />
      ))}
    </View>
  );
}

/**
 * Gramas dos três macros numa linha só, para dividir a linha com as calorias.
 *
 * A legenda do `MacroSplitBar` ocupa uma linha própria com as três colunas em
 * `flex-1`; aqui elas encolhem para o conteúdo e cabem à direita do número de
 * kcal. É a outra metade da economia de espaço feita pelo `MacroSplitBorder`.
 */
export function MacroLegendInline({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) {
  const gramas: MacroSplit = { protein, carbs, fat };

  return (
    <View
      className="flex-row items-center gap-3"
      accessibilityRole="text"
      accessibilityLabel={`${Math.round(protein)} gramas de proteína, ${Math.round(
        carbs,
      )} de carboidrato, ${Math.round(fat)} de gordura`}
    >
      {MACROS.map(({ key, short, fill }) => (
        <View key={key} className="flex-row items-center gap-1">
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: fill }} />
          <Text style={NUM} className="font-sans-medium text-sm text-neutral-600">
            {Math.round(gramas[key])}g
          </Text>
          <Text className="font-sans text-xs text-neutral-400">{short}</Text>
        </View>
      ))}
    </View>
  );
}
