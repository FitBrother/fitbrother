export type Profile = {
  id: string;
  full_name: string;
  timezone: string;
  day_start_hour: number;
  locale: string;
  created_at: string;
  soft_mode: boolean;
  /** Caminho no Storage (`{user_id}/avatar.jpg`), não uma URL. */
  avatar_url?: string | null;
  /** `NULL` até o usuário terminar (ou pular) o tour guiado — ver lib/tour/. */
  tutorial_completed_at: string | null;
  [k: string]: unknown;
};
