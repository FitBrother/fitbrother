import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { normalizeFoodQuery, searchFoods } from "./food-search.js";

const FOOD_ID = "11111111-1111-4111-8111-111111111111";

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

const catalogRow = {
  kind: "catalog",
  food_id: FOOD_ID,
  name: "Feijão, carioca, cozido",
  serving_label: "concha",
  serving_grams: 140,
  kcal_per_100g: 76,
  protein_per_100g: 4.8,
  carbs_per_100g: 13.6,
  fat_per_100g: 0.5,
  quantity: null,
  unit: null,
  kcal: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  score: 0.9,
};

describe("normalizeFoodQuery", () => {
  it("remove acentos, caixa e espaços extras", () => {
    expect(normalizeFoodQuery("  FEIJÃO  ")).toBe("feijao");
  });

  it("remove vírgulas e colapsa espaços", () => {
    expect(normalizeFoodQuery("Arroz, Branco")).toBe("arroz branco");
  });

  it("string vazia continua vazia", () => {
    expect(normalizeFoodQuery("   ")).toBe("");
  });
});

describe("searchFoods", () => {
  it("chama a RPC com a query normalizada e limite 8", async () => {
    const { client, rpc } = fakeClient({ data: [catalogRow], error: null });
    const out = await searchFoods(client, "  FEIJÃO  ");
    expect(rpc).toHaveBeenCalledWith("fitbrother_foods_autocomplete", {
      p_query: "feijao",
      p_limit: 8,
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.food_id).toBe(FOOD_ID);
    expect(out[0]).not.toHaveProperty("score");
  });

  it("aceita numeric vindo como string do PostgREST", async () => {
    const { client } = fakeClient({
      data: [{ ...catalogRow, kcal_per_100g: "76.00", serving_grams: "140.00" }],
      error: null,
    });
    const out = await searchFoods(client, "feijao");
    expect(out[0]?.kcal_per_100g).toBe(76);
    expect(out[0]?.serving_grams).toBe(140);
  });

  it("aceita linha recent com quantidade e macros prontos", async () => {
    const { client } = fakeClient({
      data: [
        {
          ...catalogRow,
          kind: "recent",
          quantity: 2,
          unit: "unit",
          kcal: 140,
          protein_g: 12,
          carbs_g: 1,
          fat_g: 10,
        },
      ],
      error: null,
    });
    const out = await searchFoods(client, "");
    expect(out[0]).toMatchObject({ kind: "recent", quantity: 2, unit: "unit", kcal: 140 });
  });

  it("data nulo vira lista vazia", async () => {
    const { client } = fakeClient({ data: null, error: null });
    expect(await searchFoods(client, "x")).toEqual([]);
  });

  it("erro da RPC vira exceção com prefixo", async () => {
    const { client } = fakeClient({ data: null, error: { message: "boom" } });
    await expect(searchFoods(client, "feijao")).rejects.toThrow("foods_autocomplete_failed: boom");
  });
});
