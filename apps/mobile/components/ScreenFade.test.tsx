import { describe, expect, test } from "@jest/globals";

import { shouldFadeScreens } from "./ScreenFade";

// O `animation` do Stack é implementado pelo react-native-screens no nativo e
// ignorado no web — medido: navegar entre telas não gerava nenhum frame de
// fade. O fade em JS cobre o web sem competir com a animação nativa.
describe("shouldFadeScreens", () => {
  test("anima no web", () => {
    expect(shouldFadeScreens("web", false)).toBe(true);
  });

  test("não anima no iOS nem no Android — lá o Stack já anima nativamente", () => {
    expect(shouldFadeScreens("ios", false)).toBe(false);
    expect(shouldFadeScreens("android", false)).toBe(false);
  });

  test("respeita a preferência de movimento reduzido", () => {
    expect(shouldFadeScreens("web", true)).toBe(false);
  });
});
