// Progressive DD/MM/AAAA mask. Strips non-digits, caps at 8 digits, inserts
// slashes as the user types so they never need to type a separator.
export function maskDate(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// `DD/MM/AAAA` → `AAAA-MM-DD` (ISO 8601). Returns null when the input
// isn't a complete BR date or the month/day are out of range.
export function brDateToIso(input: string): string | null {
  const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;
  return `${yyyy}-${mm}-${dd}`;
}

// E.164 with a Brazil-friendly default. If the user types digits without a
// leading "+", we assume +55 (Brazil) — covers the 95% case while still
// letting somebody paste an explicit "+44…" for other countries.
//
// The `+` is sticky: once the input has it, we keep whatever the user typed
// after it (digits only). When the field becomes empty (e.g. user holds
// backspace) we return "" so the placeholder reappears.
export function maskPhoneE164(input: string): string {
  if (!input) return "";
  if (input.startsWith("+")) {
    const digits = input.slice(1).replace(/\D/g, "").slice(0, 15);
    return digits ? `+${digits}` : "";
  }
  const digits = input.replace(/\D/g, "").slice(0, 13);
  if (!digits) return "";
  // Avoid "+5555…" when the user already typed the 55 country code.
  const normalized = digits.startsWith("55") ? digits : `55${digits}`.slice(0, 15);
  return `+${normalized}`;
}

// 0-23 inclusive, no leading zeros padded.
export function clampHour(input: string): number {
  const n = parseInt(input.replace(/\D/g, ""), 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(23, n));
}
