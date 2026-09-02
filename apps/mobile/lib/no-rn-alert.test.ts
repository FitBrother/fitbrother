import { describe, expect, test } from "@jest/globals";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * `Alert` do react-native é proibido no app.
 *
 * No react-native-web a implementação inteira é:
 *
 *     class Alert { static alert() {} }
 *
 * Uma função vazia. Numa PWA isso não apenas deixa de mostrar o aviso — engole
 * a ação junto, porque ela mora no callback de um botão que nunca é desenhado.
 * Foi assim que "Excluir refeição" e "Descartar alterações?" passaram meses
 * sem fazer nada no navegador, sem erro, sem log, sem nada.
 *
 * A armadilha é invisível em revisão: o código parece certo, funciona no
 * simulador, e só falha na plataforma que mais importa. Daí o guard.
 *
 * Em vez de `Alert`, use:
 *   • `useDialog().confirm()` — decisão com duas saídas;
 *   • `useDialog().alert()`  — aviso que precisa ser lido antes de seguir;
 *   • `useToast()`           — resultado de passagem (erro, sucesso).
 *
 * Não há exceção para trecho nativo-only: o diálogo funciona nas duas
 * plataformas, então manter `Alert` em qualquer lugar só reabre a porta.
 */
const ROOT = resolve(__dirname, "..");

function walkSource(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walkSource(full);
    const code = full.endsWith(".ts") || full.endsWith(".tsx");
    return code && !full.includes(".test.") ? [full] : [];
  });
}

const files = ["app", "components", "lib"].flatMap((d) => walkSource(join(ROOT, d)));

/**
 * Casa `Alert` como identificador solto, mas não `AlertTriangle`,
 * `TriangleAlert` nem a palavra "Alerta" — os limites de palavra sozinhos
 * deixariam o ícone passar como falso positivo.
 *
 * Comentários saem antes da busca: o ConfirmDialog e o DialogProvider existem
 * justamente para substituir o `Alert` e explicam isso citando o nome dele.
 * Sem tirar a prosa, o guard acusaria a própria cura.
 */
export function usaAlertDoReactNative(source: string): boolean {
  const codigo = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return /\bAlert\s*\./.test(codigo) || /^\s*Alert,\s*$/m.test(codigo);
}

describe("Alert do react-native não volta ao app", () => {
  test("há arquivos para vigiar", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  test.each(files)("%s não usa Alert", (file) => {
    expect(usaAlertDoReactNative(readFileSync(file, "utf8"))).toBe(false);
  });
});

describe("usaAlertDoReactNative", () => {
  test("pega a chamada e o import", () => {
    expect(usaAlertDoReactNative('Alert.alert("oi")')).toBe(true);
    expect(usaAlertDoReactNative("import {\n  Alert,\n  View,\n}")).toBe(true);
  });

  test("não confunde com os ícones do lucide nem com texto", () => {
    expect(usaAlertDoReactNative("<AlertTriangle size={20} />")).toBe(false);
    expect(usaAlertDoReactNative("<TriangleAlert />")).toBe(false);
    expect(usaAlertDoReactNative("// Feedback — Alerta")).toBe(false);
  });

  test("ignora o nome citado em comentário, mas não em código na linha seguinte", () => {
    expect(usaAlertDoReactNative("/* substitui Alert.alert */")).toBe(false);
    expect(usaAlertDoReactNative("// não use Alert.alert")).toBe(false);
    expect(usaAlertDoReactNative('// não use Alert.alert\nAlert.alert("x")')).toBe(true);
  });
});
