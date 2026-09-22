import { Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { macroEnergySplit } from "@/lib/social/post-format";
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  STORY_SAFE_BOTTOM,
  STORY_SAFE_TOP,
} from "@/lib/share/geometry";
import { truncate, withAlpha, type SharePreset } from "@/lib/share/presets";
import { ShareLogo } from "./share/ShareLogo";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

/** Margem lateral. Tudo que é texto se alinha nesta coluna. */
const PAD = 26;

const PREENCHE = { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 } as const;

/**
 * Os macros na ordem fixa proteína → carboidrato → gordura, a mesma do resto do
 * app. Duplicada aqui em vez de importada do `MacroSplitBar` porque o card
 * desenha a barra com cores e tamanhos próprios do preset — o que é comum é a
 * ordem e a regra de divisão (`macroEnergySplit`), não o visual.
 */
const MACROS = [
  { key: "protein", label: "proteína", curto: "P", fill: colors.protein[500] },
  { key: "carbs", label: "carbo", curto: "C", fill: colors.carbs[500] },
  { key: "fat", label: "gordura", curto: "G", fill: colors.fat[500] },
] as const;

export type ShareCardData =
  | {
      kind: "meal";
      /** As palavras da pessoa (legenda) ou os itens da refeição. */
      headline: string | null;
      imageUrl: string | null;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      dateLabel: string;
    }
  | {
      kind: "insight";
      title: string;
      headline: string;
      bullets: string[];
      score: number | null;
      dateLabel: string;
    };

/** A foto que este conteúdo tem para oferecer, se tiver. */
export function fotoDoCard(data: ShareCardData): string | null {
  return data.kind === "meal" ? data.imageUrl : null;
}

/** Se há energia declarada — sem ela, não há proporção de macros para mostrar. */
export function temMacros(data: ShareCardData): boolean {
  if (data.kind !== "meal") return false;
  return (
    macroEnergySplit({
      protein: data.protein_g,
      carbs: data.carbs_g,
      fat: data.fat_g,
    }) !== null
  );
}

// ─── Peças ───────────────────────────────────────────────────────────────────

/**
 * A barra de proporção dos macros — a assinatura visual do app.
 *
 * As fatias são de CALORIAS, não de gramas: 58g de carbo (232 kcal) ao lado de
 * 19g de gordura (171 kcal) são 3× em gramas mas só 1,36× em energia, e é a
 * energia que a proporção quer contar.
 */
function MacroBar({ protein, carbs, fat, preset, height = 10, raio = true }: BarProps) {
  const split = macroEnergySplit({ protein, carbs, fat });
  if (!split) return null;

  return (
    <View
      style={{
        height,
        borderRadius: raio ? height / 2 : 0,
        backgroundColor: preset.track,
      }}
      className="flex-row overflow-hidden"
    >
      {MACROS.map(({ key, fill }) => (
        <View key={key} style={{ width: `${split[key] * 100}%`, backgroundColor: fill }} />
      ))}
    </View>
  );
}

type BarProps = {
  protein: number;
  carbs: number;
  fat: number;
  preset: SharePreset;
  height?: number;
  raio?: boolean;
};

/** Bolinha + gramas + nome, uma coluna por macro. */
function MacroLegend({ protein, carbs, fat, preset, curto = false }: LegendProps) {
  const gramas = { protein, carbs, fat };
  return (
    <View className="flex-row" style={curto ? { gap: 14 } : undefined}>
      {MACROS.map(({ key, label, curto: sigla, fill }) => (
        <View
          key={key}
          className="flex-row items-center"
          style={{ gap: 6, flex: curto ? undefined : 1 }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: fill }} />
          {/* Uma string só, montada antes: `{n}g` vira DOIS nós de texto no
              DOM, e o html2canvas desenha cada nó como uma palavra separada —
              no PNG exportado saía "41 g" com espaço, enquanto "32g" (nó único
              por acaso do layout) saía certo. */}
          <Text style={[NUM, { color: preset.text, fontSize: 14 }]} className="font-sans-semibold">
            {`${Math.round(gramas[key])}g`}
          </Text>
          <Text style={{ color: preset.textDim, fontSize: 12 }} className="font-sans">
            {curto ? sigla : label}
          </Text>
        </View>
      ))}
    </View>
  );
}

type LegendProps = {
  protein: number;
  carbs: number;
  fat: number;
  preset: SharePreset;
  /** Siglas P/C/G em vez dos nomes, para caber numa linha compartilhada. */
  curto?: boolean;
};

