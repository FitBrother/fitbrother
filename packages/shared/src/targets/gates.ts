import type { GateResult, Goal, TargetsInput } from "./types.js";

const BMI_UNDERWEIGHT_THRESHOLD = 18.5;

/** IMC arredondado pra 1 casa decimal — evita falsos negativos por ponto flutuante
 * (ex. 60kg/1.80m² = 18.5185, que deve contar como "IMC 18.5"). */
function bmiRounded1(weight_kg: number, height_cm: number): number {
  const heightM = height_cm / 100;
  return Math.round((weight_kg / (heightM * heightM)) * 10) / 10;
}

function goalImpliesLoss(goal: Goal): boolean {
  return goal === "lose";
}

export function evaluateSafetyGates(input: TargetsInput): GateResult[] {
  const gates: GateResult[] = [];

  if (input.age_years < 18 && goalImpliesLoss(input.goal)) {
    gates.push({
      condition: "age_under_18",
      severity: "BLOCK",
      message: "Menores de 18 anos não recebem déficit calórico.",
    });
  }

  if (input.is_pregnant_or_lactating === true) {
    gates.push({
      condition: "pregnant_or_lactating",
      severity: "BLOCK",
      message: "Gravidez/amamentação: sem déficit calórico.",
    });
    gates.push({
      condition: "pregnant_or_lactating",
      severity: "REFER",
      message: "Encaminhar a acompanhamento profissional (nutricionista/obstetra).",
    });
  }

  const currentBmi = bmiRounded1(input.weight_kg, input.height_cm);
  if (currentBmi <= BMI_UNDERWEIGHT_THRESHOLD && goalImpliesLoss(input.goal)) {
    gates.push({
      condition: "current_bmi_underweight",
      severity: "BLOCK",
      message: `IMC atual (${currentBmi}) já está em ou abaixo de 18,5 — sem déficit calórico.`,
    });
  }

  if (input.target_weight_kg !== undefined) {
    const targetBmi = bmiRounded1(input.target_weight_kg, input.height_cm);
    if (targetBmi <= BMI_UNDERWEIGHT_THRESHOLD) {
      gates.push({
        condition: "target_weight_underweight",
        severity: "BLOCK",
        message: `Peso-alvo implica IMC (${targetBmi}) em ou abaixo de 18,5.`,
      });
    }
  }

  if (input.has_kidney_disease === true) {
    gates.push({
      condition: "kidney_disease",
      severity: "REFER",
      message: "Doença renal — proteína limitada a 0,8 g/kg; encaminhar a acompanhamento médico.",
    });
  }

  if (input.has_type1_diabetes === true) {
    gates.push({
      condition: "type1_diabetes",
      severity: "REFER",
      message:
        "Diabetes tipo 1 — sem ajuste terapêutico automático; encaminhar a acompanhamento médico.",
    });
  }

  if (input.uses_glp1 === true) {
    gates.push({
      condition: "glp1_use",
      severity: "WARN",
      message: "Uso de GLP-1 — proteína no topo da faixa, atenção a apetite reduzido.",
    });
  }

  return gates;
}
