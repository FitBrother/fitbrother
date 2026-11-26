import { describe, expect, it } from "vitest";
import { buildMealPatch, buildPatchItemRows } from "./meals.js";

const CTX = { userId: "user-1", mealId: "meal-1" };

describe("buildMealPatch", () => {
  it("deriva image_path do usuário autenticado quando has_photo é true", () => {
    expect(buildMealPatch({ has_photo: true }, CTX)).toEqual({
      image_path: "user-1/meal-photos/meal-1.jpg",
    });
  });

  it("ignora image_path vindo do corpo", () => {
    // O cliente não manda caminho. Com o vazamento que a 0081 corrigiu ele
    // poderia apontar para a foto de alguém que segue, e a URL assinada
    // funcionaria. Mesmo corrigido, validar path do cliente é superfície que
    // não precisa existir — a RLS de storage governa quem LÊ o objeto, não o
    // que a linha de `meals` diz.
    const patch = buildMealPatch(
      { has_photo: true, image_path: "outro-user/meal-photos/alheia.jpg" } as never,
      CTX,
    );
    expect(patch.image_path).toBe("user-1/meal-photos/meal-1.jpg");
  });

  it("has_photo false não mexe em image_path", () => {
    // Não é "apagar a foto" — é "não estou falando de foto agora". Remover
    // foto não é um caso que esta feature tem.
    expect(buildMealPatch({ has_photo: false }, CTX)).toEqual({});
  });

  it("continua montando os campos que já existiam", () => {
    expect(
      buildMealPatch({ meal_type: "lunch", consumed_at: "2026-10-11T12:00:00.000Z" }, CTX),
    ).toEqual({ meal_type: "lunch", consumed_at: "2026-10-11T12:00:00.000Z" });
  });

  it("devolve objeto vazio quando não há nada para mudar", () => {
    // A rota usa isso para decidir se faz UPDATE: um patch vazio não deve
    // disparar escrita nenhuma.
    expect(buildMealPatch({}, CTX)).toEqual({});
  });

  it("não leva confirm para o UPDATE de metadados", () => {
    expect(buildMealPatch({ confirm: true, meal_type: "lunch" }, CTX)).toEqual({
      meal_type: "lunch",
    });
  });

  it("combina foto com os outros campos", () => {
    expect(buildMealPatch({ has_photo: true, meal_type: "dinner" }, CTX)).toEqual({
      meal_type: "dinner",
      image_path: "user-1/meal-photos/meal-1.jpg",
    });
  });
});

describe("buildPatchItemRows", () => {
  const item = {
    id: "00000000-0000-4000-8000-000000000001",
    description: "arroz",
    quantity: 1,
    unit: "unit" as const,
    kcal: 1,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
  };

  it("preserva food_id quando presente", () => {
    const rows = buildPatchItemRows("m1", [{ ...item, food_id: "f1" }]);
    expect(rows[0]?.food_id).toBe("f1");
    expect(rows[0]?.meal_id).toBe("m1");
  });

  it("grava food_id null quando ausente ou null", () => {
    expect(buildPatchItemRows("m1", [item])[0]?.food_id).toBeNull();
    expect(buildPatchItemRows("m1", [{ ...item, food_id: null }])[0]?.food_id).toBeNull();
  });
});
