-- M1 §database. All Postgres enums used across the schema (FEATURES §3.3).
-- Defining them up front keeps later migrations short and references stable.

-- Profile + anthropometrics
CREATE TYPE sex AS ENUM ('male', 'female', 'other');
CREATE TYPE activity_level AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');
CREATE TYPE goal AS ENUM ('lose', 'maintain', 'gain', 'recomp');

-- Foods + meals (M2)
CREATE TYPE food_source AS ENUM ('taco', 'usda', 'openfoodfacts', 'ai', 'user');
CREATE TYPE meal_source AS ENUM ('app_text', 'app_audio', 'wa_text', 'wa_audio', 'manual');
CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'snack', 'dinner', 'other');
CREATE TYPE unit AS ENUM ('g', 'ml', 'unit', 'slice', 'cup', 'tbsp', 'tsp');

-- Social (M5)
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');

-- WhatsApp (M4)
CREATE TYPE wa_direction AS ENUM ('in', 'out');
CREATE TYPE wa_kind AS ENUM ('text', 'audio', 'image', 'status');

-- Push (M5)
CREATE TYPE device_platform AS ENUM ('ios', 'android');
CREATE TYPE notification_channel AS ENUM ('push', 'wa');
CREATE TYPE notification_kind AS ENUM (
  'streak_alert',
  'goal_reminder',
  'friend_activity',
  'meal_confirmation',
  'achievement'
);

-- LGPD + billing
CREATE TYPE consent_scope AS ENUM ('terms', 'privacy', 'marketing', 'ai_processing', 'data_export');
CREATE TYPE subscription_plan AS ENUM ('free', 'pro');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');
