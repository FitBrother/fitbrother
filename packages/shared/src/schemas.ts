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

/* ─── Meal API requests + responses (M2) ─────────────────────────────────── */

const UuidSchema = z.string().uuid();

export const CreateMealTextRequestSchema = z.object({
  // Client-generated UUID. Used as meals.id for optimistic UI + idempotent
  // retries (server INSERTs with ON CONFLICT DO NOTHING).
  client_meal_id: UuidSchema,
  text: z.string().min(1).max(2000),
  consumed_at: z.string().datetime().optional(),
  locale: z.string().default("pt-BR"),
});
export type CreateMealTextRequest = z.infer<typeof CreateMealTextRequestSchema>;

export const CreateMealAudioRequestSchema = z.object({
  // Client-generated UUID; matches the meal id and the storage filename base.
  client_meal_id: UuidSchema,
  // Storage path returned by uploadMealAudio. Server verifies prefix matches
  // auth.uid() before downloading. Format: "{user_id}/{client_meal_id}.{ext}".
  audio_path: z.string().min(1),
  // Recorded length in seconds. Used for ai_usage accounting BEFORE Whisper
  // (cap is enforced in audio-seconds, not bytes). Cap at 600s = 10min hard
  // limit also enforced client-side.
  duration_s: z.number().positive().max(600),
  consumed_at: z.string().datetime().optional(),
  locale: z.string().default("pt-BR"),
});
export type CreateMealAudioRequest = z.infer<typeof CreateMealAudioRequestSchema>;

export const MealItemResponseSchema = z.object({
  id: UuidSchema,
  food_id: UuidSchema.nullable(),
  description: z.string(),
  quantity: z.number(),
  unit: UnitSchema,
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  density_assumed: z.boolean(),
});

export const MealResponseSchema = z.object({
  id: UuidSchema,
  source: z.enum(["app_text", "app_audio", "wa_text", "wa_audio", "manual"]),
  raw_input: z.string().nullable(),
  audio_path: z.string().nullable(),
  meal_type: MealTypeSchema,
  consumed_at: z.string(),
  total_kcal: z.number(),
  total_protein_g: z.number(),
  total_carbs_g: z.number(),
  total_fat_g: z.number(),
  confidence: z.number().nullable(),
  review_required: z.boolean(),
  created_at: z.string(),
  deleted_at: z.string().nullable(),
  items: z.array(MealItemResponseSchema),
});
export type MealResponse = z.infer<typeof MealResponseSchema>;

export const DailySummarySchema = z.object({
  user_id: z.string().uuid(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  goal_kcal: z.number().nullable(),
  goal_protein_g: z.number().nullable(),
  goal_carbs_g: z.number().nullable(),
  goal_fat_g: z.number().nullable(),
  goal_hit: z.boolean(),
  meals_count: z.number().int(),
  updated_at: z.string(),
});
export type DailySummary = z.infer<typeof DailySummarySchema>;

export const DailySummaryResponseSchema = z.object({
  summary: DailySummarySchema,
});
export type DailySummaryResponse = z.infer<typeof DailySummaryResponseSchema>;

export const DailySummariesResponseSchema = z.object({
  summaries: z.array(DailySummarySchema),
});
export type DailySummariesResponse = z.infer<typeof DailySummariesResponseSchema>;

/* ─── Streak (M5.1) ──────────────────────────────────────────────────────── */

export const StreakSchema = z.object({
  user_id: z.string().uuid(),
  current_streak: z.number().int(),
  longest_streak: z.number().int(),
  last_hit_day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  freezes_available: z.number().int(),
  updated_at: z.string(),
});
export type Streak = z.infer<typeof StreakSchema>;

export const StreakResponseSchema = z.object({
  streak: StreakSchema,
});
export type StreakResponse = z.infer<typeof StreakResponseSchema>;

export const PatchMealItemSchema = z.object({
  // Pass id to update existing; omit to insert new. Server enforces ownership.
  id: UuidSchema.optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: UnitSchema,
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
});

export const PatchMealRequestSchema = z.object({
  // Optional fields — only present ones get updated.
  meal_type: MealTypeSchema.optional(),
  consumed_at: z.string().datetime().optional(),
  // If provided, server replaces all items with this list (full PUT semantics
  // for items). Easier client logic than mixing patch + delete + add.
  items: z.array(PatchMealItemSchema).min(1).optional(),
});
export type PatchMealRequest = z.infer<typeof PatchMealRequestSchema>;

/* ─── Onboarding payload (FEATURES §4.1) ─────────────────────────────────── */

export const OnboardingPayloadSchema = z.object({
  full_name: z.string().min(1),
  // Phone is captured in step 7 but only verified later via WhatsApp handshake (§4.5).
  phone_e164: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, "Phone must be E.164")
    .optional(),
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
