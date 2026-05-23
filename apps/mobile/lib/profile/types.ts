export type Profile = {
  id: string;
  full_name: string;
  timezone: string;
  day_start_hour: number;
  locale: string;
  [k: string]: unknown;
};
