/**
 * Adiciona N dias a uma data ISO YYYY-MM-DD. Função pura — opera só na
 * string, sem dependência de timezone. Espelho do helper que existe no
 * mobile em `apps/mobile/lib/dateMath.ts`.
 */
export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`addDaysIso: invalid input "${iso}"`);
  }
  // Date.UTC interpreta como UTC, então não há drift por TZ local.
  const ts = Date.UTC(y, m - 1, d);
  const next = new Date(ts + n * 86_400_000);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
