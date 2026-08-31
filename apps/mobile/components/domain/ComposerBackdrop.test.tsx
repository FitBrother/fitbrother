import { describe, expect, test } from "@jest/globals";

import { COMPOSER_FADE_HEIGHT, FADE_STOPS } from "./ComposerBackdrop";

// O degradê antigo ficava DENTRO do composer, ancorado no fundo dele, e
// atravessava o topo do bloco sólido `bg-neutral-50` ainda em ~59% de alfa.
// O resultado era uma linha onde o card sumia de uma vez. Estes testes travam
// as invariantes que impedem a borda voltar.
describe("degradê do composer", () => {
  test("começa totalmente transparente", () => {
    expect(FADE_STOPS[0]).toEqual({ alpha: 0, location: 0 });
  });

  test("termina opaco, encostando no bloco sólido", () => {
    const ultima = FADE_STOPS[FADE_STOPS.length - 1]!;
    expect(ultima.alpha).toBe(1);
    expect(ultima.location).toBe(1);
  });

  test("a opacidade nunca recua entre as paradas", () => {
    const alfas = FADE_STOPS.map((s) => s.alpha);
    expect(alfas).toEqual([...alfas].sort((a, b) => a - b));
  });

  test("as paradas estão em ordem crescente de posição", () => {
    const posicoes = FADE_STOPS.map((s) => s.location);
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
  });

  test("desacelera ao encostar no sólido, em vez de rampa linear", () => {
    // Ease-out: cada parada intermediária fica acima da diagonal, então o
    // trecho colado no bloco sólido é o de menor variação de opacidade.
    for (const stop of FADE_STOPS.slice(1, -1)) {
      expect(stop.alpha).toBeGreaterThan(stop.location);
    }

    const ultimoTrecho = 1 - FADE_STOPS[FADE_STOPS.length - 2]!.alpha;
    const primeiroTrecho = FADE_STOPS[1]!.alpha;
    expect(ultimoTrecho).toBeLessThan(primeiroTrecho);
  });

  test("é alto o bastante para o card não sumir de uma vez", () => {
    expect(COMPOSER_FADE_HEIGHT).toBeGreaterThanOrEqual(64);
  });
});
