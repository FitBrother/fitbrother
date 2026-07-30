import { test } from "node:test";
import assert from "node:assert/strict";
import { findBlocklistViolations } from "./scan.js";

const BLOCKLIST = ["prescrição", "sua dieta"] as const;

test("retorna lista vazia quando nenhum arquivo tem termo da blocklist", () => {
  const files = [{ path: "a.tsx", content: "export const x = 'metas estimadas';" }];
  assert.deepEqual(findBlocklistViolations(files, BLOCKLIST), []);
});

test("detecta um termo da blocklist e reporta arquivo/linha/termo", () => {
  const files = [
    { path: "a.tsx", content: "const s = 'ok';\nconst t = 'isso é uma prescrição médica';" },
  ];
  const violations = findBlocklistViolations(files, BLOCKLIST);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, "a.tsx");
  assert.equal(violations[0].line, 2);
  assert.equal(violations[0].term, "prescrição");
});

test("detecta o termo independente de maiúsculas/minúsculas", () => {
  const files = [{ path: "b.tsx", content: "const s = 'PRESCRIÇÃO aqui';" }];
  const violations = findBlocklistViolations(files, BLOCKLIST);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].term, "prescrição");
});

test("detecta múltiplas violações em múltiplos arquivos", () => {
  const files = [
    { path: "a.tsx", content: "const s = 'sua dieta';" },
    { path: "b.tsx", content: "const t = 'nada aqui';" },
    { path: "c.tsx", content: "const u = 'prescrição';" },
  ];
  const violations = findBlocklistViolations(files, BLOCKLIST);
  assert.equal(violations.length, 2);
  assert.deepEqual(violations.map((v) => v.file).sort(), ["a.tsx", "c.tsx"]);
});

test("detecta duas violações na mesma linha", () => {
  const files = [{ path: "a.tsx", content: "const s = 'prescrição e sua dieta juntas';" }];
  const violations = findBlocklistViolations(files, BLOCKLIST);
  assert.equal(violations.length, 2);
});
