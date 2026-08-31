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
  [k: string]: unknown;
};
