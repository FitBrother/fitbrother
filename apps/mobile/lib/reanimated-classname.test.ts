import { describe, expect, test } from "@jest/globals";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// O NativeWind não processa `className` em componentes do Reanimated: a prop é
// aceita, ignorada em silêncio, e o elemento renderiza sem estilo nenhum. Já
// mordeu quatro vezes — LoadingDots (pontos invisíveis), SwipeableTabs (cenas
// empilhadas na vertical), a lista do histórico e a linha de item de refeição
// (sem fundo, sem raio, sem padding). Nada quebra, nada avisa. Daí o guard.
const ROOT = resolve(__dirname, "..");

function walkTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walkTsx(full);
    return full.endsWith(".tsx") && !full.endsWith(".test.tsx") ? [full] : [];
  });
}

/**
 * Extrai cada tag de abertura `<Animated.X ...>` do fonte, parando no `>` que
 * a fecha. Delimitar na própria tag é o que evita confundir com o `className`
 * de um filho — um leitor de janela fixa daria falso positivo.
 */
export function animatedTags(source: string): string[] {
  const tags: string[] = [];
  const abertura = /<Animated\.[A-Za-z]+/g;
  let match = abertura.exec(source);
  while (match !== null) {
    const fim = source.indexOf(">", match.index);
    tags.push(source.slice(match.index, fim === -1 ? source.length : fim));
    match = abertura.exec(source);
  }
  return tags;
}

const files = ["app", "components"]
  .flatMap((d) => walkTsx(join(ROOT, d)))
  .filter((f) => {
    const source = readFileSync(f, "utf8");
    return source.includes("react-native-reanimated") && source.includes("<Animated.");
  });

describe("className não é usado em componentes do Reanimated", () => {
  test("há componentes do Reanimated para vigiar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(files)("%s estiliza Animated.* por style", (file) => {
    for (const tag of animatedTags(readFileSync(file, "utf8"))) {
      expect(tag).not.toMatch(/\bclassName=/);
    }
  });
});

describe("animatedTags", () => {
  test("não confunde a tag com o className de um filho", () => {
    const fonte = `<Animated.View style={s}>\n  <Text className="x" />\n</Animated.View>`;

    expect(animatedTags(fonte)).toEqual(["<Animated.View style={s}"]);
  });

  test("pega o className quando está na própria tag", () => {
    expect(animatedTags(`<Animated.View className="x" />`)[0]).toMatch(/className=/);
  });
});
