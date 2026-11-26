import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MealResponse } from "@fitbrother/shared";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const mockGetMeal = jest.fn<(id: string) => Promise<MealResponse>>();
const mockConfirm = jest.fn<(opts: { title: string }) => Promise<boolean>>();

jest.mock("@/lib/api/meals", () => ({ getMeal: (id: string) => mockGetMeal(id) }));
jest.mock("@/lib/dialog/dialog-context", () => ({ useDialog: () => ({ confirm: mockConfirm }) }));
jest.mock("@/components/domain/ConfirmMealDrawer", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native") as typeof import("react-native");
  return {
    ConfirmMealDrawer: ({
      meal,
      onClose,
      onDirtyChange,
    }: {
      meal: MealResponse;
      onClose: () => void;
      onDirtyChange?: (dirty: boolean) => void;
    }) => (
      <>
        <RN.Text>{`drawer:${meal.items[0]?.description ?? ""}`}</RN.Text>
        <RN.Pressable accessibilityLabel="edit" onPress={() => onDirtyChange?.(true)} />
        <RN.Pressable accessibilityLabel="done" onPress={onClose} />
      </>
    ),
  };
});

import {
  ConfirmMealBackground,
  ConfirmMealHost,
  ConfirmMealProvider,
  useConfirmMealSheet,
} from "./confirm-meal-context";
import { mealDetailKey } from "@/lib/hooks/useMealsForDay";

const pending = {
  id: MEAL_ID,
  meal_type: "lunch",
  consumed_at: new Date(2026, 10, 24, 12, 40).toISOString(),
  review_required: true,
  items: [{ id: "i1", description: "Arroz cozido", quantity: 100, unit: "g", kcal: 128 }],
} as unknown as MealResponse;
const confirmed = { ...pending, review_required: false } as MealResponse;

const metrics = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

function Opener() {
  const sheet = useConfirmMealSheet();
  return (
    <>
      <Pressable accessibilityLabel="open" onPress={() => sheet.open(MEAL_ID)} />
      <Pressable accessibilityLabel="close-api" onPress={() => sheet.close()} />
    </>
  );
}

let client: QueryClient;

function renderHost() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <SafeAreaProvider initialMetrics={metrics}>
        <ConfirmMealProvider>
          <Opener />
          <ConfirmMealBackground testID="behind">
            <Text>tela de trás</Text>
          </ConfirmMealBackground>
          <ConfirmMealHost />
        </ConfirmMealProvider>
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

const DRAWER_TEXT = "drawer:Arroz cozido";
// Siblings of the modal drawer count as hidden for queries, like for a screen reader.
const ALL = { includeHiddenElements: true };

async function openPending() {
  mockGetMeal.mockResolvedValue(pending);
  renderHost();
  fireEvent.press(screen.getByLabelText("open"));
  await screen.findByText(DRAWER_TEXT);
}

async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });
  }
}

