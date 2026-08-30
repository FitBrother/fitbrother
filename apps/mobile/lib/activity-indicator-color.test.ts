import { describe, expect, test } from "@jest/globals";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Um <ActivityIndicator> sem prop `color` renderiza azul (#1976D2) no
// react-native-web, destoando da menta da marca. Este guard trava a regra
// para todo o app, não só para o caso que originou o fix.
const ROOT = resolve(__dirname, "..");

function walkTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walkTsx(full);
    return full.endsWith(".tsx") && !full.endsWith(".test.tsx") ? [full] : [];
  });
}

/** Extrai cada tag de abertura `<ActivityIndicator ... />` do fonte. */
function activityIndicatorTags(source: string): string[] {
  const tags: string[] = [];
  let idx = source.indexOf("<ActivityIndicator");
  while (idx !== -1) {
    const end = source.indexOf("/>", idx);
    tags.push(source.slice(idx, end === -1 ? source.length : end));
    idx = source.indexOf("<ActivityIndicator", idx + 1);
  }
  return tags;
}

const files = ["app", "components"]
  .flatMap((d) => walkTsx(join(ROOT, d)))
  .filter((f) => readFileSync(f, "utf8").includes("<ActivityIndicator"));

describe("ActivityIndicator usa a cor da marca", () => {
  test("há usos de ActivityIndicator para vigiar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(files)("%s passa color explicitamente", (file) => {
    for (const tag of activityIndicatorTags(readFileSync(file, "utf8"))) {
      expect(tag).toMatch(/color=/);
    }
  });
});
