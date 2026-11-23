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
  "components/domain/CameraLive.web.tsx":
    "A pré-visualização ao vivo precisa consumir um MediaStream, e `<video>` é " +
    "o único elemento que consome. O `CameraView` do expo-camera, que monta " +
    "esse vídeo por dentro, nunca passa width/height ao getUserMedia " +
    "(`useWebCameraStream` → `getIdealConstraints(type, undefined, undefined)` " +
    "→ `MinimumConstraints = { audio: false, video: true }`), e isso é 640×480 " +
    "no Safari contra um card exportado em 1080×1920. Com constraints próprias " +
    "pedimos o sensor de verdade.",
};

/**
 * Tags HTML que alguém escreveria por engano num componente RN.
 *
 * `video` e `canvas` entraram depois de FALTAREM: a lista não as vigiava, então
 * um `<video>` teria passado batido. Fechar o buraco veio antes de registrar a
 * exceção que precisa dele — aproveitar a falha do guard para escapar dele é o
 * oposto do que ele existe para fazer.
 */
const TAGS_HTML =
  /<\/?(?:div|span|img|video|canvas|p|a|h[1-6]|button|input|section|header|footer|ul|ol|li|table|form|label)[\s/>]/;

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

  /**
   * Sem isto, uma exceção apontando para arquivo inexistente é ignorada em
   * silêncio: o `test.each` roda sobre os arquivos ENCONTRADOS, então uma
   * entrada órfã simplesmente nunca é checada. Duas consequências ruins —
   * apagar o arquivo deixa a entrada fóssil na lista para sempre, e registrar a
   * exceção ANTES de escrever o arquivo dá um verde que não significa nada.
   */
  test("toda exceção aponta para um arquivo que existe e é vigiado", () => {
    const vigiados = new Set(arquivos.map((f) => relative(ROOT, f).split("\\").join("/")));
    for (const caminho of Object.keys(EXCECOES)) {
      expect(vigiados.has(caminho)).toBe(true);
    }
  });
});
