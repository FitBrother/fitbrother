import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LEGAL_BLOCKLIST } from "../packages/shared/src/copy/goals.js";
import { findBlocklistViolations, type ScannedFile } from "./legal-copy/scan.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCAN_ROOT = join(__dirname, "..", "apps", "mobile");
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const IGNORED_DIR_NAMES = new Set(["node_modules", ".expo", "dist", "android", "ios", ".git"]);

function collectFiles(dir: string): ScannedFile[] {
  const files: ScannedFile[] = [];
  for (const entryName of readdirSync(dir)) {
    if (IGNORED_DIR_NAMES.has(entryName)) continue;
    const fullPath = join(dir, entryName);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (SOURCE_EXTENSIONS.some((ext) => entryName.endsWith(ext))) {
      files.push({ path: fullPath, content: readFileSync(fullPath, "utf8") });
    }
  }
  return files;
}

const files = collectFiles(SCAN_ROOT);
const violations = findBlocklistViolations(files, LEGAL_BLOCKLIST);

if (violations.length > 0) {
  console.error("Termos proibidos de copy legal encontrados em apps/mobile:\n");
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line} — "${violation.term}"`);
  }
  console.error(
    `\n${violations.length} violação(ões). Ver LEGAL_BLOCKLIST em packages/shared/src/copy/goals.ts — ` +
      "esses termos são reservados a nutricionista/médico no Brasil.",
  );
  process.exit(1);
}

console.error("OK: nenhum termo da blocklist de copy legal encontrado em apps/mobile.");
