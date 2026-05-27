export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_extraction_hits: {
        Row: {
          id: string;
          input_hash: string;
          occurred_at: string;
          user_id: string;
          was_cache_hit: boolean;
        };
        Insert: {
          id?: string;
          input_hash: string;
          occurred_at?: string;
          user_id: string;
          was_cache_hit: boolean;
        };
        Update: {
          id?: string;
          input_hash?: string;
          occurred_at?: string;
          user_id?: string;
          was_cache_hit?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "ai_extraction_hits_input_hash_fkey";
            columns: ["input_hash"];
            isOneToOne: false;
            referencedRelation: "ai_extractions";
            referencedColumns: ["input_hash"];
          },
        ];
      };
      ai_extractions: {
        Row: {
          confidence: number | null;
          cost_cents: number;
          created_at: string;
          input_hash: string;
          model: string;
          prompt_version: string;
          result_json: Json;
          tokens_input: number;
          tokens_output: number;
        };
        Insert: {
          confidence?: number | null;
          cost_cents?: number;
          created_at?: string;
          input_hash: string;
          model: string;
          prompt_version: string;
          result_json: Json;
          tokens_input?: number;
          tokens_output?: number;
        };
        Update: {
          confidence?: number | null;
          cost_cents?: number;
          created_at?: string;
          input_hash?: string;
          model?: string;
          prompt_version?: string;
          result_json?: Json;
          tokens_input?: number;
          tokens_output?: number;
        };
        Relationships: [];
      };
      ai_usage: {
        Row: {
          day: string;
          llm_cost_cents: number;
          llm_input_tokens: number;
          llm_output_tokens: number;
          transcription_cost_cents: number;
          transcription_seconds: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          day: string;
          llm_cost_cents?: number;
          llm_input_tokens?: number;
          llm_output_tokens?: number;
          transcription_cost_cents?: number;
          transcription_seconds?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          day?: string;
          llm_cost_cents?: number;
          llm_input_tokens?: number;
          llm_output_tokens?: number;
          transcription_cost_cents?: number;
          transcription_seconds?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      anthropometrics: {
        Row: {
          bmr_kcal: number | null;
          height_cm: number;
          id: string;
          measured_at: string;
          tdee_kcal: number | null;
          user_id: string;
          weight_kg: number;
        };
        Insert: {
          bmr_kcal?: number | null;
          height_cm: number;
          id?: string;
          measured_at?: string;
          tdee_kcal?: number | null;
          user_id: string;
          weight_kg: number;
        };
        Update: {
          bmr_kcal?: number | null;
          height_cm?: number;
          id?: string;
          measured_at?: string;
          tdee_kcal?: number | null;
          user_id?: string;
          weight_kg?: number;
        };
        Relationships: [];
      };
      consent_log: {
        Row: {
          granted_at: string;
          id: string;
          policy_version: string;
          revoked_at: string | null;
          scope: Database["public"]["Enums"]["consent_scope"];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          id?: string;
          policy_version: string;
          revoked_at?: string | null;
          scope: Database["public"]["Enums"]["consent_scope"];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          id?: string;
          policy_version?: string;
          revoked_at?: string | null;
          scope?: Database["public"]["Enums"]["consent_scope"];
          user_id?: string;
        };
        Relationships: [];
      };
      daily_summaries: {
        Row: {
          carbs_g: number;
          day: string;
          fat_g: number;
          goal_carbs_g: number | null;
          goal_fat_g: number | null;
          goal_hit: boolean;
          goal_kcal: number | null;
          goal_protein_g: number | null;
          kcal: number;
          meals_count: number;
          protein_g: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          carbs_g?: number;
          day: string;
          fat_g?: number;
          goal_carbs_g?: number | null;
          goal_fat_g?: number | null;
          goal_hit?: boolean;
          goal_kcal?: number | null;
          goal_protein_g?: number | null;
          kcal?: number;
          meals_count?: number;
          protein_g?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          carbs_g?: number;
          day?: string;
          fat_g?: number;
          goal_carbs_g?: number | null;
          goal_fat_g?: number | null;
          goal_hit?: boolean;
          goal_kcal?: number | null;
          goal_protein_g?: number | null;
          kcal?: number;
          meals_count?: number;
          protein_g?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      foods: {
        Row: {
          carbs_per_100g: number;
          created_at: string;
          fat_per_100g: number;
          id: string;
          kcal_per_100g: number;
          name: string;
          name_normalized: string;
          protein_per_100g: number;
          serving_grams: number | null;
          serving_label: string | null;
          source: Database["public"]["Enums"]["food_source"];
          updated_at: string;
          verified: boolean;
        };
        Insert: {
          carbs_per_100g: number;
          created_at?: string;
          fat_per_100g: number;
          id?: string;
          kcal_per_100g: number;
          name: string;
          name_normalized: string;
          protein_per_100g: number;
          serving_grams?: number | null;
          serving_label?: string | null;
          source: Database["public"]["Enums"]["food_source"];
          updated_at?: string;
          verified?: boolean;
        };
        Update: {
          carbs_per_100g?: number;
          created_at?: string;
          fat_per_100g?: number;
          id?: string;
          kcal_per_100g?: number;
          name?: string;
          name_normalized?: string;
          protein_per_100g?: number;
          serving_grams?: number | null;
          serving_label?: string | null;
          source?: Database["public"]["Enums"]["food_source"];
          updated_at?: string;
          verified?: boolean;
        };
        Relationships: [];
      };
      meal_items: {
        Row: {
          carbs_g: number;
          created_at: string;
          deleted_at: string | null;
          density_assumed: boolean;
          description: string;
          fat_g: number;
          food_id: string | null;
          id: string;
          kcal: number;
          meal_id: string;
          protein_g: number;
          quantity: number;
          unit: Database["public"]["Enums"]["unit"];
        };
        Insert: {
          carbs_g: number;
          created_at?: string;
          deleted_at?: string | null;
          density_assumed?: boolean;
          description: string;
          fat_g: number;
          food_id?: string | null;
          id?: string;
          kcal: number;
          meal_id: string;
          protein_g: number;
          quantity: number;
          unit: Database["public"]["Enums"]["unit"];
        };
        Update: {
          carbs_g?: number;
          created_at?: string;
          deleted_at?: string | null;
          density_assumed?: boolean;
          description?: string;
          fat_g?: number;
          food_id?: string | null;
          id?: string;
          kcal?: number;
          meal_id?: string;
          protein_g?: number;
          quantity?: number;
          unit?: Database["public"]["Enums"]["unit"];
        };
        Relationships: [
          {
            foreignKeyName: "meal_items_food_id_fkey";
            columns: ["food_id"];
            isOneToOne: false;
            referencedRelation: "foods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_items_meal_id_fkey";
            columns: ["meal_id"];
            isOneToOne: false;
            referencedRelation: "meals";
            referencedColumns: ["id"];
          },
        ];
      };
      meals: {
        Row: {
          audio_path: string | null;
          confidence: number | null;
          consumed_at: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          meal_type: Database["public"]["Enums"]["meal_type"];
          raw_input: string | null;
          review_required: boolean;
          source: Database["public"]["Enums"]["meal_source"];
          total_carbs_g: number;
          total_fat_g: number;
          total_kcal: number;
          total_protein_g: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          audio_path?: string | null;
          confidence?: number | null;
          consumed_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          meal_type: Database["public"]["Enums"]["meal_type"];
          raw_input?: string | null;
          review_required?: boolean;
          source: Database["public"]["Enums"]["meal_source"];
          total_carbs_g?: number;
          total_fat_g?: number;
          total_kcal?: number;
          total_protein_g?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          audio_path?: string | null;
          confidence?: number | null;
          consumed_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          meal_type?: Database["public"]["Enums"]["meal_type"];
          raw_input?: string | null;
          review_required?: boolean;
          source?: Database["public"]["Enums"]["meal_source"];
          total_carbs_g?: number;
          total_fat_g?: number;
          total_kcal?: number;
          total_protein_g?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      nutrition_goals: {
        Row: {
          carbs_g: number;
          created_at: string;
          effective_from: string;
          effective_to: string | null;
          fat_g: number;
          id: string;
          kcal: number;
          protein_g: number;
          user_id: string;
        };
        Insert: {
          carbs_g: number;
          created_at?: string;
          effective_from?: string;
          effective_to?: string | null;
          fat_g: number;
          id?: string;
          kcal: number;
          protein_g: number;
          user_id: string;
        };
        Update: {
          carbs_g?: number;
          created_at?: string;
          effective_from?: string;
          effective_to?: string | null;
          fat_g?: number;
          id?: string;
          kcal?: number;
          protein_g?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"] | null;
          birth_date: string | null;
          created_at: string;
          day_start_hour: number;
          full_name: string | null;
          goal: Database["public"]["Enums"]["goal"] | null;
          lgpd_consent_at: string | null;
          locale: string;
          phone_e164: string | null;
          phone_verified_at: string | null;
          sex: Database["public"]["Enums"]["sex"] | null;
          timezone: string;
          updated_at: string;
          user_id: string;
          wa_window_expires_at: string | null;
        };
        Insert: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null;
          birth_date?: string | null;
          created_at?: string;
          day_start_hour?: number;
          full_name?: string | null;
          goal?: Database["public"]["Enums"]["goal"] | null;
          lgpd_consent_at?: string | null;
          locale?: string;
          phone_e164?: string | null;
          phone_verified_at?: string | null;
          sex?: Database["public"]["Enums"]["sex"] | null;
          timezone: string;
          updated_at?: string;
          user_id: string;
          wa_window_expires_at?: string | null;
        };
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null;
          birth_date?: string | null;
          created_at?: string;
          day_start_hour?: number;
          full_name?: string | null;
          goal?: Database["public"]["Enums"]["goal"] | null;
          lgpd_consent_at?: string | null;
          locale?: string;
          phone_e164?: string | null;
          phone_verified_at?: string | null;
          sex?: Database["public"]["Enums"]["sex"] | null;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
          wa_window_expires_at?: string | null;
        };
        Relationships: [];
      };
      streaks: {
        Row: {
          current_streak: number;
          freezes_available: number;
          last_hit_day: string | null;
          longest_streak: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          current_streak?: number;
          freezes_available?: number;
          last_hit_day?: string | null;
          longest_streak?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          current_streak?: number;
          freezes_available?: number;
          last_hit_day?: string | null;
          longest_streak?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          plan: Database["public"]["Enums"]["subscription_plan"];
          provider: string | null;
          provider_subscription_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          plan?: Database["public"]["Enums"]["subscription_plan"];
          provider?: string | null;
          provider_subscription_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          plan?: Database["public"]["Enums"]["subscription_plan"];
          provider?: string | null;
          provider_subscription_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      transcriptions: {
        Row: {
          audio_hash: string;
          cost_cents: number;
          created_at: string;
          duration_s: number;
          language: string | null;
          model: string;
          text: string;
        };
        Insert: {
          audio_hash: string;
          cost_cents?: number;
          created_at?: string;
          duration_s: number;
          language?: string | null;
          model: string;
          text: string;
        };
        Update: {
          audio_hash?: string;
          cost_cents?: number;
          created_at?: string;
          duration_s?: number;
          language?: string | null;
          model?: string;
          text?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      vw_today_summary: {
        Row: {
          carbs_g: number | null;
          day: string | null;
          fat_g: number | null;
          goal_carbs_g: number | null;
          goal_fat_g: number | null;
          goal_hit: boolean | null;
          goal_kcal: number | null;
          goal_protein_g: number | null;
          kcal: number | null;
          meals_count: number | null;
          protein_g: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          carbs_g?: number | null;
          day?: string | null;
          fat_g?: number | null;
          goal_carbs_g?: number | null;
          goal_fat_g?: number | null;
          goal_hit?: boolean | null;
          goal_kcal?: number | null;
          goal_protein_g?: number | null;
          kcal?: number | null;
          meals_count?: number | null;
          protein_g?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          carbs_g?: number | null;
          day?: string | null;
          fat_g?: number | null;
          goal_carbs_g?: number | null;
          goal_fat_g?: number | null;
          goal_hit?: boolean | null;
          goal_kcal?: number | null;
          goal_protein_g?: number | null;
          kcal?: number | null;
          meals_count?: number | null;
          protein_g?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      complete_onboarding: { Args: { payload: Json }; Returns: Json };
      create_meal_with_items: { Args: { payload: Json }; Returns: Json };
      fitbrother_apply_streak: {
        Args: { p_day: string; p_user_id: string };
        Returns: undefined;
      };
      fitbrother_assert_ai_cap: {
        Args: { p_cap: number; p_kind: string; p_user_id: string };
        Returns: undefined;
      };
      fitbrother_foods_fuzzy_match: {
        Args: { p_needle: string; p_threshold?: number };
        Returns: {
          carbs_per_100g: number;
          fat_per_100g: number;
          id: string;
          kcal_per_100g: number;
          name: string;
          protein_per_100g: number;
          serving_grams: number;
          similarity: number;
        }[];
      };
      fitbrother_nutritional_day: {
        Args: { p_ts?: string; p_user_id: string };
        Returns: string;
      };
      fitbrother_recompute_daily_summary: {
        Args: { p_day: string; p_user_id: string };
        Returns: undefined;
      };
      fitbrother_recompute_meal_totals: {
        Args: { p_meal_id: string };
        Returns: undefined;
      };
      fitbrother_record_ai_usage: {
        Args: {
          p_llm_cost_cents?: number;
          p_llm_input_tokens?: number;
          p_llm_output_tokens?: number;
          p_transcription_cost_cents?: number;
          p_transcription_seconds?: number;
          p_user_id: string;
        };
        Returns: undefined;
      };
      fitbrother_streak_tick: { Args: never; Returns: number };
      fitbrother_today: { Args: { p_user_id: string }; Returns: string };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      unaccent: { Args: { "": string }; Returns: string };
    };
    Enums: {
      activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active";
      consent_scope: "terms" | "privacy" | "marketing" | "ai_processing" | "data_export";
      device_platform: "ios" | "android";
      food_source: "taco" | "usda" | "openfoodfacts" | "ai" | "user";
      friendship_status: "pending" | "accepted" | "blocked";
      goal: "lose" | "maintain" | "gain" | "recomp";
      meal_source: "app_text" | "app_audio" | "wa_text" | "wa_audio" | "manual";
      meal_type: "breakfast" | "lunch" | "snack" | "dinner" | "other";
      notification_channel: "push" | "wa";
      notification_kind:
        | "streak_alert"
        | "goal_reminder"
        | "friend_activity"
        | "meal_confirmation"
        | "achievement";
      sex: "male" | "female" | "other";
      subscription_plan: "free" | "pro";
      subscription_status: "active" | "past_due" | "canceled" | "trialing";
      unit: "g" | "ml" | "unit" | "slice" | "cup" | "tbsp" | "tsp";
      wa_direction: "in" | "out";
      wa_kind: "text" | "audio" | "image" | "status";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_level: ["sedentary", "light", "moderate", "active", "very_active"],
      consent_scope: ["terms", "privacy", "marketing", "ai_processing", "data_export"],
      device_platform: ["ios", "android"],
      food_source: ["taco", "usda", "openfoodfacts", "ai", "user"],
      friendship_status: ["pending", "accepted", "blocked"],
      goal: ["lose", "maintain", "gain", "recomp"],
      meal_source: ["app_text", "app_audio", "wa_text", "wa_audio", "manual"],
      meal_type: ["breakfast", "lunch", "snack", "dinner", "other"],
      notification_channel: ["push", "wa"],
      notification_kind: [
        "streak_alert",
        "goal_reminder",
        "friend_activity",
        "meal_confirmation",
        "achievement",
      ],
      sex: ["male", "female", "other"],
      subscription_plan: ["free", "pro"],
      subscription_status: ["active", "past_due", "canceled", "trialing"],
      unit: ["g", "ml", "unit", "slice", "cup", "tbsp", "tsp"],
      wa_direction: ["in", "out"],
      wa_kind: ["text", "audio", "image", "status"],
    },
  },
} as const;
