import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockAuthedFetch = jest.fn<(path: string, init?: RequestInit) => Promise<Response>>();
jest.mock("@/lib/api", () => ({
  authedFetch: (...args: [string, RequestInit?]) => mockAuthedFetch(...args),
}));

import { createMealAudio, createMealPhoto, createMealText } from "./meals";

const ID = "00000000-0000-4000-8000-000000000001";

function sentBody(call = 0) {
  return JSON.parse(String(mockAuthedFetch.mock.calls[call]![1]!.body)) as Record<string, unknown>;
}

beforeEach(() => {
  mockAuthedFetch.mockReset();
  mockAuthedFetch.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify({ meal: { id: ID } }), { status: 201 })),
  );
});

describe("AI meal creation asks for confirmation", () => {
  test("text sends require_confirmation: true", async () => {
    await createMealText({ client_meal_id: ID, text: "arroz", locale: "pt-BR" });
    expect(mockAuthedFetch.mock.calls[0]![0]).toBe("/meals/text");
    expect(sentBody()).toEqual({
      client_meal_id: ID,
      text: "arroz",
      locale: "pt-BR",
      require_confirmation: true,
    });
  });

  test("audio sends require_confirmation: true", async () => {
    await createMealAudio({
      client_meal_id: ID,
      audio_path: "u/a.m4a",
      duration_s: 3,
      locale: "pt-BR",
    });
    expect(mockAuthedFetch.mock.calls[0]![0]).toBe("/meals/audio");
    expect(sentBody().require_confirmation).toBe(true);
  });

  test("photo sends require_confirmation: true", async () => {
    await createMealPhoto({ client_meal_id: ID, image_path: "u/p.jpg", locale: "pt-BR" });
    expect(mockAuthedFetch.mock.calls[0]![0]).toBe("/meals/photo");
    expect(sentBody().require_confirmation).toBe(true);
  });
});
