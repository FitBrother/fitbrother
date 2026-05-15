import { z } from "zod";

/* ─── Enums (mirror Postgres) ────────────────────────────────────────────── */

export const MealTypeSchema = z.enum(["breakfast", "lunch", "snack", "dinner", "other"]);
export const UnitSchema = z.enum(["g", "ml", "unit", "slice", "cup", "tbsp", "tsp"]);
export const SexSchema = z.enum(["male", "female", "other"]);
export const ActivityLevelSchema = z.enum([
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
]);
export const GoalSchema = z.enum(["lose", "maintain", "gain", "recomp"]);

/* ─── Meal extraction (LLM output, FEATURES §4.2) ────────────────────────── */

export const MealItemExtractionSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: UnitSchema,
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  food_match_hint: z.string().optional(),
});

export const MealExtractionSchema = z.object({
  meal_type: MealTypeSchema,
  items: z.array(MealItemExtractionSchema).min(1),
  confidence: z.number().min(0).max(1),
});

export type MealItemExtraction = z.infer<typeof MealItemExtractionSchema>;
export type MealExtraction = z.infer<typeof MealExtractionSchema>;

/* ─── Onboarding payload (FEATURES §4.1) ─────────────────────────────────── */

export const OnboardingPayloadSchema = z.object({
  full_name: z.string().min(1),
  phone_e164: z.string().regex(/^\+\d{10,15}$/, "Phone must be E.164"),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex: SexSchema,
  weight_kg: z.number().positive().max(500),
  height_cm: z.number().positive().max(300),
  activity_level: ActivityLevelSchema,
  goal: GoalSchema,
  timezone: z.string().min(1),
  day_start_hour: z.number().int().min(0).max(23),
  locale: z.string().default("pt-BR"),
  consents: z.object({
    terms: z.literal(true),
    privacy: z.literal(true),
    ai_processing: z.literal(true),
    policy_version: z.string().default("v1.0"),
  }),
});

export type OnboardingPayload = z.infer<typeof OnboardingPayloadSchema>;
