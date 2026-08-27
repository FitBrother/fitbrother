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
export const GoalSchema = z.enum(["lose", "maintain", "gain"]);
export const ConsentScopeSchema = z.enum([
  "terms",
  "privacy",
  "marketing",
  "ai_processing",
  "data_export",
]);
export type ConsentScope = z.infer<typeof ConsentScopeSchema>;

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
  feedback: z.string().max(200).default(""),
});

export type MealItemExtraction = z.infer<typeof MealItemExtractionSchema>;
export type MealExtraction = z.infer<typeof MealExtractionSchema>;

/* ─── Meal API requests + responses (M2) ─────────────────────────────────── */

const UuidSchema = z.string().uuid();

export const UsernameSchema = z
  .string()
  .regex(/^[a-z0-9_.]{3,20}$/, "username: 3-20 chars, a-z 0-9 _ .");
export type Username = z.infer<typeof UsernameSchema>;

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

export const CreateMealPhotoRequestSchema = z.object({
  client_meal_id: UuidSchema,
  image_path: z.string().min(1),
  consumed_at: z.string().datetime().optional(),
  locale: z.string().default("pt-BR"),
});
export type CreateMealPhotoRequest = z.infer<typeof CreateMealPhotoRequestSchema>;

export const CreateMealBarcodeRequestSchema = z.object({
  client_meal_id: UuidSchema,
  barcode: z.string().min(1),
  quantity: z.number().positive(),
  unit: UnitSchema,
  meal_type: MealTypeSchema.optional(),
  consumed_at: z.string().datetime().optional(),
});
export type CreateMealBarcodeRequest = z.infer<typeof CreateMealBarcodeRequestSchema>;

export const BarcodeProductSchema = z.object({
  name: z.string(),
  brand: z.string().nullable(),
  image_url: z.string().nullable(),
  barcode: z.string(),
  kcal_per_100g: z.number().nullable(),
  protein_per_100g: z.number().nullable(),
  carbs_per_100g: z.number().nullable(),
  fat_per_100g: z.number().nullable(),
  serving_g: z.number().nullable(),
  macros_complete: z.boolean(),
});
export type BarcodeProduct = z.infer<typeof BarcodeProductSchema>;

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
  source: z.enum([
    "app_text",
    "app_audio",
    "app_photo",
    "app_barcode",
    "wa_text",
    "wa_audio",
    "manual",
  ]),
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
  ai_feedback: z.string().nullable(),
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
  at_risk: z.boolean(),
});
export type StreakResponse = z.infer<typeof StreakResponseSchema>;

/* ─── Achievements (M5.2) ────────────────────────────────────────────────── */

export const AchievementCriteriaSchema = z.object({
  type: z.enum([
    "streak",
    "meals_total",
    "wa_meals_total",
    "weekly_hits",
    "days_active",
    "friends_total",
  ]),
  value: z.number().int(),
});

export const AchievementSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  criteria_json: AchievementCriteriaSchema,
  sort_order: z.number().int(),
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const AchievementsResponseSchema = z.object({
  achievements: z.array(AchievementSchema),
});
export type AchievementsResponse = z.infer<typeof AchievementsResponseSchema>;

export const UserAchievementSchema = z.object({
  achievement_id: z.string().uuid(),
  unlocked_at: z.string(),
});
export type UserAchievement = z.infer<typeof UserAchievementSchema>;

export const UserAchievementsResponseSchema = z.object({
  achievements: z.array(UserAchievementSchema),
});
export type UserAchievementsResponse = z.infer<typeof UserAchievementsResponseSchema>;

/* ─── Push tokens (M5.2) ─────────────────────────────────────────────────── */

export const DevicePlatformSchema = z.enum(["ios", "android"]);
export type DevicePlatform = z.infer<typeof DevicePlatformSchema>;

export const RegisterPushTokenRequestSchema = z.object({
  token: z.string().min(1),
  platform: DevicePlatformSchema,
});
export type RegisterPushTokenRequest = z.infer<typeof RegisterPushTokenRequestSchema>;

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
  username: UsernameSchema.optional(),
  avatar_url: z.string().optional(),
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
  target_weight_kg: z.number().positive().max(500).optional(),
  rate_kg_per_week: z.number().positive().max(2).optional(),
  body_fat_pct: z.number().min(3).max(60),
  protein_g_override: z.number().positive().optional(),
  strength_training: z.boolean().optional(),
  training_days_per_week: z.number().int().min(0).max(7).optional(),
  is_pregnant_or_lactating: z.boolean().optional(),
  has_kidney_disease: z.boolean().optional(),
  has_type1_diabetes: z.boolean().optional(),
  uses_glp1: z.boolean().optional(),
  onboarding_context: z.record(z.string(), z.unknown()).default({}),
});

