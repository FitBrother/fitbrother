/**
 * Helpers de manipulação de datas em formato YYYY-MM-DD (pure, sem TZ
 * dependency). Para conversão de nutritional-day veja
 * lib/time/nutritional-day.ts.
 */

export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`addDaysIso: invalid input "${iso}"`);
  }
  const ts = Date.UTC(y, m - 1, d);
  const next = new Date(ts + n * 86_400_000);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Retorna um ISO timestamp UTC para o meio-dia (12:00) local do `day`
 * no fuso do profile. Usado como default em backfill: o usuário pode
 * ajustar via TimePicker depois.
 */
export function defaultConsumedAtForDay(day: string, profile: { timezone: string }): string {
  return setTimeOfDayForDay(day, profile, 12, 0);
}

function setTimeOfDayForDay(
  day: string,
  profile: { timezone: string },
  hour: number,
  minute: number,
): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`setTimeOfDayForDay: invalid day "${day}"`);
  }
  // UTC anchor pro dia/hora desejados; ajustamos pelo offset do fuso.
  const utcCandidate = Date.UTC(y, m - 1, d, hour, minute, 0);
  const localStr = new Date(utcCandidate).toLocaleString("sv-SE", {
    timeZone: profile.timezone,
  });
  // sv-SE: "YYYY-MM-DD HH:mm:ss"
  const localHour = parseInt(localStr.slice(11, 13), 10);
  const localMinute = parseInt(localStr.slice(14, 16), 10);
  const offsetMinutes = (hour - localHour) * 60 + (minute - localMinute);
  return new Date(utcCandidate + offsetMinutes * 60_000).toISOString();
}

/**
 * Aplica time-of-day (hour, minute) sobre um ISO existente preservando
 * o dia civil no fuso do profile.
 */
export function setTimeOfDayIso(
  iso: string,
  profile: { timezone: string },
  hour: number,
  minute: number,
): string {
  const localStr = new Date(iso).toLocaleString("sv-SE", {
    timeZone: profile.timezone,
  });
  const day = localStr.slice(0, 10);
  return setTimeOfDayForDay(day, profile, hour, minute);
}

/**
 * Extrai hour e minute do ISO no fuso do profile. Usado pelo TimePicker
 * pra pré-popular os wheels.
 */
export function getTimeOfDayIso(
  iso: string,
  profile: { timezone: string },
): { hour: number; minute: number } {
  const localStr = new Date(iso).toLocaleString("sv-SE", {
    timeZone: profile.timezone,
  });
  return {
    hour: parseInt(localStr.slice(11, 13), 10),
    minute: parseInt(localStr.slice(14, 16), 10),
  };
}
