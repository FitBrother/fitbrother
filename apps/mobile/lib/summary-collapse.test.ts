import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

/**
 * Guard do `overflow-anchor: none` na lista de refeições.
 *
 * O scroll anchoring do navegador reancora o `scrollTop` quando o conteúdo
 * acima da vista muda de tamanho — e o cabeçalho da Home faz exatamente isso,
 * de propósito, a cada colapso. O scroll devolvido pelo navegador é o mesmo
 * que decide se o resumo colapsa, então perto do topo fechava um ciclo:
 * colapsa → anchoring puxa pra 0 → expande → conteúdo desce → anchoring
 * empurra → colapsa. Num scroll lento o resumo pulsava sem parar.
 *
 * É comportamento de navegador: não aparece em teste de unidade nem em
 * revisão, e o `style` parece decoração removível. Medido, ligado, o anchoring
 * comeu mais de 100px de um gesto de 180px. Daí o guard ler o fonte.
 */
describe("lista de refeições da Home", () => {
  const home = readFileSync(resolve(__dirname, "../app/(app)/index.tsx"), "utf8");

  test("desliga o scroll anchoring do navegador", () => {
    expect(home).toContain('overflowAnchor: "none"');
    expect(home).toContain("style={NO_SCROLL_ANCHOR}");
  });

  test("o resumo é cabeçalho fixo da lista, não um irmão acima dela", () => {
    // Fora da lista, o resumo não pertence a superfície rolável nenhuma: o
    // dedo em cima dele não rola nada e encolher passa a redimensionar o
    // viewport, que era a origem do travamento.
    expect(home).toContain("ListHeaderComponent={listHeaderComponent}");
    expect(home).toContain("stickyHeaderIndices={[0]}");
  });
});
