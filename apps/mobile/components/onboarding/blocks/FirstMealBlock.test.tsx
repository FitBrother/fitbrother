import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable as MockPressable, Text as MockText } from "react-native";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockReset = jest.fn();
const mockMutateAsync = jest.fn<(args: unknown) => Promise<unknown>>();
const mockStore = {
  timezone: "America/Sao_Paulo",
  day_start_hour: 4,
  locale: "pt-BR",
  reset: mockReset,
};

jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock("@/lib/stores/onboardingStore", () => ({
  useOnboardingStore: (sel: (s: typeof mockStore) => unknown) => sel(mockStore),
}));
jest.mock("@/lib/hooks/useCreateMealText", () => ({
  newClientMealId: () => "client-meal-id",
  useCreateMealText: () => ({ mutateAsync: mockMutateAsync }),
}));
jest.mock("@/lib/hooks/useCreateMealAudio", () => ({
  useCreateMealAudio: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock("@/lib/storage", () => ({ uploadMealAudio: jest.fn() }));
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getUser: jest.fn() } } }));
jest.mock("@/components/onboarding/OnboardingChapterShell", () => ({
  OnboardingChapterShell: ({
    children,
    onSkip,
  }: {
    children: React.ReactNode;
    onSkip: () => void;
  }) => (
    <>
      <MockPressable accessibilityLabel="skip" onPress={onSkip} />
      {children}
    </>
  ),
}));
jest.mock("@/components/domain/MealComposer", () => ({
  MealComposer: ({ onSend }: { onSend: (t: string) => void }) => (
    <MockPressable
      accessibilityLabel="send"
      onPress={() => {
        // The block lets a failed creation reject; swallow it here so the test stays quiet.
        void Promise.resolve(onSend("arroz e feijao")).catch(() => undefined);
      }}
    >
      <MockText>send</MockText>
    </MockPressable>
  ),
}));

import { FirstMealBlock } from "@/components/onboarding/blocks/FirstMealBlock";

const props = { step: 1, total: 1, onNext: jest.fn(), onBack: jest.fn() };

describe("FirstMealBlock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("opens the meal screen after the first meal is created", async () => {
    mockMutateAsync.mockResolvedValue({ meal: { id: MEAL_ID }, already_existed: false });
    render(<FirstMealBlock {...props} />);

    fireEvent.press(screen.getByLabelText("send"));

    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith({
        pathname: "/(app)/meal/[id]",
        params: { id: MEAL_ID },
      }),
    );
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  test("does not navigate when creation fails", async () => {
    mockMutateAsync.mockRejectedValue(new Error("network"));
    render(<FirstMealBlock {...props} />);

    fireEvent.press(screen.getByLabelText("send"));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  test("skipping still goes to the home", () => {
    render(<FirstMealBlock {...props} />);

    fireEvent.press(screen.getByLabelText("skip"));

    expect(mockRouter.replace).toHaveBeenCalledWith("/(app)");
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
