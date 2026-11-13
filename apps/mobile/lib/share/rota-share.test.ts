import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";

/**
 * O `ConfirmDialog` e os toasts moram na raiz do app. Uma tela apresentada como
 * modal nativo no iOS cobre a raiz: a pergunta da foto salva nunca aparece, o
 * `confirm` nunca resolve e a pessoa fica presa no skeleton. Nada disso dá para
 * ver na web, onde o expo-router ignora `presentation`.
 */
describe("rota de compartilhar", () => {
  test("não é apresentada como modal nativo", () => {
    const layout = readFileSync(resolve(__dirname, "../../app/(app)/_layout.tsx"), "utf8");
    const tela = layout.match(/<Stack\.Screen\s+name="share\/\[type\]\/\[id\]"[\s\S]*?\/>/)?.[0];

    expect(tela).toBeDefined();
    expect(tela).not.toMatch(/presentation/);
  });
});
