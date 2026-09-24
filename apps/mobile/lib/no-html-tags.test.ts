import { describe, expect, test } from "@jest/globals";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// CLAUDE.md, regra de ouro de UI nº 9: sem tags HTML — use `View`, `Text`,
// `Pressable`. Numa base que roda em React Native e na web, uma `<div>` que
// escapa só quebra no aparelho, longe de quem escreveu.
//
// Existe UMA exceção, listada abaixo com o motivo. O teste existe tanto para
// pegar tag nova quanto para prender a exceção: sem isso, o primeiro `<img>`
// vira precedente para o segundo.
const ROOT = resolve(__dirname, "..");

/**
 * Arquivos autorizados a usar tag HTML, e por quê.
 *
 * Só entra aqui arquivo com sufixo de plataforma `.web.tsx` — em código que
 * roda no nativo, tag HTML não é exceção, é defeito.
 */
const EXCECOES: Record<string, string> = {
  "components/domain/share/ShareLogo.web.tsx":
    "O html2canvas rasteriza `background-image` (que é como o react-native-web " +
    "desenha toda `Image`) no tamanho CSS antes de aplicar o scale da " +
    "exportação, e o lockup saía borrado no PNG de 1080×1920. Com uma `<img>` " +
    "ele usa `drawImage` na resolução da fonte. Medido: 27% de pixels em " +
    "meio-tom pelo primeiro caminho contra 5,2% pelo segundo.",
};

/** Tags HTML que alguém escreveria por engano num componente RN. */
const TAGS_HTML =
  /<\/?(?:div|span|img|p|a|h[1-6]|button|input|section|header|footer|ul|ol|li|table|form|label)[\s/>]/;

/**
 * Tira comentários antes de procurar tag.
 *
 * Os comentários deste projeto citam HTML o tempo todo para explicar o que o
 * react-native-web faz por baixo ("o TextInput vira `<input>`", "o html2canvas
 * e a `<img>`"). Sem isso, quatro arquivos davam falso positivo só por
 * documentar o motivo de não usarem tag HTML.
 *
 * O `//` só conta como comentário quando não vem depois de `:` — senão o
 * `https://` de qualquer URL cortaria o resto da linha.
 */
function semComentarios(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function walkTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walkTsx(full);
    return full.endsWith(".tsx") && !full.endsWith(".test.tsx") ? [full] : [];
  });
}

const arquivos = ["app", "components"].flatMap((d) => walkTsx(join(ROOT, d)));

describe("sem tags HTML em componentes", () => {
  test("há arquivos para vigiar", () => {
    expect(arquivos.length).toBeGreaterThan(20);
  });

  test.each(arquivos)("%s", (file) => {
    const rel = relative(ROOT, file).split("\\").join("/");
    const usaHtml = TAGS_HTML.test(semComentarios(readFileSync(file, "utf8")));
    if (rel in EXCECOES) {
      // A exceção tem que continuar sendo necessária: se alguém resolver o
      // problema de outro jeito e tirar a tag, a entrada sai da lista junto.
      expect(usaHtml).toBe(true);
      return;
    }
    expect(usaHtml).toBe(false);
  });

  test("toda exceção é de um arquivo só da web", () => {
    for (const caminho of Object.keys(EXCECOES)) {
      expect(caminho.endsWith(".web.tsx")).toBe(true);
    }
  });
});