// Two passes: query notifications are timer-scheduled and the exit timer starts in the effect they trigger.
function finishExit() {
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  act(() => {
    jest.advanceTimersByTime(1000);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  client?.clear();
  jest.useRealTimers();
});

describe("confirm meal host", () => {
  test("opening shows the drawer for a pending meal", async () => {
    await openPending();
    expect(mockGetMeal).toHaveBeenCalledWith(MEAL_ID);
    expect(screen.getByLabelText("Confirme sua refeição")).toBeTruthy();
  });

  test("renders nothing while the meal loads", () => {
    mockGetMeal.mockReturnValue(new Promise(() => {}));
    renderHost();
    fireEvent.press(screen.getByLabelText("open"));
    expect(screen.queryByTestId("bottom-drawer-overlay")).toBeNull();
    expect(screen.queryByText(DRAWER_TEXT)).toBeNull();
  });

  test("a meal that is already confirmed closes by itself", async () => {
    mockGetMeal.mockResolvedValue(confirmed);
    renderHost();
    fireEvent.press(screen.getByLabelText("open"));
    await waitFor(() => expect(mockGetMeal).toHaveBeenCalled());
    await settle();

    act(() => client.setQueryData(mealDetailKey(MEAL_ID), pending));
    finishExit();
    expect(screen.queryByText(DRAWER_TEXT)).toBeNull();
  });

  test("a meal confirmed elsewhere while open closes the drawer", async () => {
    await openPending();
    act(() => client.setQueryData(mealDetailKey(MEAL_ID), confirmed));
    finishExit();
    expect(screen.queryByText(DRAWER_TEXT)).toBeNull();

    act(() => client.setQueryData(mealDetailKey(MEAL_ID), pending));
    finishExit();
    expect(screen.queryByText(DRAWER_TEXT)).toBeNull();
  });

  test("a 404 closes it", async () => {
    mockGetMeal.mockRejectedValue(Object.assign(new Error("not_found"), { status: 404 }));
    renderHost();
    fireEvent.press(screen.getByLabelText("open"));
    await waitFor(() => expect(mockGetMeal).toHaveBeenCalled());
    await settle();

    act(() => client.setQueryData(mealDetailKey(MEAL_ID), pending));
    finishExit();
    expect(screen.queryByText(DRAWER_TEXT)).toBeNull();
    expect(screen.queryByTestId("bottom-drawer-overlay")).toBeNull();
  });

  test("closing without edits does not ask and keeps the meal", async () => {
    await openPending();
    fireEvent.press(screen.getByLabelText("Fechar"));
    finishExit();

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText(DRAWER_TEXT)).toBeNull();
    expect(client.getQueryData(mealDetailKey(MEAL_ID))).toEqual(pending);
  });

  test("closing with edits asks and respects cancel", async () => {
    await openPending();
    fireEvent.press(screen.getByLabelText("edit"));

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Fechar"));
    });
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Descartar alterações?", destructive: true }),
    );
    finishExit();
    expect(screen.getByText(DRAWER_TEXT)).toBeTruthy();

    mockConfirm.mockResolvedValueOnce(true);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Fechar"));
    });
    finishExit();
    expect(screen.queryByText(DRAWER_TEXT)).toBeNull();
  });

  test("the last meal stays mounted while the exit animation runs", async () => {
    await openPending();
    fireEvent.press(screen.getByLabelText("done"));

    expect(screen.getByText(DRAWER_TEXT)).toBeTruthy();
    finishExit();
    expect(screen.queryByText(DRAWER_TEXT)).toBeNull();
  });

  test("dirty is reset when the drawer is opened again", async () => {
    await openPending();
    fireEvent.press(screen.getByLabelText("edit"));
    fireEvent.press(screen.getByLabelText("done"));
    finishExit();

    fireEvent.press(screen.getByLabelText("open", ALL));
    await screen.findByText(DRAWER_TEXT);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Fechar"));
    });

    expect(mockConfirm).not.toHaveBeenCalled();
  });

  test("close() from the api closes without asking", async () => {
    await openPending();
    fireEvent.press(screen.getByLabelText("edit"));
    fireEvent.press(screen.getByLabelText("close-api", ALL));
    finishExit();

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText(DRAWER_TEXT)).toBeNull();
  });

  test("hides the content behind from screen readers while open", async () => {
    mockGetMeal.mockResolvedValue(pending);
    renderHost();
    const behind = () => screen.getByTestId("behind", ALL);
    expect(behind().props.importantForAccessibility).toBe("auto");
    expect(behind().props.accessibilityElementsHidden).toBe(false);

    fireEvent.press(screen.getByLabelText("open"));
    await screen.findByText(DRAWER_TEXT);
    expect(behind().props.importantForAccessibility).toBe("no-hide-descendants");
    expect(behind().props.accessibilityElementsHidden).toBe(true);
    expect(behind().props["aria-hidden"]).toBe(true);

    fireEvent.press(screen.getByLabelText("done"));
    expect(behind().props.importantForAccessibility).toBe("auto");
    expect(behind().props.accessibilityElementsHidden).toBe(false);
  });

  test("useConfirmMealSheet outside the provider throws", () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Opener />)).toThrow(/ConfirmMealProvider/);
  });
});
