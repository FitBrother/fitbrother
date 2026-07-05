/**
 * OpenFoodFacts product lookup by barcode (EAN/UPC).
 *
 * M12 — Barcode registration. The OFF API v2 is free and requires no API key.
 * We set a custom User-Agent per their guidelines.
 *
 * Coverage varies by region — Brazilian products may be missing or have
 * incomplete nutriments. Callers must handle null returns and partial macros.
 */

/** Normalized product data extracted from OpenFoodFacts. */
export type OFFProduct = {
  /** Product display name. */
  name: string;
  /** Brand(s), if available. */
  brand: string | null;
  /** URL to front product image, if available. */
  image_url: string | null;
  /** Barcode that was looked up. */
  barcode: string;
  /** kcal per 100g. Null if not available. */
  kcal_per_100g: number | null;
  /** Protein per 100g. Null if not available. */
  protein_per_100g: number | null;
  /** Carbs per 100g. Null if not available. */
  carbs_per_100g: number | null;
  /** Fat per 100g. Null if not available. */
  fat_per_100g: number | null;
  /** Standard serving size in grams, if available. */
  serving_g: number | null;
  /** Whether macros are complete (all 4 values present). */
  macros_complete: boolean;
};

const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";
const USER_AGENT = "Fitbrother/1.0 (https://fitbrother.app)";
const TIMEOUT_MS = 5_000;

/**
 * Lookup a product by barcode on OpenFoodFacts.
 *
 * Returns `null` when the product is not found (`status !== 1`), when the
 * response has no `product_name`, or on network/timeout errors.
 */
export async function lookupByBarcode(barcode: string): Promise<OFFProduct | null> {
  const url = `${OFF_BASE}/${encodeURIComponent(barcode)}.json`;

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // Network error or timeout — treat as not found.
    return null;
  }

  if (!res.ok) return null;

  let body: OFFResponse;
  try {
    body = (await res.json()) as OFFResponse;
  } catch {
    return null;
  }

  if (body.status !== 1 || !body.product) return null;

  const p = body.product;
  const name = p.product_name?.trim();
  if (!name) return null;

  const kcal = safeNum(p.nutriments?.["energy-kcal_100g"]);
  const protein = safeNum(p.nutriments?.proteins_100g);
  const carbs = safeNum(p.nutriments?.carbohydrates_100g);
  const fat = safeNum(p.nutriments?.fat_100g);

  return {
    name,
    brand: p.brands?.trim() || null,
    image_url: p.image_front_url || p.image_front_small_url || null,
    barcode,
    kcal_per_100g: kcal,
    protein_per_100g: protein,
    carbs_per_100g: carbs,
    fat_per_100g: fat,
    serving_g: safeNum(p.serving_quantity),
    macros_complete: kcal != null && protein != null && carbs != null && fat != null,
  };
}

/* ── Internal types (partial OFF API response) ─────────────────────────── */

type OFFResponse = {
  status?: number;
  product?: {
    product_name?: string;
    brands?: string;
    image_front_url?: string;
    image_front_small_url?: string;
    serving_quantity?: unknown;
    nutriments?: {
      "energy-kcal_100g"?: unknown;
      proteins_100g?: unknown;
      carbohydrates_100g?: unknown;
      fat_100g?: unknown;
    };
  };
};

/** Safely coerce unknown to number | null. */
function safeNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