/** Número grande com a unidade na mesma linha de base. */
function Hero({ value, unit, preset, size }: HeroProps) {
  return (
    <View className="flex-row items-baseline" style={{ gap: 6 }}>
      <Text
        style={[NUM, { color: preset.accent, fontSize: size, lineHeight: size * 1.02 }]}
        className="font-display-bold"
      >
        {value}
      </Text>
      {unit ? (
        <Text
          style={{ color: preset.textDim, fontSize: Math.round(size * 0.3) }}
          className="font-sans-medium"
        >
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

type HeroProps = { value: string; unit?: string; preset: SharePreset; size: number };

/**
 * Marca d'água: o lockup mais o endereço.
 *
 * O lockup passa pelo `ShareLogo`, que na web troca a `Image` do
 * react-native-web por uma `<img>` — sem isso o html2canvas o rasteriza no
 * tamanho CSS e ele sai borrado no PNG. O comentário longo está em
 * `share/ShareLogo.web.tsx`.
 *
 * O endereço vai junto de propósito: sem cabeçalho de autor, esta é a única
 * coisa no card que traz gente nova.
 */
function Brand({ preset, height = 18 }: { preset: SharePreset; height?: number }) {
  return (
    <View className="flex-row items-center justify-between">
      <ShareLogo height={height} variant={preset.logo} />
      <Text style={{ color: preset.textDim, fontSize: 12 }} className="font-sans">
        fitbrother.app
      </Text>
    </View>
  );
}

/** Data como sobrelinha do bloco de texto. */
function DateLine({ label, preset }: { label: string; preset: SharePreset }) {
  return (
    <Text
      style={[NUM, { color: preset.textDim, fontSize: 12, marginBottom: 8 }]}
      className="font-sans-medium uppercase"
    >
      {label}
    </Text>
  );
}

// ─── Quadro ──────────────────────────────────────────────────────────────────

/**
 * Card compartilhável, 9:16, pensado para virar story.
 *
 * **Sem raio nos cantos, de propósito.** O raio ficava dentro da captura, então
 * o PNG saía com os quatro cantos transparentes — postado num story com fundo
 * claro, o card aparecia com as pontas mordidas. Quem arredonda é o preview na
 * tela, por fora do nó capturado.
 *
 * **Sem cabeçalho de autor.** O story já mostra quem postou, na mesma faixa de
 * cima onde o cabeçalho ficava.
 *
 * O texto vive dentro da faixa segura (`STORY_SAFE_*`); a foto atravessa ela e
 * vai de ponta a ponta do quadro.
 */
export function ShareCard({ data, preset }: { data: ShareCardData; preset: SharePreset }) {
  const foto = preset.photo === "none" ? null : fotoDoCard(data);
  const preenche = Boolean(foto) && preset.photo === "fill";
  const emoldura = Boolean(foto) && preset.photo === "frame";
  const fundo = preset.background[1];

  return (
    <View
      style={{ width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, backgroundColor: fundo }}
      className="overflow-hidden"
    >
      {preenche ? (
        <>
          <Image
            source={{ uri: foto! }}
            accessibilityIgnoresInvertColors
            style={PREENCHE}
            resizeMode="cover"
          />
          <Scrim preset={preset} />
        </>
      ) : (
        <LinearGradient
          colors={preset.background}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={PREENCHE}
        />
      )}

      <View style={{ flex: 1, paddingTop: STORY_SAFE_TOP, paddingBottom: STORY_SAFE_BOTTOM }}>
        {emoldura ? (
          <View style={{ flex: 1, paddingHorizontal: PAD, paddingBottom: 22 }}>
            <Image
              source={{ uri: foto! }}
              accessibilityIgnoresInvertColors
              style={{ flex: 1, borderRadius: 18 }}
              resizeMode="cover"
            />
          </View>
        ) : null}

        <View
          style={{
            // `flexGrow`/`flexShrink` separados, não o atalho `flex`: `flex: 0`
            // no RN zera também o `flexBasis`, e o bloco de texto saía com
            // altura 0 — o texto transbordava por cima da foto emoldurada.
            flexGrow: emoldura ? 0 : 1,
            flexShrink: 0,
            // O pôster centraliza: sem foto, o número É a composição, e
            // ancorado embaixo deixava um vão de meio quadro em cima dele.
            justifyContent: preset.photo === "none" ? "center" : "flex-end",
            paddingHorizontal: PAD,
          }}
        >
          {data.kind === "insight" ? (
            <InsightBody data={data} preset={preset} poster={preset.photo === "none"} />
          ) : preset.info === "chip" ? (
            <EtiquetaBody data={data} preset={preset} />
          ) : preset.info === "line" ? (
            <DiscretoBody data={data} preset={preset} />
          ) : (
            <MealBody data={data} preset={preset} temFoto={preenche || emoldura} />
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * O véu entre a foto e o texto.
 *
 * A força depende de quanta informação vai por cima. No modo `chip` não existe
 * scrim nenhum — a etiqueta carrega o próprio contraste e a foto fica intacta,
 * que é o ponto daquele preset.
 */
function Scrim({ preset }: { preset: SharePreset }) {
  if (preset.info === "chip") return null;
  const fundo = preset.background[1];

  // Fecha em 0.92, e não em 1: a faixa segura de baixo tem 96dp, e com o scrim
  // opaco ela virava uma tarja chapada ocupando um sexto do card. Em 0.92 a
  // comida ainda se adivinha ali embaixo, e o contraste continua de sobra.
  // A última parada do `line` vai até 1: parando antes, o trecho abaixo dela
  // fica na cor final chapada, e no quadro isso aparecia como uma tarja escura
  // ocupando a faixa segura de baixo. Indo até a borda, a rampa nunca para — o
  // ponto mais escuro é a última linha de pixels.
  const paradas: [string, string, string] =
    preset.info === "line"
      ? [withAlpha(fundo, 0), withAlpha(fundo, 0.28), withAlpha(fundo, 0.8)]
      : [withAlpha(fundo, 0), withAlpha(fundo, 0.55), withAlpha(fundo, 0.92)];
  const alturas: [number, number, number] =
    preset.info === "line" ? [0.4, 0.72, 1] : [0, 0.42, 0.72];

  return <LinearGradient colors={paradas} locations={alturas} style={PREENCHE} />;
}

// ─── Corpos ──────────────────────────────────────────────────────────────────

function MealBody({
  data,
  preset,
  temFoto,
}: {
  data: Extract<ShareCardData, { kind: "meal" }>;
  preset: SharePreset;
  temFoto: boolean;
}) {
  // Sem foto o pôster manda: o número vira o quadro inteiro. Com foto ele cede
  // a cena para ela e volta ao tamanho de manchete.
  const poster = preset.photo === "none";

  return (
    <>
      <DateLine label={data.dateLabel} preset={preset} />

      {data.headline ? (
        <Text
          style={{
            color: preset.text,
            // A legenda é apoio quando há foto (a foto já conta o que é), e
            // manchete quando não há.
            fontSize: temFoto ? 18 : poster ? 16 : 26,
            lineHeight: temFoto ? 24 : poster ? 22 : 33,
            marginBottom: temFoto ? 14 : 10,
          }}
          className={temFoto || poster ? "font-sans-medium" : "font-display-bold"}
        >
          {truncate(data.headline, temFoto ? 74 : poster ? 58 : 104)}
        </Text>
      ) : null}

      <Hero
        value={String(Math.round(data.kcal))}
        unit="kcal"
        preset={preset}
        size={poster ? 104 : 54}
      />

      <View style={{ marginTop: 18 }}>
        <MacroBar
          protein={data.protein_g}
          carbs={data.carbs_g}
          fat={data.fat_g}
          preset={preset}
          height={poster ? 14 : 10}
        />
        <View style={{ marginTop: 12 }}>
          <MacroLegend
            protein={data.protein_g}
            carbs={data.carbs_g}
            fat={data.fat_g}
            preset={preset}
          />
        </View>
      </View>

      <View style={{ marginTop: 22 }}>
        <Brand preset={preset} />
      </View>
    </>
  );
}

/**
 * Minimalista, versão etiqueta: a foto inteira limpa, os números numa plaquinha.
 *
 * Nada de scrim, nada de legenda — quem escolhe este preset quer postar a
 * comida, e o dado entra como uma anotação colada por cima. A etiqueta é opaca
 * justamente para poder ser pequena: é ela que garante contraste, então não
 * precisa escurecer a foto toda para o texto aparecer.
 */
function EtiquetaBody({
  data,
  preset,
}: {
  data: Extract<ShareCardData, { kind: "meal" }>;
  preset: SharePreset;
}) {
  return (
    <View
      style={[
        shadows.card,
        { backgroundColor: preset.background[1], borderRadius: 20, padding: 16 },
      ]}
    >
      <View className="flex-row items-baseline justify-between">
        <Hero value={String(Math.round(data.kcal))} unit="kcal" preset={preset} size={30} />
        <Text style={[NUM, { color: preset.textDim, fontSize: 12 }]} className="font-sans-medium">
          {data.dateLabel}
        </Text>
      </View>

      <View style={{ marginTop: 12 }}>
        <MacroBar
          protein={data.protein_g}
          carbs={data.carbs_g}
          fat={data.fat_g}
          preset={preset}
          height={8}
        />
      </View>

      <View style={{ marginTop: 12 }}>
        <MacroLegend
          protein={data.protein_g}
          carbs={data.carbs_g}
          fat={data.fat_g}
          preset={preset}
          curto
        />
      </View>

      <View
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: preset.track,
        }}
      >
        <Brand preset={preset} height={15} />
      </View>
    </View>
  );
}

/**
 * Minimalista, versão discreta: sem caixa nenhuma.
 *
 * Uma linha de números sobre a foto e a barra de macros virando um fio no pé do
 * quadro — o mesmo movimento que o card de refeição da Home faz, onde a
 * proporção deixa de ser um elemento pousado e vira a borda. É o preset que
 * mais mostra a comida: só um véu curto embaixo, o suficiente para o texto
 * branco não sumir numa foto clara.
 */
function DiscretoBody({
  data,
  preset,
}: {
  data: Extract<ShareCardData, { kind: "meal" }>;
  preset: SharePreset;
}) {
  return (
    <>
      <View className="flex-row items-baseline" style={{ gap: 10 }}>
        <Hero value={String(Math.round(data.kcal))} unit="kcal" preset={preset} size={34} />
      </View>

      <View style={{ marginTop: 10 }}>
        <MacroLegend
          protein={data.protein_g}
          carbs={data.carbs_g}
          fat={data.fat_g}
          preset={preset}
          curto
        />
      </View>

      {/* O fio sai do `paddingHorizontal` do pai com margens negativas para
          alcançar as bordas do quadro. Fica ENTRE os números e a marca, não
          depois dela: no fim do bloco ele sobrava como um risco solto, com a
          faixa segura vazia embaixo. No meio, ele separa o dado da assinatura e
          fecha a composição. Sem raio — é uma régua, não uma barra. */}
      <View style={{ marginTop: 18, marginHorizontal: -PAD }}>
        <MacroBar
          protein={data.protein_g}
          carbs={data.carbs_g}
          fat={data.fat_g}
          preset={preset}
          height={5}
          raio={false}
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <Brand preset={preset} height={16} />
      </View>
    </>
  );
}

function InsightBody({
  data,
  preset,
  poster,
}: {
  data: Extract<ShareCardData, { kind: "insight" }>;
  preset: SharePreset;
  poster: boolean;
}) {
  return (
    <>
      <DateLine label={data.dateLabel} preset={preset} />

      {data.score !== null ? (
        <View style={{ marginBottom: 12 }}>
          <Hero value={String(data.score)} unit="/ 100" preset={preset} size={poster ? 104 : 64} />
        </View>
      ) : null}

      <Text
        style={{ color: preset.text, fontSize: 27, lineHeight: 33 }}
        className="font-display-bold"
      >
        {truncate(data.title, 58)}
      </Text>
      <Text
        style={{ color: preset.text, fontSize: 17, lineHeight: 23, marginTop: 10 }}
        className="font-sans-medium"
      >
        {truncate(data.headline, 108)}
      </Text>

      {/* No pôster o placar toma o quadro e os bullets não cabem — nem devem:
          o preset existe para dizer uma coisa só, em corpo grande. */}
      {poster ? null : (
        <View style={{ marginTop: 18, gap: 10 }}>
          {data.bullets.slice(0, 3).map((b, i) => (
            <View key={i} className="flex-row" style={{ gap: 10 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  marginTop: 7,
                  backgroundColor: preset.accent,
                }}
              />
              <Text
                style={{ color: preset.textDim, fontSize: 14, lineHeight: 20, flex: 1 }}
                className="font-sans"
              >
                {truncate(b, 88)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ marginTop: 22 }}>
        <Brand preset={preset} />
      </View>
    </>
  );
}
