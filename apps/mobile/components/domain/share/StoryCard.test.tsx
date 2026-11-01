import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { arranjoInicial, stickersDoPreset, type Sticker } from "@/lib/share/story";
import { presetPorId } from "@/lib/share/story-presets";
import { conteudoDoStory, StoryCard, temMacros, type StoryCardData } from "./StoryCard";

const REFEICAO: StoryCardData = {
  kind: "meal",
  headline: "Peito de frango grelhado · arroz",
  imageUrl: "https://x/foto.jpg",
  temFotoSalva: true,
  kcal: 612,
  protein_g: 48,
  carbs_g: 58,
  fat_g: 19,
  dateLabel: "11 out",
};

const ANALISE: StoryCardData = {
  kind: "insight",
  title: "Semana forte",
  headline: "Bateu a proteína cinco dias",
  bullets: ["Café reforçado"],
  score: 82,
  dateLabel: "11 out",
};

function arranjo(preset: Parameters<typeof presetPorId>[0], data = REFEICAO as StoryCardData) {
  return arranjoInicial(stickersDoPreset(preset, conteudoDoStory(data)));
}

function estilo(el: { props: { style: unknown } }) {
  return StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;
}

describe("conteudoDoStory", () => {
  test("lê o que a refeição tem", () => {
    expect(conteudoDoStory(REFEICAO)).toEqual({
      kind: "meal",
      temLegenda: true,
      temMacros: true,
      temNota: false,
    });
  });

  test("lê a nota da análise", () => {
    expect(conteudoDoStory({ ...ANALISE, score: null }).temNota).toBe(false);
  });

  test("zero caloria de macro é sem macros", () => {
    expect(temMacros({ ...REFEICAO, protein_g: 0, carbs_g: 0, fat_g: 0 })).toBe(false);
  });
});

describe("StoryCard", () => {
  test("refeição mostra número, itens e logo", () => {
    const { getByText, getByLabelText } = render(
      <StoryCard
        data={REFEICAO}
        preset={presetPorId("completo")}
        stickers={arranjo("completo")}
        vinheta
      />,
    );
    expect(getByText("612")).toBeTruthy();
    expect(getByText(/frango grelhado/)).toBeTruthy();
    expect(getByLabelText("Fitbrother")).toBeTruthy();
  });

  test("análise mostra título e nota", () => {
    const { getByText } = render(
      <StoryCard
        data={ANALISE}
        preset={presetPorId("poster")}
        stickers={arranjo("poster", ANALISE)}
        vinheta={false}
      />,
    );
    expect(getByText("Semana forte")).toBeTruthy();
    expect(getByText("82")).toBeTruthy();
  });

  test("sticker removido some, mas continua no fluxo", () => {
    const stickers: Sticker[] = arranjo("completo").map((s) =>
      s.id === "itens" ? { ...s, removido: true } : s,
    );
    const { getByTestId } = render(
      <StoryCard data={REFEICAO} preset={presetPorId("completo")} stickers={stickers} vinheta />,
    );
    expect(estilo(getByTestId("sticker-itens")).opacity).toBe(0);
  });

  test("aplica o transform de cada sticker", () => {
    const stickers = arranjo("completo").map((s) => (s.id === "calorias" ? { ...s, dx: 12 } : s));
    const { getByTestId } = render(
      <StoryCard data={REFEICAO} preset={presetPorId("completo")} stickers={stickers} vinheta />,
    );
    expect(estilo(getByTestId("sticker-calorias")).transform).toContainEqual({ translateX: 12 });
  });

  test("a vinheta precisa estar ligada e ter foto", () => {
    const base = {
      data: REFEICAO,
      preset: presetPorId("completo"),
      stickers: arranjo("completo"),
    };
    const ligada = render(<StoryCard {...base} vinheta foto="blob:x" />);
    expect(ligada.queryByTestId("vinheta")).toBeTruthy();

    const desligada = render(<StoryCard {...base} vinheta={false} foto="blob:x" />);
    expect(desligada.queryByTestId("vinheta")).toBeNull();

    const semFoto = render(<StoryCard {...base} vinheta foto={null} />);
    expect(semFoto.queryByTestId("vinheta")).toBeNull();
  });

  test("com a câmera atrás, fundo transparente e sem foto do dado", () => {
    const { getByTestId, queryByTestId } = render(
      <StoryCard
        data={REFEICAO}
        preset={presetPorId("completo")}
        stickers={arranjo("completo")}
        vinheta
        foto="blob:x"
        fotoExterna
        testID="card"
      />,
    );
    expect(estilo(getByTestId("card")).backgroundColor).toBe("transparent");
    expect(queryByTestId("foto-do-card")).toBeNull();
    expect(queryByTestId("vinheta")).toBeTruthy();
  });

  test("sem câmera, o fundo é ink chapado", () => {
    const { getByTestId } = render(
      <StoryCard
        data={REFEICAO}
        preset={presetPorId("poster")}
        stickers={arranjo("poster")}
        vinheta
        testID="card"
      />,
    );
    expect(estilo(getByTestId("card")).backgroundColor).toBe("#04100C");
  });

  test("Etiqueta: remover a placa mantém o logo", () => {
    const stickers = arranjo("etiqueta").map((s) =>
      s.id === "placa" ? { ...s, removido: true } : s,
    );
    const { getByTestId } = render(
      <StoryCard data={REFEICAO} preset={presetPorId("etiqueta")} stickers={stickers} vinheta />,
    );
    expect(estilo(getByTestId("sticker-placa")).opacity).toBe(0);
    expect(estilo(getByTestId("sticker-logo")).opacity).toBe(1);
  });

  test("avisa a caixa de cada sticker ao medir", () => {
    const aoMedir = jest.fn();
    const { getByTestId } = render(
      <StoryCard
        data={REFEICAO}
        preset={presetPorId("completo")}
        stickers={arranjo("completo")}
        vinheta
        aoMedir={aoMedir}
      />,
    );
    fireEvent(getByTestId("sticker-logo"), "layout", {
      nativeEvent: { layout: { x: 26, y: 500, width: 112, height: 34 } },
    });
    expect(aoMedir).toHaveBeenCalledWith("logo", { x: 26, y: 500, width: 112, height: 34 });
  });

  test("usa a caixa animada quando recebe uma", () => {
    const { View } = jest.requireActual<typeof import("react-native")>("react-native");
    const Caixa = ({ sticker, children }: { sticker: Sticker; children: React.ReactNode }) => (
      <View testID={`animada-${sticker.id}`}>{children}</View>
    );
    const { getByTestId } = render(
      <StoryCard
        data={REFEICAO}
        preset={presetPorId("completo")}
        stickers={arranjo("completo")}
        vinheta
        CaixaSticker={Caixa}
      />,
    );
    expect(getByTestId("animada-calorias")).toBeTruthy();
  });
});
