import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";

let mockFocused = true;

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react") as typeof import("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      const focused = mockFocused;
      React.useEffect(() => {
        if (!focused) return undefined;
        return effect();
      }, [effect, focused]);
    },
  };
});

import { useOnceWhenFocused } from "@/lib/hooks/useOnceWhenFocused";

const fire = jest.fn();

function renderGate(ready: boolean) {
  return renderHook(({ ready: r }: { ready: boolean }) => useOnceWhenFocused(r, fire), {
    initialProps: { ready },
  });
}

describe("useOnceWhenFocused", () => {
  beforeEach(() => {
    fire.mockReset();
    mockFocused = true;
  });

  test("fires once on mount when ready and focused", () => {
    const view = renderGate(true);
    view.rerender({ ready: true });
    expect(fire).toHaveBeenCalledTimes(1);
  });

  test("does not fire while ready but not focused, and fires on focus", () => {
    mockFocused = false;
    const view = renderGate(false);
    view.rerender({ ready: true });
    expect(fire).not.toHaveBeenCalled();
    mockFocused = true;
    view.rerender({ ready: true });
    expect(fire).toHaveBeenCalledTimes(1);
  });

  test("refocusing while still ready does not fire again", () => {
    const view = renderGate(true);
    mockFocused = false;
    view.rerender({ ready: true });
    mockFocused = true;
    view.rerender({ ready: true });
    expect(fire).toHaveBeenCalledTimes(1);
  });

  test("fires again after ready goes false and back to true", () => {
    const view = renderGate(true);
    view.rerender({ ready: false });
    view.rerender({ ready: true });
    expect(fire).toHaveBeenCalledTimes(2);
  });

  test("never fires while not ready", () => {
    const view = renderGate(false);
    view.rerender({ ready: false });
    expect(fire).not.toHaveBeenCalled();
  });
});
