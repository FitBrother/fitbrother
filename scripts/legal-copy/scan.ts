export type ScannedFile = { path: string; content: string };
export type Violation = { file: string; line: number; term: string };

/** Função pura: não lê disco, só varre o conteúdo já carregado em memória. */
export function findBlocklistViolations(
  files: ScannedFile[],
  blocklist: readonly string[],
): Violation[] {
  const violations: Violation[] = [];

  for (const file of files) {
    const lines = file.content.split("\n");
    lines.forEach((lineText, index) => {
      const lowerLine = lineText.toLowerCase();
      for (const term of blocklist) {
        if (lowerLine.includes(term.toLowerCase())) {
          violations.push({ file: file.path, line: index + 1, term });
        }
      }
    });
  }

  return violations;
}
