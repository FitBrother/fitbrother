import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
let mockFocused = true;

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react") as typeof import("react");
  return {
    useRouter: () => mockRouter,
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => (mockFocused ? effect() : undefined), [effect]);
    },
  };
});

import { mealRoute, useOpenMealAfterRegister } from "@/lib/hooks/useOpenMealAfterRegister";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";

describe("mealRoute", () => {
  test("points at the dynamic meal screen with the id", () => {
    expect(mealRoute(MEAL_ID)).toEqual({ pathname: "/(app)/meal/[id]", params: { id: MEAL_ID } });
  });
});

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
    const { result, unmount } = renderHook(() => useOpenMealAfterRegister());
    unmount();
    result.current({ id: MEAL_ID });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
