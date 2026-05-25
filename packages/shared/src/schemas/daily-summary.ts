import { z } from "zod";

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
