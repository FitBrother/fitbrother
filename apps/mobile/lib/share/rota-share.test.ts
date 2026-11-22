import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";

/**
 * O `ConfirmDialog` e os toasts moram na raiz do app. Uma tela apresentada como
 * modal nativo no iOS cobre a raiz: a pergunta da foto salva nunca aparece, o
 * `confirm` nunca resolve e a pessoa fica presa no skeleton. Nada disso dá para
 * ver na web, onde o expo-router ignora `presentation`.
 */
describe.each(["share/[type]/[id]", "meal/[id]/edit"])("rota %s", (rota) => {
  test("não é apresentada como modal nativo", () => {
    const layout = readFileSync(resolve(__dirname, "../../app/(app)/_layout.tsx"), "utf8");
    const escapada = rota.replace(/[[\]/]/g, "\\$&");
    const tela = layout.match(new RegExp(`<Stack\\.Screen\\s+name="${escapada}"[\\s\\S]*?/>`))?.[0];

    expect(tela).toBeDefined();
    expect(tela).not.toMatch(/presentation/);
  });
});