export type OnboardingPayload = z.infer<typeof OnboardingPayloadSchema>;

// ── M6 account/LGPD contracts ─────────────────────────────────────────────
export const AccountConsentStateSchema = z.object({
  scope: ConsentScopeSchema,
  granted: z.boolean(),
  granted_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  policy_version: z.string().nullable(),
});
export type AccountConsentState = z.infer<typeof AccountConsentStateSchema>;

export const AccountProfileResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email().nullable(),
  }),
  profile: z.object({
    full_name: z.string().nullable(),
    username: z.string().nullable(),
    avatar_url: z.string().nullable(),
    timezone: z.string(),
    day_start_hour: z.number().int().min(0).max(23),
    locale: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  private: z.object({
    phone_verified_at: z.string().nullable(),
  }),
  consents: z.record(ConsentScopeSchema, AccountConsentStateSchema),
  account: z.object({
    delete_requested_at: z.string().nullable(),
    scheduled_purge_at: z.string().nullable(),
  }),
});
export type AccountProfileResponse = z.infer<typeof AccountProfileResponseSchema>;

export const PatchAccountSettingsRequestSchema = z.object({
  timezone: z.string().min(1).optional(),
  day_start_hour: z.number().int().min(0).max(23).optional(),
});
export type PatchAccountSettingsRequest = z.infer<typeof PatchAccountSettingsRequestSchema>;

export const PatchAccountProfileRequestSchema = z.object({
  avatar_url: z.string().min(1).max(500).nullable(),
});
export type PatchAccountProfileRequest = z.infer<typeof PatchAccountProfileRequestSchema>;

export const AccountSettingsResponseSchema = z.object({
  settings: z.object({
    timezone: z.string(),
    day_start_hour: z.number().int().min(0).max(23),
    updated_at: z.string(),
  }),
});
export type AccountSettingsResponse = z.infer<typeof AccountSettingsResponseSchema>;

export const PostAccountConsentRequestSchema = z.object({
  scope: ConsentScopeSchema,
  granted: z.boolean(),
  policy_version: z.string().default("v1.0"),
});
export type PostAccountConsentRequest = z.infer<typeof PostAccountConsentRequestSchema>;

export const AccountConsentResponseSchema = z.object({
  consent: AccountConsentStateSchema,
});
export type AccountConsentResponse = z.infer<typeof AccountConsentResponseSchema>;

export const DeleteAccountRequestSchema = z.object({
  confirm: z.literal(true),
  authorization_token: z.string().min(32),
  reason: z.string().trim().max(500).optional(),
});
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;

export const DeleteAccountResponseSchema = z.object({
  deleted: z.literal(true),
  requested_at: z.string(),
  scheduled_purge_at: z.string(),
});
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>;

export const AccountDeletionStateResponseSchema = z.object({
  pending: z.boolean(),
  requested_at: z.string().nullable(),
  scheduled_purge_at: z.string().nullable(),
  can_reactivate: z.boolean(),
});
export type AccountDeletionStateResponse = z.infer<typeof AccountDeletionStateResponseSchema>;

export const ReactivateAccountResponseSchema = z.object({
  reactivated: z.boolean(),
  cancelled_at: z.string().nullable(),
});
export type ReactivateAccountResponse = z.infer<typeof ReactivateAccountResponseSchema>;

export const AuthorizeAccountDeletionPasswordRequestSchema = z.object({
  password: z.string().min(1).max(1024),
});

export const StartAccountDeletionOAuthRequestSchema = z.object({
  provider: z.enum(["google", "apple"]),
});

export const CompleteAccountDeletionOAuthRequestSchema = z.object({
  provider: z.enum(["google", "apple"]),
  challenge_token: z.string().min(32),
});

// ── M5.3 social ────────────────────────────────────────────────────────────
export const ContactsSyncRequestSchema = z.object({
  // hashes SHA-256 hex (lowercase) de números E.164, gerados no device.
  hashes: z.array(z.string().regex(/^[0-9a-f]{64}$/)).max(5000),
});
export type ContactsSyncRequest = z.infer<typeof ContactsSyncRequestSchema>;

export const FollowedProfileSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().nullable(),
});
export type FollowedProfile = z.infer<typeof FollowedProfileSchema>;

export const ContactsSyncResponseSchema = z.object({
  followed: z.array(FollowedProfileSchema),
});
export type ContactsSyncResponse = z.infer<typeof ContactsSyncResponseSchema>;

