import { describe, expect, test } from "@jest/globals";
import { COLLAPSE_AT, EXPAND_AT, nextCollapse } from "@/lib/summary-collapse";

describe("nextCollapse", () => {
  test("no topo da lista o resumo expande", () => {
    expect(nextCollapse({ y: 0, current: 1 })).toBe(0);
    expect(nextCollapse({ y: EXPAND_AT, current: 1 })).toBe(0);
  });

  test("passando do limiar o resumo colapsa", () => {
    expect(nextCollapse({ y: COLLAPSE_AT + 1, current: 0 })).toBe(1);
    expect(nextCollapse({ y: 900, current: 0 })).toBe(1);
  });

  test("dentro da histerese o estado atual se mantém", () => {
    const meio = (EXPAND_AT + COLLAPSE_AT) / 2;
    expect(nextCollapse({ y: meio, current: 0 })).toBe(0);
    expect(nextCollapse({ y: meio, current: 1 })).toBe(1);
  });

  test("quique elástico acima do topo não colapsa", () => {
    // Safari e iOS levam o offset a negativo no overscroll.
    expect(nextCollapse({ y: -60, current: 1 })).toBe(0);
  });

  /**
   * A regressão que motivou a função existir.
   *
   * Colapsar encolhe o bloco em ~178px. Perto do fim da lista o navegador
   * reancora o `scrollTop` para o conteúdo continuar cabendo, e esse reajuste
   * chega ao handler de scroll como um salto negativo — do tamanho exato da
   * mudança de altura. A regra anterior lia isso como "o usuário subiu o dedo"
   * e expandia; expandir devolvia a altura, o navegador reancorava de volta, e
   * o resumo ficava piscando entre os dois estados por mais de um segundo
   * depois que o dedo já tinha saído da tela.
   *
   * Ancorado na posição, o mesmo salto não reabre nada: 881 → 703 continua
   * muito acima de EXPAND_AT.
   */
  test("reajuste do scroll no fim da lista não reexpande o resumo", () => {
    // Offsets medidos no navegador durante o flap, com o resumo encolhendo
    // ~178px: cada par é o salto que o reancoramento produziu.
    const reajustes = [881, 703, 726, 718, 758, 777, 756, 796, 784, 772, 769];
    let estado: 0 | 1 = 1;

    for (const y of reajustes) {
      estado = nextCollapse({ y, current: estado });
      expect(estado).toBe(1);
    }
  });
});
