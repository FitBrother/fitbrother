export type Profile = {
  id: string;
  full_name: string;
  timezone: string;
  day_start_hour: number;
  locale: string;
  created_at: string;
  [k: string]: unknown;
};
