import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AppState, Pressable as MockPressable, Text as MockText } from "react-native";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
const mockMutate = jest.fn<(args: unknown, opts: MutateOpts) => void>();
type MutateOpts = { onSuccess?: (r: unknown) => void; onError?: (e: Error) => void };

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react") as typeof import("react");
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({ day: "2026-11-24" }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "pt-BR" }] }));
jest.mock("@/lib/profile/profile-context", () => ({
  useProfile: () => ({ timezone: "America/Sao_Paulo", day_start_hour: 4 }),
}));
jest.mock("@/lib/dateMath", () => ({ defaultConsumedAtForDay: () => "2026-11-24T15:00:00.000Z" }));
jest.mock("@/lib/hooks/useAuthSession", () => ({
  useAuthSession: () => ({ status: "signed_out" }),
}));
jest.mock("@/lib/hooks/useCreateMealText", () => ({
  newClientMealId: () => "client-meal-id",
  useCreateMealText: () => ({ mutate: mockMutate, isPending: false }),
}));
jest.mock("@/lib/hooks/useCreateMealAudio", () => ({
  useCreateMealAudio: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/lib/api/meals", () => ({
  QuotaExceededError: class QuotaExceededError extends Error {},
  getErrorStatus: () => undefined,
}));
jest.mock("@/lib/storage", () => ({ uploadMealAudio: jest.fn() }));
jest.mock("@/components/domain/BackfillContextBar", () => ({ BackfillContextBar: () => null }));
jest.mock("@/components/domain/ErrorBanner", () => ({
  ErrorBanner: ({ variant }: { variant: string }) => <MockText>{`banner:${variant}`}</MockText>,
}));
jest.mock("@/components/domain/MealComposer", () => ({
  MealComposer: ({ onSend }: { onSend: (t: string) => void }) => (
    <MockPressable accessibilityLabel="send" onPress={() => onSend("arroz")}>
      <MockText>send</MockText>
    </MockPressable>
  ),
}));

import BackfillScreen from "@/app/(app)/history/[day]/new";

describe("BackfillScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(AppState, "currentState", {
      value: "active",
      configurable: true,
      writable: true,
    });
  });

  test("replaces itself with the meal screen after a successful registration", () => {
    mockMutate.mockImplementation((_args, opts) =>
      opts.onSuccess?.({ meal: { id: MEAL_ID }, already_existed: false }),
    );
    render(<BackfillScreen />);

    fireEvent.press(screen.getByLabelText("send"));

    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/(app)/meal/[id]",
      params: { id: MEAL_ID },
    });
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  test("uses the existing meal id when the request already existed", () => {
    mockMutate.mockImplementation((_args, opts) =>
      opts.onSuccess?.({ meal: { id: MEAL_ID }, already_existed: true }),
    );
    render(<BackfillScreen />);

    fireEvent.press(screen.getByLabelText("send"));

    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/(app)/meal/[id]",
      params: { id: MEAL_ID },
    });
  });

  test("stays on the form and shows the banner on error", () => {
    mockMutate.mockImplementation((_args, opts) => opts.onError?.(new Error("boom")));
    render(<BackfillScreen />);

    fireEvent.press(screen.getByLabelText("send"));

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(screen.getByText("banner:network")).toBeTruthy();
  });
});
