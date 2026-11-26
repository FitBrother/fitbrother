import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AppState, Pressable as MockPressable, Text as MockText } from "react-native";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
type MutateOpts = { onSuccess?: (r: unknown) => void; onError?: (e: Error) => void };
const mockTextMutate = jest.fn<(args: unknown, opts: MutateOpts) => void>();
const mockAudioMutate = jest.fn<(args: unknown, opts: MutateOpts) => void>();
const mockUploadAudio = jest.fn<(args: unknown) => Promise<{ path: string }>>();

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
  useAuthSession: () => ({ status: "signed_in", session: { user: { id: "user-1" } } }),
}));
jest.mock("@/lib/hooks/useCreateMealText", () => ({
  newClientMealId: () => "client-meal-id",
  useCreateMealText: () => ({ mutate: mockTextMutate, isPending: false }),
}));
jest.mock("@/lib/hooks/useCreateMealAudio", () => ({
  useCreateMealAudio: () => ({ mutate: mockAudioMutate, isPending: false }),
}));
jest.mock("@/lib/hooks/useCreateMealPhoto", () => ({
  useCreateMealPhoto: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/lib/api/meals", () => ({
  QuotaExceededError: class QuotaExceededError extends Error {},
  getErrorStatus: () => undefined,
}));
jest.mock("@/lib/storage", () => ({
  uploadMealAudio: (args: unknown) => mockUploadAudio(args),
}));
jest.mock("@/components/domain/BackfillContextBar", () => ({ BackfillContextBar: () => null }));
jest.mock("@/components/domain/ErrorBanner", () => ({
  ErrorBanner: ({ variant }: { variant: string }) => <MockText>{`banner:${variant}`}</MockText>,
}));
jest.mock("@/components/domain/MealComposer", () => ({
  MealComposer: ({
    onSend,
    onAudioReady,
  }: {
    onSend: (t: string) => void;
    onAudioReady: (p: { fileUri: string; durationMs: number; ext: string }) => Promise<void>;
  }) => (
    <>
      <MockPressable accessibilityLabel="send" onPress={() => onSend("arroz")}>
        <MockText>send</MockText>
      </MockPressable>
      <MockPressable
        accessibilityLabel="audio"
        onPress={() => void onAudioReady({ fileUri: "file://a.m4a", durationMs: 2400, ext: "m4a" })}
      >
        <MockText>audio</MockText>
      </MockPressable>
    </>
  ),
}));

import BackfillScreen from "@/app/(app)/history/[day]/new";

const MEAL_ROUTE = { pathname: "/(app)/meal/[id]", params: { id: MEAL_ID } };

function setAppState(value: string) {
  Object.defineProperty(AppState, "currentState", { value, configurable: true, writable: true });
}

describe("BackfillScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAppState("active");
    mockUploadAudio.mockResolvedValue({ path: "user-1/client-meal-id.m4a" });
  });

  describe("text", () => {
    test("replaces itself with the meal screen after a successful registration", () => {
      mockTextMutate.mockImplementation((_args, opts) =>
        opts.onSuccess?.({ meal: { id: MEAL_ID }, already_existed: false }),
      );
      render(<BackfillScreen />);

      fireEvent.press(screen.getByLabelText("send"));

      expect(mockRouter.replace).toHaveBeenCalledWith(MEAL_ROUTE);
      expect(mockRouter.back).not.toHaveBeenCalled();
    });

    test("uses the existing meal id when the request already existed", () => {
      mockTextMutate.mockImplementation((_args, opts) =>
        opts.onSuccess?.({ meal: { id: MEAL_ID }, already_existed: true }),
      );
      render(<BackfillScreen />);

      fireEvent.press(screen.getByLabelText("send"));

      expect(mockRouter.replace).toHaveBeenCalledWith(MEAL_ROUTE);
    });

    test("stays on the form and shows the banner on error", () => {
      mockTextMutate.mockImplementation((_args, opts) => opts.onError?.(new Error("boom")));
      render(<BackfillScreen />);

      fireEvent.press(screen.getByLabelText("send"));

      expect(mockRouter.replace).not.toHaveBeenCalled();
      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(screen.getByText("banner:network")).toBeTruthy();
    });

    test("still opens the meal when the app is not active at success time", () => {
      setAppState("inactive");
      mockTextMutate.mockImplementation((_args, opts) =>
        opts.onSuccess?.({ meal: { id: MEAL_ID }, already_existed: false }),
      );
      render(<BackfillScreen />);

      fireEvent.press(screen.getByLabelText("send"));

      expect(mockRouter.replace).toHaveBeenCalledWith(MEAL_ROUTE);
    });
  });

  describe("audio", () => {
    test("uploads, registers with the chosen day and opens the returned meal", async () => {
      mockAudioMutate.mockImplementation((_args, opts) =>
        opts.onSuccess?.({ meal: { id: MEAL_ID }, already_existed: false }),
      );
      render(<BackfillScreen />);

      fireEvent.press(screen.getByLabelText("audio"));

      await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(MEAL_ROUTE));
      expect(mockAudioMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          audio_path: "user-1/client-meal-id.m4a",
          duration_s: 2,
          consumed_at: "2026-11-24T15:00:00.000Z",
          day: "2026-11-24",
        }),
        expect.any(Object),
      );
    });

    test("uses the existing meal id when the request already existed", async () => {
      mockAudioMutate.mockImplementation((_args, opts) =>
        opts.onSuccess?.({ meal: { id: MEAL_ID }, already_existed: true }),
      );
      render(<BackfillScreen />);

      fireEvent.press(screen.getByLabelText("audio"));

      await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(MEAL_ROUTE));
    });

    test("an empty transcription shows the network banner and does not navigate", async () => {
      mockAudioMutate.mockImplementation((_args, opts) =>
        opts.onError?.(new Error("empty_transcription")),
      );
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
      render(<BackfillScreen />);

      fireEvent.press(screen.getByLabelText("audio"));

      await waitFor(() => expect(screen.getByText("banner:network")).toBeTruthy());
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    test("a backfill window error shows its own banner", async () => {
      mockAudioMutate.mockImplementation((_args, opts) =>
        opts.onError?.(new Error("backfill_window_exceeded")),
      );
      render(<BackfillScreen />);

      fireEvent.press(screen.getByLabelText("audio"));

      await waitFor(() => expect(screen.getByText("banner:backfill_window_exceeded")).toBeTruthy());
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    test("an upload failure shows the network banner and never registers", async () => {
      mockUploadAudio.mockRejectedValue(new Error("upload_failed"));
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
      render(<BackfillScreen />);

      fireEvent.press(screen.getByLabelText("audio"));

      await waitFor(() => expect(screen.getByText("banner:network")).toBeTruthy());
      expect(mockAudioMutate).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });
});
