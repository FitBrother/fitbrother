import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, test } from "@jest/globals";

function arquivosWeb(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(pasta, e.name);
    if (e.isDirectory()) return arquivosWeb(caminho);
    return /\.web\.tsx?$/.test(e.name) ? [caminho] : [];
  });
}

/**
 * Na web o Metro resolve `./X` para o próprio `X.web.tsx`. Importar um valor do
 * par nativo a partir dali devolve `undefined` em silêncio: o tsc e o jest leem
 * o `X.tsx` e não reclamam. Foi assim que o logo do story saiu com altura NaN.
 */
describe("arquivos .web", () => {
  test("não importam valores do próprio par", () => {
    const erros = ["app", "components", "lib"].flatMap(arquivosWeb).filter((arquivo) => {
      const nome = basename(arquivo).replace(/\.web\.tsx?$/, "");
      const valor = new RegExp(`^import (?!type )[^;]*from "\\./${nome}";`, "m");
      return valor.test(readFileSync(arquivo, "utf8"));
    });

    expect(erros).toEqual([]);
  });
});
