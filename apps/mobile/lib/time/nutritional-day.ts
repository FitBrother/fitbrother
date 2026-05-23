/**
 * Returns the user's "nutritional today" as YYYY-MM-DD, mirroring the
 * Postgres boundary used in fitbrother_nutritional_day:
 *   ((consumed_at AT TIME ZONE p.timezone) - (p.day_start_hour || ' hours')::interval)::date
 *
 * Server stays the source of truth — this is only used to pick the React
 * Query cache key and the `day` parameter for GET /meals?day=.
 *
 * @param ts - any UTC timestamp.
 * @param profile.timezone - IANA timezone (e.g. "America/Sao_Paulo").
 * @param profile.day_start_hour - integer 0-23. Fractional values are not supported (mirrors Postgres INTERVAL 'N hours').
 */
export function nutritionalDay(
  ts: Date,
  profile: { timezone: string; day_start_hour: number },
): string {
  // Convert the timestamp into the profile's local wall-clock. The
  // toLocaleString hack is the standard way to do this without pulling in
  // a date library on RN. sv-SE locale produces "YYYY-MM-DD HH:mm:ss".
  const localStr = ts.toLocaleString("sv-SE", { timeZone: profile.timezone });

  // Parse parts directly — avoid passing the string back into `new Date()`
  // because a bare "YYYY-MM-DDTHH:mm:ss" (no Z) is re-interpreted through
  // the JS engine's own system TZ, which would corrupt the result on devices
  // whose TZ differs from the profile's TZ.
  // sv-SE format is guaranteed: "YYYY-MM-DD HH:mm:ss"
  const spaceIdx = localStr.indexOf(" ");
  if (spaceIdx === -1) {
    throw new Error(`nutritional-day: unexpected toLocaleString format: ${localStr}`);
  }
  const datePart = localStr.slice(0, spaceIdx);
  const timePart = localStr.slice(spaceIdx + 1);

  const year = parseInt(datePart.slice(0, 4), 10);
  const month = parseInt(datePart.slice(5, 7), 10);
  const day = parseInt(datePart.slice(8, 10), 10);
  const hour = parseInt(timePart.slice(0, 2), 10);

  // Subtract the nutritional-day offset from the local hour.
  if (hour - profile.day_start_hour >= 0) {
    // Still within the same calendar date.
    return datePart;
  }

  // The adjusted time rolled back past midnight — the nutritional day belongs
  // to the previous calendar date. Use Date.UTC to avoid any local-TZ shift.
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

export function nutritionalToday(profile: { timezone: string; day_start_hour: number }): string {
  return nutritionalDay(new Date(), profile);
}
