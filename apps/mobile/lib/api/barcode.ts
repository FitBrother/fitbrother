import type { BarcodeProduct, MealResponse, CreateMealBarcodeRequest } from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";
import { QuotaExceededError } from "./meals";

export class ProductNotFoundError extends Error {
  constructor(public barcode: string) {
    super("product_not_found");
  }
}

export async function lookupBarcodeProduct(barcode: string): Promise<BarcodeProduct> {
  const res = await authedFetch(`/meals/barcode/${encodeURIComponent(barcode)}`);
  if (!res.ok) {
    if (res.status === 404) throw new ProductNotFoundError(barcode);
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `request_failed_${res.status}`);
  }
  const body = (await res.json()) as { product: BarcodeProduct };
  return body.product;
}

export async function createMealBarcode(
  input: CreateMealBarcodeRequest,
): Promise<{ meal: MealResponse; already_existed: boolean }> {
  const res = await authedFetch("/meals/barcode", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    if (res.status === 404) throw new ProductNotFoundError(input.barcode);
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      throw new QuotaExceededError(body.kind ?? "llm");
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `request_failed_${res.status}`);
  }
  return (await res.json()) as { meal: MealResponse; already_existed: boolean };
}
