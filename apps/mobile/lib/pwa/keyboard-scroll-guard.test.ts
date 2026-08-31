import { describe, expect, test } from "@jest/globals";

import { shouldPinToTop } from "./keyboard-scroll-guard";

// O documento nunca deveria rolar — o app rola dentro de ScrollViews. Quando
// ele fica preso rolado, o topo da Home (ofensivas e foto) some sem volta,
// porque `overflow: hidden` impede o usuário de rolar de novo.
describe("shouldPinToTop", () => {
  test("ancora quando sobrou deslocamento com o teclado fechado", () => {
    expect(shouldPinToTop({ scrollY: 8, visualHeight: 844, layoutHeight: 844 })).toBe(true);
  });

  test("não faz nada quando já está no topo", () => {
    expect(shouldPinToTop({ scrollY: 0, visualHeight: 844, layoutHeight: 844 })).toBe(false);
  });

  test("não briga com o navegador enquanto o teclado está aberto", () => {
    // Aí o deslocamento é intencional: é o que mantém o input visível.
    expect(shouldPinToTop({ scrollY: 120, visualHeight: 500, layoutHeight: 844 })).toBe(false);
  });

  test("uma diferença pequena de viewport não conta como teclado aberto", () => {
    // Barra de endereço recolhendo, por exemplo — não é teclado, e o
    // deslocamento residual continua sendo defeito.
    expect(shouldPinToTop({ scrollY: 8, visualHeight: 800, layoutHeight: 844 })).toBe(true);
  });
});
