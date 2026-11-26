import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockSignedUrl = jest.fn<(path: string) => Promise<string>>();
jest.mock("@/lib/storage", () => ({
  getPostImageSignedUrl: (path: string) => mockSignedUrl(path),
}));

import { MealPhotoThumb, photoPath } from "./MealPhotoThumb";

describe("photoPath", () => {
  test("prefers image_path over the raw_input path", () => {
    expect(photoPath({ raw_input: "Foto: u/old.jpg", image_path: "u/new.jpg" })).toBe("u/new.jpg");
  });

  test("falls back to the path in raw_input when image_path is missing", () => {
    expect(photoPath({ raw_input: "Foto: u/meal-photos/m.jpg", image_path: null })).toBe(
      "u/meal-photos/m.jpg",
    );
  });

  test.each([null, "arroz", "Foto: "])("ignores a raw_input without a photo path (%s)", (raw) => {
    expect(photoPath({ raw_input: raw, image_path: null })).toBeNull();
  });
});

describe("MealPhotoThumb", () => {
  beforeEach(() => {
    mockSignedUrl.mockReset();
  });

  test("shows the signed image", async () => {
    mockSignedUrl.mockResolvedValue("https://signed/photo.jpg");
    render(<MealPhotoThumb path="u/m.jpg" />);
    await waitFor(() =>
      expect(screen.getByTestId("meal-source-photo").props.source).toEqual({
        uri: "https://signed/photo.jpg",
      }),
    );
    expect(mockSignedUrl).toHaveBeenCalledWith("u/m.jpg");
  });

  test("without a path shows the placeholder", () => {
    render(<MealPhotoThumb path={null} />);
    expect(screen.getByTestId("meal-source-photo-placeholder")).toBeTruthy();
    expect(mockSignedUrl).not.toHaveBeenCalled();
  });

  test("a failed signed URL falls back to the placeholder", async () => {
    mockSignedUrl.mockRejectedValue(new Error("nope"));
    render(<MealPhotoThumb path="u/m.jpg" />);
    await waitFor(() => expect(mockSignedUrl).toHaveBeenCalled());
    expect(screen.getByTestId("meal-source-photo-placeholder")).toBeTruthy();
    expect(screen.queryByTestId("meal-source-photo")).toBeNull();
  });

  test("an image that fails to load falls back to the placeholder", async () => {
    mockSignedUrl.mockResolvedValue("https://signed/photo.jpg");
    render(<MealPhotoThumb path="u/m.jpg" size="lg" />);
    const image = await screen.findByTestId("meal-source-photo");
    fireEvent(image, "error");
    expect(screen.getByTestId("meal-source-photo-placeholder")).toBeTruthy();
  });
});
