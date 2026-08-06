import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { Platform } from "react-native";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        createSignedUrl: jest.fn(),
      })),
    },
  },
}));

import { uploadAvatar, uploadMealPhoto } from "./storage";
import { supabase } from "./supabase";

const mockFrom = jest.mocked(supabase.storage.from);
const mockUpload = jest.fn();

const originalPlatform = Platform.OS;

describe("image storage uploads", () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockFrom.mockReturnValue({
      upload: mockUpload,
      createSignedUrl: jest.fn(),
    } as never);
    mockUpload.mockReset();
    mockUpload.mockResolvedValue({ error: null } as never);
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
    jest.restoreAllMocks();
  });

  test("uploads a non-empty Blob on web", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    const blob = new Blob(["image-bytes"], { type: "image/png" });
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(blob, { status: 200 }));

    await uploadMealPhoto({ userId: "user-1", mealId: "meal-1", fileUri: "blob:photo" });

    expect(mockUpload).toHaveBeenCalledWith("user-1/meal-photos/meal-1.jpg", blob, {
      contentType: "image/png",
      upsert: false,
    });
  });

  test("rejects an empty image before uploading on web", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(new Blob([], { type: "image/jpeg" }), { status: 200 }));

    await expect(uploadAvatar({ userId: "user-1", fileUri: "blob:empty" })).rejects.toThrow(
      "empty_image_file",
    );
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test("keeps the React Native FormData upload body", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });

    await uploadAvatar({ userId: "user-1", fileUri: "file:///avatar.jpg" });

    expect(mockUpload).toHaveBeenCalledWith("user-1/avatar.jpg", expect.any(FormData), {
      contentType: "image/jpeg",
      upsert: true,
    });
  });
});
