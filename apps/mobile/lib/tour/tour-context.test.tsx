import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

// O import do módulo sob teste (`./tour-context`) precisa vir DEPOIS de todo
// mock abaixo — ele é o gatilho que carrega "expo-router" etc. pela primeira
// vez, e as factories de `jest.mock` (hoisted acima de tudo pelo babel, mas
// executadas só nesse require) leem `mock*` por closure. Se o import viesse
// antes das `const mock* = jest.fn()`, essas variáveis ainda não existiriam
// quando a factory rodasse (mesmo padrão de `HomeHeader.test.tsx`).
const mockPush = jest.fn();
const mockDismissTo = jest.fn();
let mockPathname = "/";
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, dismissTo: mockDismissTo }),
  usePathname: () => mockPathname,
}));

const mockProfile: { tutorial_completed_at: string | null } = { tutorial_completed_at: null };
const mockUpdate = jest.fn();
jest.mock("@/lib/profile/profile-context", () => ({
  useProfile: () => mockProfile,
  useProfileActions: () => ({ update: mockUpdate, refresh: jest.fn() }),
}));

let mockInstallStatus: string = "installable-chrome";
jest.mock("@/lib/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({ status: mockInstallStatus }),
}));

const mockPatchAccountSettings =
  jest.fn<(body: { tutorial_completed: true }) => Promise<{ settings: Record<string, unknown> }>>();
jest.mock("@/lib/api/account", () => ({
  patchAccountSettings: (body: { tutorial_completed: true }) => mockPatchAccountSettings(body),
}));

let mockLarguraJanela = 375;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockLarguraJanela, height: 812, scale: 2, fontScale: 1 }),
}));

import { TourProvider, useTour } from "./tour-context";

function Consumer() {
  const tour = useTour();
  return (
    <>
      <Text testID="active">{String(tour.active)}</Text>
      <Text testID="step">{tour.currentStepId ?? "none"}</Text>
      <Pressable testID="start" onPress={tour.startTour} accessibilityRole="button" />
      <Pressable testID="next" onPress={tour.next} accessibilityRole="button" />
      <Pressable testID="skip" onPress={tour.skip} accessibilityRole="button" />
      <Pressable
        testID="meal-created"
        onPress={tour.notifyMealCreated}
        accessibilityRole="button"
      />
    </>
  );
}

function renderTour() {
  return render(
    <TourProvider>
      <Consumer />
    </TourProvider>,
  );
}

function pressNextUntil(getByTestId: ReturnType<typeof renderTour>["getByTestId"], stepId: string) {
  for (let i = 0; i < 12; i++) {
    if (getByTestId("step").props.children === stepId) return;
    fireEvent.press(getByTestId("next"));
  }
  throw new Error(`não chegou em ${stepId}`);
}

beforeEach(() => {
  mockPush.mockReset();
  mockDismissTo.mockReset();
  mockPathname = "/";
  mockProfile.tutorial_completed_at = null;
  mockUpdate.mockReset();
  mockInstallStatus = "installable-chrome";
  mockLarguraJanela = 375;
  mockPatchAccountSettings.mockReset();
  mockPatchAccountSettings.mockResolvedValue({
    settings: {
      timezone: "America/Sao_Paulo",
      day_start_hour: 0,
      updated_at: "now",
      tutorial_completed_at: "now",
    },
  });
});

