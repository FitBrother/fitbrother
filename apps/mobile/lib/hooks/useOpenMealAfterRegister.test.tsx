import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
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

import { useOpenMealAfterRegister } from "@/lib/hooks/useOpenMealAfterRegister";
import { mealRoute } from "@/lib/meal-route";

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

  test("pushes the meal screen by default", () => {
    const { result } = renderHook(() => useOpenMealAfterRegister());
    result.current({ id: MEAL_ID });
    expect(mockRouter.push).toHaveBeenCalledWith(mealRoute(MEAL_ID));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test("replaces the current screen in replace mode", () => {
    const { result } = renderHook(() => useOpenMealAfterRegister("replace"));
    result.current({ id: MEAL_ID });
    expect(mockRouter.replace).toHaveBeenCalledWith(mealRoute(MEAL_ID));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  test("does not navigate when the screen is not focused", () => {
    mockFocused = false;
    const { result } = renderHook(() => useOpenMealAfterRegister());
    result.current({ id: MEAL_ID });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  test("does not navigate when the app is in the background", () => {
    setAppState("background");
    const { result } = renderHook(() => useOpenMealAfterRegister());
    result.current({ id: MEAL_ID });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  test("stops navigating after the screen loses focus", () => {
    const { result } = renderHook(() => useOpenMealAfterRegister());
    act(() => mockBlur?.());
    result.current({ id: MEAL_ID });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  test("stops navigating after the screen unmounts", () => {
    const { result, unmount } = renderHook(() => useOpenMealAfterRegister());
    unmount();
    result.current({ id: MEAL_ID });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  test("navigates while the app is inactive when requireActive is false", () => {
    setAppState("inactive");
    const { result } = renderHook(() =>
      useOpenMealAfterRegister("replace", { requireActive: false }),
    );
    result.current({ id: MEAL_ID });
    expect(mockRouter.replace).toHaveBeenCalledWith(mealRoute(MEAL_ID));
  });

  test("still skips an unmounted screen when requireActive is false", () => {
    const { result, unmount } = renderHook(() =>
      useOpenMealAfterRegister("replace", { requireActive: false }),
    );
    unmount();
    result.current({ id: MEAL_ID });
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test("skips an inactive app by default", () => {
    setAppState("inactive");
    const { result } = renderHook(() => useOpenMealAfterRegister());
    result.current({ id: MEAL_ID });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
