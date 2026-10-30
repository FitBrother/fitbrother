import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { ShareCard, type ShareCardData } from "./ShareCard";
import { presetAt, presetsAoVivo } from "@/lib/share/presets";

const DADOS: ShareCardData = {
  kind: "meal",
  headline: "Peito de frango grelhado · arroz",
  imageUrl: null,
  kcal: 612,
  protein_g: 48,
  carbs_g: 58,
  fat_g: 19,
  dateLabel: "11 out",
};

const NOTURNO = presetAt(presetsAoVivo({ temMacros: true }), 0);

describe("ShareCard com fotoExterna", () => {
  test("trata o quadro como tendo foto, e a legenda vira apoio", () => {
    // O teste do plano era `getByText("612")` + a manchete, mas isso passa sem
    // implementação nenhuma: `imageUrl: null` cai no ramo sem-foto, que também
    // desenha kcal e legenda. O que a prop compra de fato é o card tratar o
    // quadro como tendo foto — e aí a legenda é APOIO (18px) em vez de
    // manchete (26px), porque a foto da câmera já conta o que é o prato.
    const comCamera = render(<ShareCard data={DADOS} preset={NOTURNO} fotoExterna />);
    expect(comCamera.getByText(/frango grelhado/).props.style).toMatchObject({ fontSize: 18 });

    const semNada = render(<ShareCard data={DADOS} preset={NOTURNO} />);
    expect(semNada.getByText(/frango grelhado/).props.style).toMatchObject({ fontSize: 26 });
  });

  test("desenha o corpo inteiro com a foto vindo de trás", () => {
    const { getByText } = render(<ShareCard data={DADOS} preset={NOTURNO} fotoExterna />);

    expect(getByText("612")).toBeTruthy();
    expect(getByText(/frango grelhado/)).toBeTruthy();
  });

  test("o fundo fica transparente para a câmera aparecer", () => {
    const { getByTestId } = render(
      <ShareCard data={DADOS} preset={NOTURNO} fotoExterna testID="share-card" />,
    );

    const style = getByTestId("share-card").props.style;
    expect(style).toMatchObject({ backgroundColor: "transparent" });
  });

  test("com fotoExterna não pinta a foto do dado por cima da câmera", () => {
    // O caso de produção: a refeição JÁ tem foto (image_path, backfill da 0082)
    // e a pessoa abre a câmera para tirar outra. Sem o guard, o card desenharia
    // a foto velha por cima do vídeo ao vivo — todos os fixtures usavam
    // imageUrl: null, então nada pegava isso.
    const comFoto = { ...DADOS, imageUrl: "https://exemplo.test/prato.jpg" };

    const camera = render(<ShareCard data={comFoto} preset={NOTURNO} fotoExterna />);
    expect(camera.queryAllByTestId("foto-do-card")).toHaveLength(0);

    const normal = render(<ShareCard data={comFoto} preset={NOTURNO} />);
    expect(normal.queryAllByTestId("foto-do-card")).toHaveLength(1);
  });

  test("sem fotoExterna o fundo continua opaco", () => {
    const { getByTestId } = render(<ShareCard data={DADOS} preset={NOTURNO} testID="share-card" />);

    const style = getByTestId("share-card").props.style;
    expect(style.backgroundColor).not.toBe("transparent");
  });
});
