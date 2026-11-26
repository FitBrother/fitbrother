import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
const mockOpen = jest.fn();
const mockNotifyMealCreated = jest.fn();
type MutateOpts = { onSuccess?: (r: unknown) => void; onError?: (e: Error) => void };
const mockTextMutate = jest.fn<(args: unknown, opts: MutateOpts) => void>();

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ barcode: "7891234567890" }),
}));
jest.mock("@/lib/confirm-meal/confirm-meal-context", () => ({
  useConfirmMealSheet: () => ({ open: mockOpen, close: jest.fn() }),
}));
jest.mock("@/lib/tour/tour-context", () => ({
  useTour: () => ({ notifyMealCreated: mockNotifyMealCreated }),
}));
jest.mock("@/lib/profile/profile-context", () => ({
  useProfile: () => ({ timezone: "America/Sao_Paulo", day_start_hour: 4, locale: "pt-BR" }),
}));
jest.mock("@/lib/hooks/useBarcodeProduct", () => ({
  useBarcodeProduct: () => ({
    data: undefined,
    isLoading: false,
    error: new Error("product_not_found"),
  }),
}));
jest.mock("@/lib/hooks/useCreateMealBarcode", () => ({
  useCreateMealBarcode: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/lib/hooks/useCreateMealText", () => ({
  newClientMealId: () => "client-meal-id",
  useCreateMealText: () => ({ mutate: mockTextMutate, isPending: false }),
}));

import ScanConfirmScreen from "@/app/(app)/scan-confirm";

const metrics = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ScanConfirmScreen />
    </SafeAreaProvider>,
  );
}

describe("scan confirm AI fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("goes home and opens the confirm drawer for the pending meal", () => {
    mockTextMutate.mockImplementation((_args, opts) =>
      opts.onSuccess?.({ meal: { id: MEAL_ID }, already_existed: false }),
    );
    renderScreen();

    expect(mockTextMutate).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith("/(app)/");
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen).toHaveBeenCalledWith(MEAL_ID);
    expect(mockRouter.replace.mock.invocationCallOrder[0]).toBeLessThan(
      mockOpen.mock.invocationCallOrder[0]!,
    );
    expect(mockNotifyMealCreated).not.toHaveBeenCalled();
  });

  test("does not open the drawer when the fallback fails", () => {
    mockTextMutate.mockImplementation((_args, opts) => opts.onError?.(new Error("boom")));
    renderScreen();

    expect(mockOpen).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
