import { beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

type Meal = { id: string; review_required: boolean; meal_type: string; items: unknown[] };
type Op = { table: string; op: "update" | "delete" | "insert"; values?: unknown };

const db = vi.hoisted(() => ({
  meal: null as Meal | null,
  ops: [] as Op[],
  failInsert: false,
}));

function fakeSupabase() {
  return {
    from(table: string) {
      const q = {
        _op: "select" as "select" | "update" | "delete" | "insert",
        _values: undefined as unknown,
        update(values: Record<string, unknown>) {
          q._op = "update";
          q._values = values;
          return q;
        },
        delete() {
          q._op = "delete";
          return q;
        },
        insert(values: unknown) {
          q._op = "insert";
          q._values = values;
          return Promise.resolve(run());
        },
        select() {
          return q;
        },
        eq() {
          return q;
        },
        is() {
          return q;
        },
        maybeSingle() {
          return Promise.resolve({ data: db.meal ? { ...db.meal } : null, error: null });
        },
        then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      function run() {
        if (q._op === "select") return { data: null, error: null };
        db.ops.push({ table, op: q._op, values: q._values });
        if (table === "meal_items" && q._op === "insert" && db.failInsert) {
          return { data: null, error: { message: "insert failed" } };
        }
        if (table === "meals" && q._op === "update" && db.meal) {
          Object.assign(db.meal, q._values as object);
        }
        if (table === "meal_items" && q._op === "delete" && db.meal) db.meal.items = [];
        if (table === "meal_items" && q._op === "insert" && db.meal) {
          db.meal.items = q._values as unknown[];
        }
        return { data: null, error: null };
      }
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

import { mealsRoutes } from "./meals.js";

const MEAL_ID = "00000000-0000-4000-8000-0000000000aa";
const item = {
  description: "Arroz",
  quantity: 100,
  unit: "g",
  kcal: 128,
  protein_g: 2.5,
  carbs_g: 28,
  fat_g: 0.2,
};

async function patch(body: unknown) {
  const app = Fastify();
  await app.register(mealsRoutes);
  return app.inject({ method: "PATCH", url: `/meals/${MEAL_ID}`, payload: body as object });
}

const reviewFlips = () =>
  db.ops.filter(
    (o) => o.table === "meals" && o.op === "update" && "review_required" in (o.values as object),
  );

beforeEach(() => {
  db.meal = { id: MEAL_ID, review_required: true, meal_type: "other", items: [] };
  db.ops = [];
  db.failInsert = false;
});

describe("PATCH /meals/:id confirm", () => {
  it("confirms after replacing items and returns the confirmed meal", async () => {
    const res = await patch({ confirm: true, items: [item], meal_type: "lunch" });
    expect(res.statusCode).toBe(200);
    expect(res.json().meal.review_required).toBe(false);
    expect(res.json().meal.meal_type).toBe("lunch");
    const flipAt = db.ops.findIndex((o) => o === reviewFlips()[0]);
    const insertAt = db.ops.findIndex((o) => o.table === "meal_items" && o.op === "insert");
    expect(insertAt).toBeGreaterThanOrEqual(0);
    expect(flipAt).toBeGreaterThan(insertAt);
  });

  it("rejects out-of-bounds items with 400 and leaves the meal pending", async () => {
    const res = await patch({ confirm: true, items: [{ ...item, quantity: 100000 }] });
    expect(res.statusCode).toBe(400);
    expect(db.ops).toEqual([]);
    expect(db.meal?.review_required).toBe(true);
  });

  it("does not confirm when the item insert fails", async () => {
    db.failInsert = true;
    const res = await patch({ confirm: true, items: [item] });
    expect(res.statusCode).toBe(500);
    expect(reviewFlips()).toEqual([]);
    expect(db.meal?.review_required).toBe(true);
  });

  it("leaves a pending meal pending when confirm is omitted or false", async () => {
    expect((await patch({ items: [item] })).json().meal.review_required).toBe(true);
    expect((await patch({ confirm: false, meal_type: "dinner" })).json().meal.review_required).toBe(
      true,
    );
    expect(reviewFlips()).toEqual([]);
  });

  it("confirms with confirm alone", async () => {
    const res = await patch({ confirm: true });
    expect(res.statusCode).toBe(200);
    expect(res.json().meal.review_required).toBe(false);
    expect(db.ops).toEqual([{ table: "meals", op: "update", values: { review_required: false } }]);
  });

  it("is idempotent when the meal is already confirmed", async () => {
    expect((await patch({ confirm: true })).statusCode).toBe(200);
    const res = await patch({ confirm: true });
    expect(res.statusCode).toBe(200);
    expect(res.json().meal.review_required).toBe(false);
  });

  it("returns 404 when the meal is not visible", async () => {
    db.meal = null;
    expect((await patch({ confirm: true })).statusCode).toBe(404);
  });
});
