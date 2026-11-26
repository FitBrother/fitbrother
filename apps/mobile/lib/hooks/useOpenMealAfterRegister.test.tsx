import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};
const mockOpen = jest.fn();
let mockFocused = true;
let mockBlur: (() => void) | undefined;

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react") as typeof import("react");
  return {
    useRouter: () => mockRouter,
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => {
        if (!mockFocused) return undefined;
        const cleanup = effect();
        mockBlur = typeof cleanup === "function" ? cleanup : undefined;
        return cleanup;
      }, [effect]);
    },
  };
});

jest.mock("@/lib/confirm-meal/confirm-meal-context", () => ({
  useConfirmMealSheet: () => ({ open: mockOpen, close: jest.fn() }),
}));

import { SHEET_DISMISS_MS, useOpenMealAfterRegister } from "@/lib/hooks/useOpenMealAfterRegister";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";

describe("useOpenMealAfterRegister", () => {
  const original = Object.getOwnPropertyDescriptor(AppState, "currentState")!;
  const setAppState = (value: string) =>
    Object.defineProperty(AppState, "currentState", { value, configurable: true, writable: true });
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocused = true;
    setAppState("active");
  });
  afterEach(() => {
    Object.defineProperty(AppState, "currentState", original);
  });

  test("opens the confirm drawer without navigating", () => {
    const { result } = renderHook(() => useOpenMealAfterRegister());
    result.current({ id: MEAL_ID });
    expect(mockOpen).toHaveBeenCalledWith(MEAL_ID);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  test("leaveScreen closes the screen first and opens the drawer after it is gone", () => {
    jest.useFakeTimers();
    try {
      const { result } = renderHook(() => useOpenMealAfterRegister({ leaveScreen: true }));
      result.current({ id: MEAL_ID });
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      expect(mockOpen).not.toHaveBeenCalled();

      jest.advanceTimersByTime(SHEET_DISMISS_MS);
      expect(mockOpen).toHaveBeenCalledWith(MEAL_ID);
      expect(mockOpen).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test("leaveScreen goes home when there is no screen to go back to", () => {
    mockRouter.canGoBack.mockReturnValueOnce(false);
    jest.useFakeTimers();
    try {
      const { result } = renderHook(() => useOpenMealAfterRegister({ leaveScreen: true }));
      result.current({ id: MEAL_ID });
      expect(mockRouter.replace).toHaveBeenCalledWith("/(app)");
      jest.advanceTimersByTime(SHEET_DISMISS_MS);
      expect(mockOpen).toHaveBeenCalledWith(MEAL_ID);
    } finally {
      jest.useRealTimers();
    }
  });

  test("does not open when the screen is not focused", () => {
    mockFocused = false;
    const { result } = renderHook(() => useOpenMealAfterRegister());
    result.current({ id: MEAL_ID });
    expect(mockOpen).not.toHaveBeenCalled();
  });

  test("does not open when the app is in the background", () => {
    setAppState("background");
    const { result } = renderHook(() => useOpenMealAfterRegister());
    result.current({ id: MEAL_ID });
    expect(mockOpen).not.toHaveBeenCalled();
  });

  test("stops opening after the screen loses focus", () => {
    const { result } = renderHook(() => useOpenMealAfterRegister());
    act(() => mockBlur?.());
    result.current({ id: MEAL_ID });
    expect(mockOpen).not.toHaveBeenCalled();
  });

  test("stops opening after the screen unmounts", () => {
    const { result, unmount } = renderHook(() => useOpenMealAfterRegister());
    unmount();
    result.current({ id: MEAL_ID });
    expect(mockOpen).not.toHaveBeenCalled();
  });

  test("opens while the app is inactive when requireActive is false", () => {
    setAppState("inactive");
    const { result } = renderHook(() => useOpenMealAfterRegister({ requireActive: false }));
    result.current({ id: MEAL_ID });
    expect(mockOpen).toHaveBeenCalledWith(MEAL_ID);
  });

  test("still skips an unmounted screen when requireActive is false", () => {
    const { result, unmount } = renderHook(() =>
      useOpenMealAfterRegister({ leaveScreen: true, requireActive: false }),
    );
    unmount();
    result.current({ id: MEAL_ID });
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockOpen).not.toHaveBeenCalled();
  });

  test("skips an inactive app by default", () => {
    setAppState("inactive");
    const { result } = renderHook(() => useOpenMealAfterRegister());
    result.current({ id: MEAL_ID });
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
