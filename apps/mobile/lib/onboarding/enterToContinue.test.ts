import { describe, expect, test } from "@jest/globals";
import { shouldAdvanceOnEnter } from "./enterToContinue";

/** Alvo que imita o `closest` do DOM: casa se o seletor pedido estiver na
 * lista que o teste declarou. */
function target(matches: string[] = []) {
  return {
    closest: (selector: string) =>
      matches.some((m) => selector.includes(m)) ? ({} as unknown) : null,
  };
}

describe("shouldAdvanceOnEnter", () => {
  test("avança no Enter puro sobre um alvo neutro", () => {
    expect(shouldAdvanceOnEnter({ key: "Enter", target: target() })).toBe(true);
  });

  test("ignora qualquer tecla que não seja Enter", () => {
    expect(shouldAdvanceOnEnter({ key: "a", target: target() })).toBe(false);
    expect(shouldAdvanceOnEnter({ key: " ", target: target() })).toBe(false);
  });

  test.each(["shiftKey", "metaKey", "ctrlKey", "altKey"] as const)(
    "ignora Enter com %s",
    (modifier) => {
      expect(shouldAdvanceOnEnter({ key: "Enter", target: target(), [modifier]: true })).toBe(
        false,
      );
    },
  );

  // O Pressable do React Native Web vira <div role="button" tabindex="0"> e
  // já dispara onPress no Enter sozinho. Sem essa exclusão, Enter com foco
  // no "Voltar" voltaria E avançaria.
  test.each(['role="button"', 'role="link"', 'role="checkbox"', 'role="radio"', "button", "a"])(
    "ignora Enter quando o alvo está dentro de %s",
    (selector) => {
      expect(shouldAdvanceOnEnter({ key: "Enter", target: target([selector]) })).toBe(false);
    },
  );

  // O MealComposer usa TextInput multiline, que vira <textarea>. Enter ali
  // é quebra de linha.
  test("ignora Enter dentro de textarea", () => {
    expect(shouldAdvanceOnEnter({ key: "Enter", target: target(["textarea"]) })).toBe(false);
  });

  test("avança quando o alvo não sabe fazer closest", () => {
    expect(shouldAdvanceOnEnter({ key: "Enter", target: null })).toBe(true);
  });
});
