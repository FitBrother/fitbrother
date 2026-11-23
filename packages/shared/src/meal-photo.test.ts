import { describe, expect, it } from "vitest";
import { mealPhotoPath } from "./schemas";

describe("mealPhotoPath", () => {
  it("monta o path dentro da pasta do usuário", () => {
    // A RLS de storage exige `(storage.foldername(name))[1] = auth.uid()`:
    // o id do usuário TEM que ser o primeiro segmento.
    expect(mealPhotoPath("user-1", "meal-1")).toBe("user-1/meal-photos/meal-1.jpg");
  });

  it("mantém a subpasta que separa foto de refeição de foto de post", () => {
    const path = mealPhotoPath("11111111-1111-4111-8111-111111111111", "meal-9");
    // `meal-photos/` é o que a política da 0081 usa para distinguir o privado
    // do publicado: a foto de post se chama `{userId}/post-{postId}.jpg` e é a
    // única que quem te segue pode ler.
    expect(path).toContain("/meal-photos/");
    expect(path).not.toContain("/post-");
  });
});
