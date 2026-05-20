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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_onboarding: { Args: { payload: Json }; Returns: Json };
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
