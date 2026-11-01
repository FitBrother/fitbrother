import { describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import type { StoryCardData } from "./StoryCard";

jest.mock("@/lib/share-card", () => ({
  captureCard: jest.fn(),
  shareCard: jest.fn(),
  saveCardToGallery: jest.fn(),
  podeCompartilharArquivos: () => true,
}));
jest.mock("@/lib/toast/toast-context", () => ({ useToast: () => jest.fn() }));

let mockCaixas: { value: Record<string, unknown> } = { value: {} };

// No nativo a escrita num shared value vinda do JS entra numa fila e só vale
// depois da tarefa atual. Aqui só as medidas têm esse atraso, porque são elas
// que dependem da ordem; o setter do jest e o da web são síncronos.
jest.mock("react-native-reanimated", () => {
  const real =
    jest.requireActual<typeof import("react-native-reanimated")>("react-native-reanimated");
  const { useRef } = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    ...real,
    default: real.default,
    useSharedValue: (inicial: unknown) => {
      const atrasado = useRef<{ value: unknown } | null>(null);
      const vazio =
        typeof inicial === "object" &&
        inicial !== null &&
        !Array.isArray(inicial) &&
        Object.keys(inicial).length === 0;
      const normal = real.useSharedValue(inicial);
      if (!vazio) return normal;
      if (!atrasado.current) {
        let atual = inicial;
        atrasado.current = {
          get value() {
            return atual;
          },
          set value(novo) {
            queueMicrotask(() => {
              atual = novo;
            });
          },
        };
      }
      return atrasado.current;
    },
  };
});

jest.mock("./useStoryGestos", () => {
  const { Gesture } = jest.requireActual<typeof import("react-native-gesture-handler")>(
    "react-native-gesture-handler",
  );
  const { useSharedValue } =
    jest.requireActual<typeof import("react-native-reanimated")>("react-native-reanimated");
  return {
    useStoryGestos: ({ caixas }: { caixas: { value: Record<string, unknown> } }) => {
      mockCaixas = caixas;
      return { gesto: Gesture.Tap(), sobreLixeira: useSharedValue(false) };
    },
  };
});

import { StoryEditor } from "./StoryEditor";

const DADOS: StoryCardData = {
  kind: "meal",
  headline: "Frango grelhado",
  imageUrl: null,
  temFotoSalva: false,
  kcal: 612,
  protein_g: 48,
  carbs_g: 58,
  fat_g: 19,
  dateLabel: "11 out",
};

describe("StoryEditor, medidas dos stickers", () => {
  test("medidas da mesma leva não se perdem umas das outras", async () => {
    const r = render(
      <StoryEditor
        data={DADOS}
        foto="blob:foto"
        fotoNatural={{ width: 1080, height: 1920 }}
        presetInicial="completo"
        vinhetaInicial
        onVoltar={jest.fn()}
        onExportar={jest.fn()}
      />,
    );
    fireEvent(r.getByTestId("area-editor"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 760 } },
    });

    const ids = ["calorias", "data", "itens", "logo", "macros"];
    for (const id of ids) {
      fireEvent(r.getByTestId(`animado-${id}`), "layout", {
        nativeEvent: { layout: { x: 10, y: 10, width: 50, height: 20 } },
      });
    }
    await act(async () => {});

    expect(Object.keys(mockCaixas.value).sort()).toEqual(ids);
  });
});
