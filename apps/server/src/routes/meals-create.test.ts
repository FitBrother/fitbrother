import { beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

type Op = { table: string; values: unknown; filters: Array<[string, string, unknown]> };

const db = vi.hoisted(() => ({
  rpcPayloads: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{
    table: string;
    values: unknown;
    filters: Array<[string, string, unknown]>;
  }>,
  failUpdate: false,
}));

function fakeSupabase() {
  return {
    rpc(name: string, args: { payload?: Record<string, unknown> }) {
      if (name === "create_meal_with_items") {
        db.rpcPayloads.push(args.payload!);
        return Promise.resolve({ data: { already_existed: false }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from(table: string) {
      const op: Op = { table, values: undefined, filters: [] };
      let isUpdate = false;
      const q = {
        update(values: unknown) {
          isUpdate = true;
          op.values = values;
          return q;
        },
        select() {
          return q;
        },
        eq(col: string, v: unknown) {
          op.filters.push(["eq", col, v]);
          return q;
        },
        is(col: string, v: unknown) {
          op.filters.push(["is", col, v]);
          return q;
        },
        maybeSingle() {
          return Promise.resolve({ data: { id: "meal" }, error: null });
        },
        then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
          if (isUpdate) db.updates.push(op);
          const error = isUpdate && db.failUpdate ? { message: "boom" } : null;
          return Promise.resolve({ data: null, error }).then(resolve, reject);
        },
      };
      return q;
    },
  };
}

vi.mock("../lib/auth.js", () => ({
  authRequired: async (req: { user?: unknown }) => {
    req.user = { id: "user-1", email: null, accessToken: "token" };
  },
  supabaseForRequest: () => fakeSupabase(),
}));

const extractionResult = {
  output: { meal_type: "lunch", confidence: 0.9, feedback: "", items: [] },
  cacheHit: false,
};
vi.mock("../services/extraction.js", () => ({ extractMeal: async () => extractionResult }));
vi.mock("../services/photo-extraction.js", () => ({
  extractMealFromPhoto: async () => extractionResult,
}));
vi.mock("../services/transcription.js", () => ({
  transcribeFromPath: async () => ({ text: "arroz", cacheHit: false }),
}));
vi.mock("../services/meals.js", () => ({
  applyCatalogToItems: async () => ({ applied: [] }),
  listMealsForNutritionalDay: async () => [],
  MEAL_DETAIL_SELECT: "*",
}));
vi.mock("../services/pipeline-events.js", () => ({
  runPipelineStage: (_req: unknown, _meta: unknown, fn: () => unknown) => fn(),
  recordPipelineStageResult: async () => {},
  recordPipelineEvent: async () => {},
  startTimer: () => 0,
}));
vi.mock("../services/openfoodfacts.js", () => ({
  lookupByBarcode: async () => ({
    name: "Iogurte",
    brand: null,
    serving_g: null,
    kcal_per_100g: 60,
    protein_per_100g: 4,
    carbs_per_100g: 6,
    fat_per_100g: 2,
    macros_complete: true,
  }),
}));

import { mealsRoutes } from "./meals.js";

const MEAL_ID = "00000000-0000-4000-8000-0000000000bb";
const IMAGE_PATH = `user-1/meal-photos/${MEAL_ID}.jpg`;

async function post(url: string, body: Record<string, unknown>) {
  const app = Fastify();
  await app.register(mealsRoutes);
  return app.inject({ method: "POST", url, payload: { client_meal_id: MEAL_ID, ...body } });
}

const bodies = {
  "/meals/text": { text: "arroz e feijão" },
  "/meals/audio": { audio_path: `user-1/${MEAL_ID}.m4a`, duration_s: 5 },
  "/meals/photo": { image_path: IMAGE_PATH },
} as const;

beforeEach(() => {
  db.rpcPayloads = [];
  db.updates = [];
  db.failUpdate = false;
});

describe("require_confirmation on AI meal creation", () => {
  it.each(Object.entries(bodies))("%s forwards require_confirmation: true", async (url, body) => {
    const res = await post(url, { ...body, require_confirmation: true });
    expect(res.statusCode).toBe(201);
    expect(db.rpcPayloads[0]?.require_confirmation).toBe(true);
  });

  it.each(Object.entries(bodies))("%s sends false when the client omits it", async (url, body) => {
    const res = await post(url, body);
    expect(res.statusCode).toBe(201);
    expect(db.rpcPayloads[0]?.require_confirmation).toBe(false);
  });

  it("rejects a non-boolean require_confirmation", async () => {
    const res = await post("/meals/text", { text: "arroz", require_confirmation: "yes" });
    expect(res.statusCode).toBe(400);
    expect(db.rpcPayloads).toEqual([]);
  });

  it("barcode never sends require_confirmation", async () => {
    const res = await post("/meals/barcode", {
      barcode: "789",
      quantity: 100,
      unit: "g",
      require_confirmation: true,
    });
    expect(res.statusCode).toBe(201);
    expect(db.rpcPayloads[0]).not.toHaveProperty("require_confirmation");
  });
});

describe("POST /meals/photo image_path", () => {
  it("stores the validated photo path on the new meal", async () => {
    await post("/meals/photo", { image_path: IMAGE_PATH });
    expect(db.updates).toEqual([
      {
        table: "meals",
        values: { image_path: IMAGE_PATH },
        filters: [
          ["eq", "id", MEAL_ID],
          ["is", "image_path", null],
        ],
      },
    ]);
  });

  it("still answers 201 when storing the path fails", async () => {
    db.failUpdate = true;
    const res = await post("/meals/photo", { image_path: IMAGE_PATH });
    expect(res.statusCode).toBe(201);
  });

  it("does not touch image_path for a path outside the caller's folder", async () => {
    const res = await post("/meals/photo", { image_path: "user-2/meal-photos/x.jpg" });
    expect(res.statusCode).toBe(403);
    expect(db.updates).toEqual([]);
  });
});
