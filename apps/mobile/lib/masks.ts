// `DD/MM/AAAA` → `AAAA-MM-DD` (ISO 8601). Returns null when the input
// isn't a complete BR date or the month/day are out of range. Uses the JS
// Date constructor to reject impossible dates like 31/02 or 29/02 in
// non-leap years (the constructor silently rolls them forward — we detect
// that by re-checking the components match).
export function brDateToIso(input: string): string | null {
  const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** Validate a `DD/MM/AAAA` string as a birth date. Returns a user-facing
 *  error message in pt-BR, or `null` when the value is valid. Empty input
 *  returns `null` only if `required` is false — callers gating "Continue"
 *  should AND-check with their own required flag. */
export function validateBirthDate(
  input: string,
  options: { minAgeYears?: number; required?: boolean } = {},
): string | null {
  const { minAgeYears = 13, required = true } = options;
  if (!input) return required ? "Informe sua data de nascimento" : null;
  if (input.length < 10) return "Data incompleta";

  const iso = brDateToIso(input);
  if (!iso) return "Data inválida";

  const parts = iso.split("-").map(Number);
  const yyyy = parts[0]!;
  const mm = parts[1]!;
  const dd = parts[2]!;
  const today = new Date();
  let age = today.getFullYear() - yyyy;
  const monthDiff = today.getMonth() + 1 - mm;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dd)) age -= 1;

  if (age < minAgeYears) return `Idade mínima é ${minAgeYears} anos`;
  if (age > 120) return "Data inválida";
  return null;
}

// 0-23 inclusive, no leading zeros padded.
export function clampHour(input: string): number {
  const n = parseInt(input.replace(/\D/g, ""), 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(23, n));
}
