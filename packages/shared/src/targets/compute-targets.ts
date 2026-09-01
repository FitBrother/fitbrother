import {
  calculateBmr,
  calculateTdee,
  deficitKcalPerDayToRateKgPerWeek,
  DEFICIT_CAP_PCT,
  fiberTargetG,
  percentOfWeightPerWeekToRateKgPerWeek,
  RATE_CAP_PCT,
  rateToDeficitKcalPerDay,
} from "./formulas.js";
import { evaluateSafetyGates } from "./gates.js";
import type { Goal, Sex, Targets, TargetsInput, Warning } from "./types.js";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const RATE_DEFAULT_PCT: Record<"lose" | "gain", number> = { lose: 0.625, gain: 0.375 };
const HARD_FLOOR_KCAL: Record<Sex, number> = { female: 1200, male: 1500, other: 1350 };

export function computeTargets(input: TargetsInput): Targets {
  const bmr = calculateBmr(input);
  const tdee = calculateTdee(bmr, input.activity_level);
  const gates = evaluateSafetyGates(input);
  const blockingGate = gates.find((g) => g.severity === "BLOCK");

  const warnings: Warning[] = [];
  let effectiveGoal: Goal;
  let kcal: number;

  if (blockingGate) {
    effectiveGoal = "maintain";
    kcal = tdee;
  } else {
    effectiveGoal = input.goal;
    if (effectiveGoal === "maintain") {
      kcal = tdee;
    } else {
      const direction = effectiveGoal; // "lose" | "gain"
      const capPct = RATE_CAP_PCT[direction];
      const defaultPct = RATE_DEFAULT_PCT[direction];
      const requestedRate =
        input.rate_kg_per_week ??
        percentOfWeightPerWeekToRateKgPerWeek(defaultPct, input.weight_kg);
      const capRate = percentOfWeightPerWeekToRateKgPerWeek(capPct, input.weight_kg);

      let rate = requestedRate;
      if (rate > capRate) {
        rate = capRate;
        warnings.push({
          code: "rate_clamped",
          message: `Ritmo pedido excede o teto de ${capPct}% do peso/semana — clampado.`,
        });
      }

      let deltaKcal = rateToDeficitKcalPerDay(rate);
      const deltaPct = (deltaKcal / tdee) * 100;
      const deficitCapPct = DEFICIT_CAP_PCT[direction];
      if (deltaPct > deficitCapPct) {
        deltaKcal = (deficitCapPct / 100) * tdee;
        warnings.push({
          code: direction === "lose" ? "deficit_clamped" : "surplus_clamped",
          message: `${direction === "lose" ? "Déficit" : "Superávit"} resultante excede ${deficitCapPct}% do TDEE — clampado.`,
        });
      }

      kcal = direction === "lose" ? tdee - deltaKcal : tdee + deltaKcal;

      if (direction === "lose" && kcal < bmr) {
        kcal = bmr;
        warnings.push({
          code: "below_bmr",
          message: "Meta calórica abaixo da TMB — ajustada para a TMB.",
        });
      }

      const floor = HARD_FLOOR_KCAL[input.sex];
      if (direction === "lose" && kcal < floor) {
        kcal = floor;
        warnings.push({
          code: "hard_floor",
          message: `Meta calórica abaixo do piso absoluto (${floor} kcal) — ajustada.`,
        });
      }
    }
  }

  // Massa magra = peso total menos a fração de gordura — base mais precisa
  // pra proteína que peso total (dois corpos com o mesmo peso e composições
  // diferentes precisam de quantidades de proteína bem diferentes).
  const leanMass_kg = input.weight_kg * (1 - input.body_fat_pct / 100);

  const hasKidneyDisease = gates.some((g) => g.condition === "kidney_disease");
  let protein_g: number;
  if (hasKidneyDisease) {
    // Restrição clínica é dosada por peso corporal total, não massa magra.
    protein_g = input.weight_kg * 0.8;
  } else {
    const proteinPerKgLeanMass = effectiveGoal === "lose" ? 2.2 : 1.8;
    let raw = leanMass_kg * proteinPerKgLeanMass;
    if (input.protein_g_override !== undefined) {
      // Ajuste manual (slider na tela de revelação) — clampado a uma faixa seguinda.
      const minProtein = leanMass_kg * 1.2;
      const maxProtein = leanMass_kg * 3.0;
      raw = Math.min(maxProtein, Math.max(minProtein, input.protein_g_override));
    }
    protein_g = raw;
  }

  const fatFromPct = (kcal * 0.25) / 9;
  const fatFloor = 0.6 * input.weight_kg;
  const fat_g = Math.max(fatFromPct, fatFloor);

  let carbs_g = (kcal - 4 * protein_g - 9 * fat_g) / 4;
  if (carbs_g < 0) carbs_g = 0;
  if (carbs_g < 50) {
    warnings.push({ code: "very_low_carb", message: "Carboidrato abaixo de 50g/dia." });
  } else if (carbs_g < 100) {
    warnings.push({ code: "low_carb", message: "Carboidrato abaixo de 100g/dia." });
  }

  const fiber_g = fiberTargetG(kcal);

  const actualDeltaKcal = tdee - kcal;
  const projectedRate =
    effectiveGoal === "maintain"
      ? 0
      : deficitKcalPerDayToRateKgPerWeek(Math.abs(actualDeltaKcal)) *
        (actualDeltaKcal >= 0 ? 1 : -1);

  let blockReason: string | null = null;
  if (blockingGate) {
    if (blockingGate.condition === "target_weight_underweight" && input.target_weight_kg) {
      const minWeight = round2(18.5 * (input.height_cm / 100) ** 2);
      blockReason = `Peso-alvo implica um IMC abaixo do saudável (mínimo recomendado: ${minWeight} kg para sua altura). Sugerimos manutenção ou ganho de peso.`;
    } else {
      blockReason = `${blockingGate.message} Metas ajustadas para manutenção.`;
    }
  }

  return {
    kcal: round2(kcal),
    protein_g: round2(protein_g),
    carbs_g: round2(carbs_g),
    fat_g: round2(fat_g),
    fiber_g: round2(fiber_g),
    bmr_kcal: round2(bmr),
    tdee_kcal: round2(tdee),
    tdee_source: "declared",
    projected_rate_kg_per_week: round2(projectedRate),
    warnings,
    blocked: blockingGate !== undefined,
    block_reason: blockReason,
  };
}
