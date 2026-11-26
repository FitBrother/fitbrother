import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
const mockOpen = jest.fn();
type Opts = { onSuccess?: (r: unknown) => void; onError?: (e: Error) => void };
const mockText = jest.fn<(args: unknown, opts: Opts) => void>();
const mockAudio = jest.fn<(args: unknown, opts: Opts) => void>();
const mockPhoto = jest.fn<(args: unknown, opts: Opts) => void>();
const mockPending = { text: false, audio: false, photo: false };

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react") as typeof import("react");
  return {
    useRouter: () => mockRouter,
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});
jest.mock("@/lib/confirm-meal/confirm-meal-context", () => ({
  useConfirmMealSheet: () => ({ open: mockOpen, close: jest.fn() }),
}));
jest.mock("@/lib/api/meals", () => ({
  QuotaExceededError: class QuotaExceededError extends Error {},
  getErrorStatus: (err: unknown) =>
    err && typeof err === "object" && "status" in err
      ? (err as { status: number }).status
      : undefined,
}));
jest.mock("@/lib/hooks/useCreateMealText", () => ({
  useCreateMealText: () => ({ mutate: mockText, isPending: mockPending.text }),
}));
jest.mock("@/lib/hooks/useCreateMealAudio", () => ({
  useCreateMealAudio: () => ({ mutate: mockAudio, isPending: mockPending.audio }),
}));
jest.mock("@/lib/hooks/useCreateMealPhoto", () => ({
  useCreateMealPhoto: () => ({ mutate: mockPhoto, isPending: mockPending.photo }),
}));

import { QuotaExceededError } from "@/lib/api/meals";
import { useRegisterMeal } from "@/lib/hooks/useRegisterMeal";

const textArgs = { client_meal_id: "c1", text: "arroz", locale: "pt-BR", day: "2026-11-25" };
const audioArgs = {
  client_meal_id: "c2",
  audio_path: "u/c2.m4a",
  duration_s: 3,
  locale: "pt-BR",
  day: "2026-11-25",
};
const photoArgs = {
  client_meal_id: "c3",
  image_path: "u/c3.jpg",
  locale: "pt-BR",
  day: "2026-11-25",
};

type Rendered = ReturnType<typeof setup>["result"];

function submitters() {
  return [
    ["text", mockText, textArgs, (r: Rendered) => r.current.submitText],
    ["audio", mockAudio, audioArgs, (r: Rendered) => r.current.submitAudio],
    ["photo", mockPhoto, photoArgs, (r: Rendered) => r.current.submitPhoto],
  ] as unknown as [string, typeof mockText, object, (r: Rendered) => (args: never) => void][];
}

function setup(options: Partial<Parameters<typeof useRegisterMeal>[0]> = {}) {
  const onError = jest.fn();
  const hook = renderHook(() => useRegisterMeal({ onError, ...options }));
  return { ...hook, onError };
}

describe("useRegisterMeal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockPending.text = mockPending.audio = mockPending.photo = false;
    Object.defineProperty(AppState, "currentState", {
      value: "active",
      configurable: true,
      writable: true,
    });
  });

  describe.each(submitters())("%s", (_name, mutate, args, pick) => {
    test("forwards the args and opens the returned meal on success", () => {
      mutate.mockImplementation((_a, opts) =>
        opts.onSuccess?.({ meal: { id: MEAL_ID }, already_existed: false }),
      );
      const { result, onError } = setup();

      pick(result)(args as never);

      expect(mutate).toHaveBeenCalledWith(args, expect.any(Object));
      expect(mockOpen).toHaveBeenCalledWith(MEAL_ID);
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    test("opens the same meal when the request already existed", () => {
      mutate.mockImplementation((_a, opts) =>
        opts.onSuccess?.({ meal: { id: MEAL_ID }, already_existed: true }),
      );
      const { result } = setup();

      pick(result)(args as never);

      expect(mockOpen).toHaveBeenCalledTimes(1);
      expect(mockOpen).toHaveBeenCalledWith(MEAL_ID);
    });

    test("reports the classified error and does not navigate", () => {
      mutate.mockImplementation((_a, opts) => opts.onError?.(new QuotaExceededError("llm")));
      const { result, onError } = setup();

      pick(result)(args as never);

      expect(onError).toHaveBeenCalledWith("quota_exceeded");
      expect(mockOpen).not.toHaveBeenCalled();
    });
  });

  test.each([
    ["request_timeout", "offline"],
    ["empty_transcription", "network"],
    ["boom", "network"],
  ])("maps the %s error to the %s banner", (message, kind) => {
    mockAudio.mockImplementation((_a, opts) => opts.onError?.(new Error(message)));
    const { result, onError } = setup();

    result.current.submitAudio(audioArgs as never);

    expect(onError).toHaveBeenCalledWith(kind);
  });

  test("maps a 5xx response to the server error banner", () => {
    mockText.mockImplementation((_a, opts) =>
      opts.onError?.(Object.assign(new Error("request_failed_502"), { status: 502 })),
    );
    const { result, onError } = setup();

    result.current.submitText(textArgs as never);

    expect(onError).toHaveBeenCalledWith("server_error");
  });

  test("leaveScreen closes the host screen before opening the drawer", () => {
    jest.useFakeTimers();
    try {
      mockText.mockImplementation((_a, opts) => opts.onSuccess?.({ meal: { id: MEAL_ID } }));
      const { result } = setup({ leaveScreen: true });

      result.current.submitText(textArgs as never);

      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      jest.runAllTimers();
      expect(mockOpen).toHaveBeenCalledWith(MEAL_ID);
    } finally {
      jest.useRealTimers();
    }
  });

  test("does not navigate after the host screen unmounts", () => {
    mockText.mockImplementation((_a, opts) => opts.onSuccess?.({ meal: { id: MEAL_ID } }));
    const { result, unmount } = setup();
    const submit = result.current.submitText;
    unmount();

    submit(textArgs as never);

    expect(mockOpen).not.toHaveBeenCalled();
  });

  test("honors requireActive: false", () => {
    Object.defineProperty(AppState, "currentState", {
      value: "inactive",
      configurable: true,
      writable: true,
    });
    mockText.mockImplementation((_a, opts) => opts.onSuccess?.({ meal: { id: MEAL_ID } }));
    const { result } = setup({ requireActive: false });

    result.current.submitText(textArgs as never);

    expect(mockOpen).toHaveBeenCalledWith(MEAL_ID);
  });

  test("keeps the submit callbacks stable across renders", () => {
    const { result, rerender } = setup();
    const first = result.current;

    rerender({});

    expect(result.current.submitText).toBe(first.submitText);
    expect(result.current.submitAudio).toBe(first.submitAudio);
    expect(result.current.submitPhoto).toBe(first.submitPhoto);
  });

  test("isPending is true while any registration is in flight", () => {
    mockPending.photo = true;
    const { result } = setup();
    expect(result.current.isPending).toBe(true);
  });

  test("isPending is false when idle", () => {
    const { result } = setup();
    expect(result.current.isPending).toBe(false);
  });
});
