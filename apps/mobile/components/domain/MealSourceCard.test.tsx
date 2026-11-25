import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { MealResponse } from "@fitbrother/shared";

const mockSignedUrl = jest.fn<(path: string) => Promise<string>>();
jest.mock("@/lib/storage", () => ({
  getPostImageSignedUrl: (path: string) => mockSignedUrl(path),
}));

import { MealSourceCard } from "./MealSourceCard";

const item = { id: "i" } as unknown as MealResponse["items"][number];

function meal(over: Partial<MealResponse>): MealResponse {
  return {
    source: "app_text",
    raw_input: null,
    image_path: null,
    items: [item],
    ...over,
  } as MealResponse;
}

describe("MealSourceCard", () => {
  beforeEach(() => {
    mockSignedUrl.mockReset();
  });

  test("text meals show what the user wrote", () => {
    render(<MealSourceCard meal={meal({ raw_input: "arroz e feijão" })} />);
    expect(screen.getByText("Você escreveu")).toBeTruthy();
    expect(screen.getByText("“arroz e feijão”")).toBeTruthy();
  });

  test.each(["app_audio", "wa_audio"] as const)("%s meals show what the user said", (source) => {
    render(<MealSourceCard meal={meal({ source, raw_input: "um pão com ovo" })} />);
    expect(screen.getByText("Você disse")).toBeTruthy();
    expect(screen.getByText("“um pão com ovo”")).toBeTruthy();
  });

  test.each([null, "   "])("renders nothing without words (%s)", (raw) => {
    const view = render(<MealSourceCard meal={meal({ source: "app_audio", raw_input: raw })} />);
    expect(view.toJSON()).toBeNull();
  });

  test("barcode meals render nothing even with a raw input", () => {
    const view = render(
      <MealSourceCard meal={meal({ source: "app_barcode", raw_input: "Código de barras: 789" })} />,
    );
    expect(view.toJSON()).toBeNull();
  });

  test("photo meals show the thumbnail, the label and the item count", async () => {
    mockSignedUrl.mockResolvedValue("https://signed/photo.jpg");
    render(
      <MealSourceCard
        meal={meal({
          source: "app_photo",
          raw_input: "Foto: u/m.jpg",
          image_path: "u/m.jpg",
          items: [item, item],
        })}
      />,
    );
    expect(screen.getByText("Foto do prato")).toBeTruthy();
    expect(screen.getByText("Identifiquei 2 itens na foto")).toBeTruthy();
    expect(screen.queryByText(/Foto: u/)).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId("meal-source-photo").props.source).toEqual({
        uri: "https://signed/photo.jpg",
      }),
    );
    expect(mockSignedUrl).toHaveBeenCalledWith("u/m.jpg");
  });

  test("a single photo item uses the singular", () => {
    render(<MealSourceCard meal={meal({ source: "app_photo", image_path: null })} />);
    expect(screen.getByText("Identifiquei 1 item na foto")).toBeTruthy();
  });

  test("a photo without a path shows the placeholder", () => {
    render(<MealSourceCard meal={meal({ source: "app_photo", image_path: null })} />);
    expect(screen.getByTestId("meal-source-photo-placeholder")).toBeTruthy();
    expect(mockSignedUrl).not.toHaveBeenCalled();
  });

  test("a failed signed URL falls back to the placeholder", async () => {
    mockSignedUrl.mockRejectedValue(new Error("nope"));
    render(<MealSourceCard meal={meal({ source: "app_photo", image_path: "u/m.jpg" })} />);
    await waitFor(() => expect(mockSignedUrl).toHaveBeenCalled());
    expect(screen.getByTestId("meal-source-photo-placeholder")).toBeTruthy();
    expect(screen.queryByTestId("meal-source-photo")).toBeNull();
  });

  test("an image that fails to load falls back to the placeholder", async () => {
    mockSignedUrl.mockResolvedValue("https://signed/photo.jpg");
    render(<MealSourceCard meal={meal({ source: "app_photo", image_path: "u/m.jpg" })} />);
    const image = await screen.findByTestId("meal-source-photo");
    fireEvent(image, "error");
    expect(screen.getByTestId("meal-source-photo-placeholder")).toBeTruthy();
  });
});
