import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";

const ROOT = resolve(__dirname, "..");
// Built at runtime so this file does not match its own search.
const REMOVED_ROUTE = ["meal/[id]", "edit"].join("/");

describe("meal edit route", () => {
  test("no source file references the removed route", () => {
    let matches = "";
    try {
      matches = execFileSync("git", ["grep", "-nF", REMOVED_ROUTE, "--", "*.ts", "*.tsx"], {
        cwd: ROOT,
        encoding: "utf8",
      });
    } catch {
      // git grep exits 1 when nothing matches
    }

    expect(matches.split("\n").filter(Boolean)).toEqual([]);
  });
});
