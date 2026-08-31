import { beforeEach, describe, expect, it, vi } from "vitest";

const createSignedUrls = vi.fn();
vi.mock("./supabase.js", () => ({
  supabaseService: () => ({ storage: { from: () => ({ createSignedUrls }) } }),
}));

const { signAvatarUrls, withSignedAvatars } = await import("./avatars.js");

describe("signAvatarUrls", () => {
  beforeEach(() => {
    createSignedUrls.mockReset();
  });

  it("não chama o Storage quando ninguém tem avatar", async () => {
    expect(await signAvatarUrls([null, undefined])).toEqual(new Map());
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("assina cada caminho uma vez só", async () => {
    // Dois posts do mesmo autor no feed repetem o caminho; assinar duas vezes
    // seria uma chamada de Storage desperdiçada.
    createSignedUrls.mockResolvedValue({
      data: [{ path: "u1/avatar.jpg", signedUrl: "https://s/u1", error: null }],
      error: null,
    });

    const assinadas = await signAvatarUrls(["u1/avatar.jpg", "u1/avatar.jpg"]);

    expect(createSignedUrls).toHaveBeenCalledWith(["u1/avatar.jpg"], 3600);
    expect(assinadas.get("u1/avatar.jpg")).toBe("https://s/u1");
  });

  it("devolve Map vazio quando o Storage falha", async () => {
    createSignedUrls.mockResolvedValue({ data: null, error: new Error("boom") });

    expect(await signAvatarUrls(["u1/avatar.jpg"])).toEqual(new Map());
  });

  it("ignora itens sem URL assinada", async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: "u1/avatar.jpg", signedUrl: null, error: "not found" },
        { path: "u2/avatar.jpg", signedUrl: "https://s/u2", error: null },
      ],
      error: null,
    });

    const assinadas = await signAvatarUrls(["u1/avatar.jpg", "u2/avatar.jpg"]);

    expect(assinadas.has("u1/avatar.jpg")).toBe(false);
    expect(assinadas.get("u2/avatar.jpg")).toBe("https://s/u2");
  });
});

describe("withSignedAvatars", () => {
  it("troca o caminho pela URL assinada", () => {
    const assinadas = new Map([["u1/avatar.jpg", "https://s/u1"]]);

    expect(withSignedAvatars([{ avatar_url: "u1/avatar.jpg" }], assinadas)).toEqual([
      { avatar_url: "https://s/u1" },
    ]);
  });

  it("zera o caminho que não foi assinado", () => {
    // O cliente não consegue assinar avatar de terceiros (policy da 0040), então
    // vazar o caminho cru renderizaria uma Image quebrada em vez das iniciais.
    expect(withSignedAvatars([{ avatar_url: "u1/avatar.jpg" }], new Map())).toEqual([
      { avatar_url: null },
    ]);
  });

  it("preserva os demais campos do perfil", () => {
    const perfis = [{ user_id: "u1", username: "ana", avatar_url: null }];

    expect(withSignedAvatars(perfis, new Map())).toEqual([
      { user_id: "u1", username: "ana", avatar_url: null },
    ]);
  });
});