describe("início e avanço do tour", () => {
  test("startTour começa no primeiro passo", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    expect(getByTestId("active")).toHaveTextContent("true");
    expect(getByTestId("step")).toHaveTextContent("home-tab");
  });

  test("next avança pra sequência aprovada", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next"));
    expect(getByTestId("step")).toHaveTextContent("social-tab");
    fireEvent.press(getByTestId("next"));
    expect(getByTestId("step")).toHaveTextContent("analises-tab");
  });

  test("next no último passo encerra o tour e persiste no servidor", async () => {
    const { getByTestId, findByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    pressNextUntil(getByTestId, "goals-editor");
    fireEvent.press(getByTestId("next")); // "Concluir"
    expect(await findByTestId("active")).toHaveTextContent("false");
    expect(mockPatchAccountSettings).toHaveBeenCalledWith({ tutorial_completed: true });
  });

  test("skip encerra o tour em qualquer passo e persiste", async () => {
    const { getByTestId, findByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("skip"));
    expect(await findByTestId("active")).toHaveTextContent("false");
    expect(mockPatchAccountSettings).toHaveBeenCalledWith({ tutorial_completed: true });
  });

  test("startTour fora da Home volta pra Home (replay via Configurações)", () => {
    mockPathname = "/settings";
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    expect(mockDismissTo).toHaveBeenCalledWith("/(app)");
    expect(getByTestId("step")).toHaveTextContent("home-tab");
  });

  test("startTour na Home não navega", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  test("startTour não faz nada se o tour já está ativo", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next")); // social-tab
    fireEvent.press(getByTestId("start")); // não deve voltar pro passo 1
    expect(getByTestId("step")).toHaveTextContent("social-tab");
  });

  test("no layout desktop (web ≥ 1024) o tour inicia", () => {
    mockLarguraJanela = 1280;
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    expect(getByTestId("active")).toHaveTextContent("true");
  });
});

describe("gatilho do primeiro registro", () => {
  test("notifyMealCreated inicia o tour quando tutorial_completed_at é null", () => {
    mockProfile.tutorial_completed_at = null;
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("meal-created"));
    expect(getByTestId("active")).toHaveTextContent("true");
  });

  test("notifyMealCreated não faz nada quando o tour já foi concluído antes", () => {
    mockProfile.tutorial_completed_at = "2026-01-01T00:00:00Z";
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("meal-created"));
    expect(getByTestId("active")).toHaveTextContent("false");
  });
});

describe("navegação do roteiro", () => {
  test("no desktop, Social e Análises abrem Feed e Insights", () => {
    mockLarguraJanela = 1280;
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next")); // social-tab
    expect(mockPush).toHaveBeenCalledWith("/(app)/feed");
    fireEvent.press(getByTestId("next")); // analises-tab
    expect(mockPush).toHaveBeenCalledWith("/(app)/insights");
  });

  test("empurra Histórico, Perfil e Metas nos passos dessas telas", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    pressNextUntil(getByTestId, "history-day");
    expect(mockPush).toHaveBeenCalledWith("/(app)/history");
    pressNextUntil(getByTestId, "profile-shortcut-card");
    expect(mockPush).toHaveBeenCalledWith("/(app)/profile");
    pressNextUntil(getByTestId, "goals-editor");
    expect(mockPush).toHaveBeenCalledWith("/(app)/goals");
  });

  test("volta do Histórico pra Home com dismissTo no passo do avatar", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    pressNextUntil(getByTestId, "history-day");
    mockPathname = "/history";
    fireEvent.press(getByTestId("next")); // home-avatar
    expect(mockDismissTo).toHaveBeenCalledWith("/(app)");
  });

  test("não navega se já está na tela do passo", () => {
    mockPathname = "/profile";
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    pressNextUntil(getByTestId, "profile-goals");
    expect(mockPush).not.toHaveBeenCalledWith("/(app)/profile");
  });
});

describe("fim do tour", () => {
  test("concluir fora da Home volta pra Home", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    // Antes de chegar no último passo: o pathname entra no próximo render e o
    // finish() lê o valor renderizado (pathnameRef).
    mockPathname = "/goals";
    pressNextUntil(getByTestId, "goals-editor");
    mockDismissTo.mockReset();
    fireEvent.press(getByTestId("next"));
    expect(mockDismissTo).toHaveBeenCalledWith("/(app)");
  });

  test("pular na Home não navega", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("skip"));
    expect(mockDismissTo).not.toHaveBeenCalled();
  });
});

describe("passo sem atalho pra instalar", () => {
  test("com status native, do avatar vai direto pra Metas e macros", () => {
    mockInstallStatus = "native";
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    pressNextUntil(getByTestId, "home-avatar");
    fireEvent.press(getByTestId("next"));
    expect(getByTestId("step")).toHaveTextContent("profile-goals");
  });
});

describe("rede de segurança de alvo ausente", () => {
  test("avança sozinho se o alvo do passo não registra em ~2s", () => {
    jest.useFakeTimers();
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    expect(getByTestId("step")).toHaveTextContent("home-tab");
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByTestId("step")).toHaveTextContent("social-tab");
    jest.useRealTimers();
  });
});
