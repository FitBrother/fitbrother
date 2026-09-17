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
let mockPathname = "/";
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
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

const mockPatchAccountSettings = jest.fn<() => Promise<{ settings: Record<string, unknown> }>>();
jest.mock("@/lib/api/account", () => ({
  patchAccountSettings: (...args: unknown[]) => mockPatchAccountSettings(...args),
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

beforeEach(() => {
  mockPush.mockReset();
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
    fireEvent.press(getByTestId("next")); // social-tab
    fireEvent.press(getByTestId("next")); // analises-tab
    fireEvent.press(getByTestId("next")); // profile-avatar
    fireEvent.press(getByTestId("next")); // profile-shortcut-card (último — ainda visível)
    expect(getByTestId("step")).toHaveTextContent("profile-shortcut-card");
    fireEvent.press(getByTestId("next")); // "Entendi" no último passo: conclui
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

  test("startTour não faz nada se o tour já está ativo", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next")); // social-tab
    fireEvent.press(getByTestId("start")); // não deve voltar pro passo 1
    expect(getByTestId("step")).toHaveTextContent("social-tab");
  });

  test("no layout desktop (width >= 1024) o tour não inicia", () => {
    mockLarguraJanela = 1024;
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    expect(getByTestId("active")).toHaveTextContent("false");
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

describe("navegação automática pro Perfil", () => {
  test("ao entrar no passo profile-avatar, navega se ainda não está lá", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next")); // social-tab
    fireEvent.press(getByTestId("next")); // analises-tab
    fireEvent.press(getByTestId("next")); // profile-avatar
    expect(mockPush).toHaveBeenCalledWith("/(app)/profile");
  });

  test("não navega de novo se já está no Perfil", () => {
    mockPathname = "/profile";
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next"));
    fireEvent.press(getByTestId("next"));
    fireEvent.press(getByTestId("next"));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("passo sem atalho pra instalar", () => {
  test("com status native, o último passo é profile-avatar", () => {
    mockInstallStatus = "native";
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start")); // home-tab
    fireEvent.press(getByTestId("next")); // social-tab
    fireEvent.press(getByTestId("next")); // analises-tab
    fireEvent.press(getByTestId("next")); // profile-avatar (último, sem passo de atalho)
    expect(getByTestId("step")).toHaveTextContent("profile-avatar");
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