export const FollowingResponseSchema = z.object({
  following: z.array(FollowedProfileSchema),
});
export type FollowingResponse = z.infer<typeof FollowingResponseSchema>;

export const LeaderboardRowSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().nullable(),
  weekly_hits: z.number().int(),
  window_streak: z.number().int(),
  is_me: z.boolean(),
});
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;

export const LeaderboardResponseSchema = z.object({
  rows: z.array(LeaderboardRowSchema),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

// ── M7.1 identity & discovery ─────────────────────────────────────────────
export const PublicProfileSchema = z.object({
  user_id: z.string().uuid(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

export const UserSearchResponseSchema = z.object({
  users: z.array(PublicProfileSchema),
});
export type UserSearchResponse = z.infer<typeof UserSearchResponseSchema>;

export const UsernameAvailableResponseSchema = z.object({
  available: z.boolean(),
});
export type UsernameAvailableResponse = z.infer<typeof UsernameAvailableResponseSchema>;

export const FollowRequestSchema = z.object({
  followee_id: z.string().uuid(),
});
export type FollowRequest = z.infer<typeof FollowRequestSchema>;

// ── M7.2 feed core ────────────────────────────────────────────────────────
export const CreatePostRequestSchema = z.object({
  id: z.string().uuid(),
  meal_id: z.string().uuid(),
  caption: z.string().trim().max(280).optional(),
  image_path: z.string().trim().min(1).optional(),
});
export type CreatePostRequest = z.infer<typeof CreatePostRequestSchema>;

export const CreateAchievementPostRequestSchema = z.object({
  id: z.string().uuid(),
  achievement_id: z.string().uuid(),
  caption: z.string().trim().max(280).optional(),
});
export type CreateAchievementPostRequest = z.infer<typeof CreateAchievementPostRequestSchema>;

export const PostSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  post_type: z.enum(["meal", "achievement"]),
  meal_id: z.string().uuid().nullable(),
  achievement_id: z.string().uuid().nullable(),
  caption: z.string().nullable(),
  image_path: z.string().nullable(),
  total_kcal: z.number(),
  total_protein_g: z.number(),
  total_carbs_g: z.number(),
  total_fat_g: z.number(),
  like_count: z.number().int(),
  comment_count: z.number().int(),
  created_at: z.string(),
  deleted_at: z.string().nullable(),
  author: PublicProfileSchema,
  achievement: AchievementSchema.nullable(),
  liked_by_me: z.boolean().default(false),
});
export type Post = z.infer<typeof PostSchema>;

export const FeedResponseSchema = z.object({
  posts: z.array(PostSchema),
});
export type FeedResponse = z.infer<typeof FeedResponseSchema>;

export const PostResponseSchema = z.object({
  post: PostSchema,
});
export type PostResponse = z.infer<typeof PostResponseSchema>;

// ── M7.3 engajamento (likes + comentários) ─────────────────────────────────
export const LikeResponseSchema = z.object({
  liked: z.boolean(),
  like_count: z.number().int(),
});
export type LikeResponse = z.infer<typeof LikeResponseSchema>;

export const CommentSchema = z.object({
  id: z.string().uuid(),
  post_id: z.string().uuid(),
  user_id: z.string().uuid(),
  body: z.string(),
  created_at: z.string(),
  author: PublicProfileSchema,
});
export type Comment = z.infer<typeof CommentSchema>;

export const CreateCommentRequestSchema = z.object({
  id: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
});
export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;

export const CommentsResponseSchema = z.object({
  comments: z.array(CommentSchema),
});
export type CommentsResponse = z.infer<typeof CommentsResponseSchema>;

// ── M8.2 insights ───────────────────────────────────────────────────────────
export const InsightContentSchema = z.object({
  title: z.string().max(80),
  headline: z.string().max(160),
  bullets: z.array(z.string().max(200)).min(1).max(5),
  score: z.number().int().min(0).max(100).nullable().default(null),
  tone: z.enum(["celebrate", "encourage", "nudge"]),
});
export type InsightContent = z.infer<typeof InsightContentSchema>;

export const InsightSchema = z.object({
  id: z.string().uuid(),
  period_type: z.enum(["day", "week", "month"]),
  period_start: z.string(),
  payload: InsightContentSchema,
  created_at: z.string(),
});
export type Insight = z.infer<typeof InsightSchema>;

export const InsightsResponseSchema = z.object({ insights: z.array(InsightSchema) });
export type InsightsResponse = z.infer<typeof InsightsResponseSchema>;
