import { describe, expect, it } from "vitest";
import { AccountSettingsResponseSchema, PatchAccountSettingsRequestSchema } from "./schemas";

describe("contrato do tour guiado", () => {
  it("aceita tutorial_completed como campo opcional do PATCH de settings", () => {
    expect(PatchAccountSettingsRequestSchema.safeParse({}).success).toBe(true);
    expect(PatchAccountSettingsRequestSchema.safeParse({ tutorial_completed: true }).success).toBe(
      true,
    );
    // Só aceita `true` — não existe caso de uso pra "desmarcar" via cliente.
    expect(PatchAccountSettingsRequestSchema.safeParse({ tutorial_completed: false }).success).toBe(
      false,
    );
  });

  it("a resposta de settings inclui tutorial_completed_at nullable", () => {
    const base = {
      timezone: "America/Sao_Paulo",
      day_start_hour: 0,
      updated_at: "2026-09-17T00:00:00Z",
    };
    expect(
      AccountSettingsResponseSchema.safeParse({
        settings: { ...base, tutorial_completed_at: null },
      }).success,
    ).toBe(true);
    expect(
      AccountSettingsResponseSchema.safeParse({
        settings: { ...base, tutorial_completed_at: "2026-09-17T12:00:00Z" },
      }).success,
    ).toBe(true);
    expect(AccountSettingsResponseSchema.safeParse({ settings: base }).success).toBe(false);
  });
});
