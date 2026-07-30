/** Data projetada pra atingir o peso-alvo no ritmo escolhido. `null` se o
 * ritmo for zero ou a diferença de peso for zero (nada a projetar). */
export function projectGoalDate(
  currentWeightKg: number,
  targetWeightKg: number,
  rateKgPerWeek: number,
  from: Date,
): Date | null {
  const diffKg = Math.abs(currentWeightKg - targetWeightKg);
  if (diffKg === 0 || rateKgPerWeek <= 0) return null;
  const weeks = diffKg / rateKgPerWeek;
  const result = new Date(from);
  result.setDate(result.getDate() + Math.round(weeks * 7));
  return result;
}
