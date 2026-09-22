// Edição manual de metas no Perfil (M20) — regra de proporcionalidade
// combinada no brainstorm do produto:
//   • Editar calorias  → mantém o % de P/C/G, reescala os 3 em gramas.
//   • Editar UM macro  → calorias totais ficam fixas; os outros dois
//     absorvem a diferença mantendo a proporção *entre si*.
// Compartilhado entre a tela do app (recálculo ao arrastar) e a rota do
// servidor (checagem de consistência kcal ↔ macros antes de persistir).

export const MACRO_KCAL_PER_G = {
  protein_g: 4,
  carbs_g: 4,
  fat_g: 9,
} as const;

export type MacroKey = keyof typeof MACRO_KCAL_PER_G;

export type MacroSplit = {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

/** Calorias implícitas pelos gramas de macro (4P + 4C + 9G). */
export function macroKcal(macros: MacroSplit): number {
  return (
    macros.protein_g * MACRO_KCAL_PER_G.protein_g +
    macros.carbs_g * MACRO_KCAL_PER_G.carbs_g +
    macros.fat_g * MACRO_KCAL_PER_G.fat_g
  );
}

/** Editou as calorias totais: mantém o % de cada macro, reescala os gramas. */
export function scaleMacrosToKcal(macros: MacroSplit, newKcal: number): MacroSplit {
  const currentKcal = macroKcal(macros);
  if (currentKcal <= 0) return macros;
  const ratio = newKcal / currentKcal;
  return {
    protein_g: macros.protein_g * ratio,
    carbs_g: macros.carbs_g * ratio,
    fat_g: macros.fat_g * ratio,
  };
}

/**
 * Editou um macro específico (em gramas): as calorias totais não mudam — os
 * outros dois macros absorvem a diferença, mantendo a proporção *entre si*
 * que já tinham antes da edição. `newGrams` é clampado a [0, kcal_total] em
 * calorias equivalentes — não dá pra pedir mais proteína do que o orçamento
 * calórico inteiro permite.
 */
export function redistributeMacro(macros: MacroSplit, key: MacroKey, newGrams: number): MacroSplit {
  const kcalTotal = macroKcal(macros);
  const editedKcal = Math.min(Math.max(newGrams, 0) * MACRO_KCAL_PER_G[key], kcalTotal);
  const others = (Object.keys(MACRO_KCAL_PER_G) as MacroKey[]).filter((k) => k !== key);
  const oldOtherKcal = others.reduce((sum, k) => sum + macros[k] * MACRO_KCAL_PER_G[k], 0);
  const remainingKcal = kcalTotal - editedKcal;

  const next: MacroSplit = { ...macros, [key]: editedKcal / MACRO_KCAL_PER_G[key] };
  for (const k of others) {
    const oldKcalShare = macros[k] * MACRO_KCAL_PER_G[k];
    const share = oldOtherKcal > 0 ? oldKcalShare / oldOtherKcal : 1 / others.length;
    next[k] = (remainingKcal * share) / MACRO_KCAL_PER_G[k];
  }
  return next;
}

/** Faixa [min%, max%] permitida por macro — políticas de UI, não clínicas. */
export type MacroPctBounds = Record<MacroKey, [number, number]>;

/**
 * Faixa de gramas que `key` pode assumir SEM que `redistributeMacro` jogue um
 * dos outros dois pra fora da própria faixa percentual.
 *
 * `redistributeMacro` sozinho só respeita o macro editado: ele reparte o
 * orçamento calórico que sobra entre os outros dois mantendo a razão *entre
 * eles*, mas nunca olha se o resultado ainda cabe na faixa de cada um. Exemplo
 * real: com proteína no piso (10%) e gordura no teto (45%), zerar a gordura
 * livera 85% do orçamento pra proteína+carbo na proporção antiga entre eles —
 * e se essa proporção for bem desbalanceada, o carboidrato passa fácil do
 * teto de 65% dele. Esta função resolve o sistema pra trás: dado quanto cada
 * um dos "outros dois" pode absorver (seus próprios min/max), deriva até onde
 * o macro sendo editado pode ir sem violar nenhum dos dois.
 */
export function editableRange(
  macros: MacroSplit,
  key: MacroKey,
  bounds: MacroPctBounds,
  kcalTotal: number,
): { minGrams: number; maxGrams: number } {
  const others = (Object.keys(MACRO_KCAL_PER_G) as MacroKey[]).filter((k) => k !== key);
  const oldOtherKcal = others.reduce((sum, k) => sum + macros[k] * MACRO_KCAL_PER_G[k], 0);

  // R = orçamento calórico que sobra pros outros dois depois da edição.
  // Cada um deles vira R * (razão fixa que já tinha em relação ao outro).
  let rMin = 0;
  let rMax = kcalTotal;
  for (const other of others) {
    const oldKcalShare = macros[other] * MACRO_KCAL_PER_G[other];
    const share = oldOtherKcal > 0 ? oldKcalShare / oldOtherKcal : 1 / others.length;
    if (share <= 0) continue;
    const [minPct, maxPct] = bounds[other];
    rMin = Math.max(rMin, ((minPct / 100) * kcalTotal) / share);
    rMax = Math.min(rMax, ((maxPct / 100) * kcalTotal) / share);
  }

  const [ownMinPct, ownMaxPct] = bounds[key];
  const ownMinKcal = (ownMinPct / 100) * kcalTotal;
  const ownMaxKcal = (ownMaxPct / 100) * kcalTotal;
  // editedKcal = kcalTotal - R, então o min/max de R viram o max/min do editado.
  const editedMinKcal = Math.max(ownMinKcal, kcalTotal - rMax);
  // Faixas conflitantes (rMin > rMax) não têm solução exata — cai pro piso
  // do próprio macro em vez de devolver um intervalo invertido, que quebraria
  // o slider (min > max).
  const editedMaxKcal = Math.max(editedMinKcal, Math.min(ownMaxKcal, kcalTotal - rMin));

  return {
    minGrams: editedMinKcal / MACRO_KCAL_PER_G[key],
    maxGrams: editedMaxKcal / MACRO_KCAL_PER_G[key],
  };
}

/**
 * As calorias declaradas devem bater com o que os gramas de macro implicam
 * (4P + 4C + 9G), com folga pra arredondamento de UI — usado pelo servidor
 * pra rejeitar payloads inconsistentes antes de persistir em nutrition_goals.
 */
export function macrosMatchKcal(macros: MacroSplit, kcal: number, tolerancePct = 0.05): boolean {
  return Math.abs(macroKcal(macros) - kcal) <= kcal * tolerancePct;
}
