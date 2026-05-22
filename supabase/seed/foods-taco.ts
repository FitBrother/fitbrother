#!/usr/bin/env node
/* eslint-disable no-console -- CLI seed script: stdout is the UI */
/**
 * Seed the public.foods catalog with a verified subset of the TACO database
 * (Tabela Brasileira de Composição de Alimentos — UNICAMP, 4ª ed., 2011).
 *
 * The values below are taken from the official TACO PDF. Each entry uses the
 * canonical comma-separated naming ("Arroz, integral, cozido") that matches
 * the source document — the trigram normalization (lower + unaccent) makes
 * fuzzy queries against simpler user input still resolve.
 *
 * Usage:
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx supabase/seed/foods-taco.ts
 *
 * Idempotent — upserts by (source, name). Re-running updates macros if the
 * canonical values change in a future TACO revision.
 *
 * Note: this MVP subset covers ~25 frequent foods. Expanding to the full
 * ~600-entry TACO catalog is a follow-up before launch (see PLAN.md M2.1).
 */

import { createClient } from "@supabase/supabase-js";

type Food = {
  name: string;
  serving_label: string | null;
  serving_grams: number | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

const FOODS: Food[] = [
  // Cereals & breads
  {
    name: "Arroz, branco, cozido",
    serving_label: "1 colher de sopa (25g)",
    serving_grams: 25,
    kcal_per_100g: 128,
    protein_per_100g: 2.5,
    carbs_per_100g: 28.1,
    fat_per_100g: 0.2,
  },
  {
    name: "Arroz, integral, cozido",
    serving_label: "1 colher de sopa (25g)",
    serving_grams: 25,
    kcal_per_100g: 124,
    protein_per_100g: 2.6,
    carbs_per_100g: 25.8,
    fat_per_100g: 1.0,
  },
  {
    name: "Pão, francês",
    serving_label: "1 unidade (50g)",
    serving_grams: 50,
    kcal_per_100g: 300,
    protein_per_100g: 8.0,
    carbs_per_100g: 58.6,
    fat_per_100g: 3.1,
  },
  {
    name: "Pão, de forma, integral",
    serving_label: "1 fatia (25g)",
    serving_grams: 25,
    kcal_per_100g: 253,
    protein_per_100g: 9.4,
    carbs_per_100g: 49.0,
    fat_per_100g: 3.2,
  },
  {
    name: "Aveia, flocos, crua",
    serving_label: "1 colher de sopa (15g)",
    serving_grams: 15,
    kcal_per_100g: 394,
    protein_per_100g: 13.9,
    carbs_per_100g: 66.6,
    fat_per_100g: 8.5,
  },
  {
    name: "Macarrão, cozido",
    serving_label: "1 escumadeira (80g)",
    serving_grams: 80,
    kcal_per_100g: 102,
    protein_per_100g: 3.4,
    carbs_per_100g: 19.9,
    fat_per_100g: 1.3,
  },
  {
    name: "Tapioca",
    serving_label: "1 unidade média (60g)",
    serving_grams: 60,
    kcal_per_100g: 240,
    protein_per_100g: 0.3,
    carbs_per_100g: 59.6,
    fat_per_100g: 0.0,
  },

  // Proteins (animal)
  {
    name: "Ovo, de galinha, cozido",
    serving_label: "1 unidade (50g)",
    serving_grams: 50,
    kcal_per_100g: 146,
    protein_per_100g: 13.3,
    carbs_per_100g: 0.6,
    fat_per_100g: 9.5,
  },
  {
    name: "Ovo, de galinha, frito",
    serving_label: "1 unidade (50g)",
    serving_grams: 50,
    kcal_per_100g: 240,
    protein_per_100g: 14.0,
    carbs_per_100g: 0.6,
    fat_per_100g: 19.8,
  },
  {
    name: "Frango, peito, grelhado, sem pele",
    serving_label: "1 filé médio (100g)",
    serving_grams: 100,
    kcal_per_100g: 159,
    protein_per_100g: 32.0,
    carbs_per_100g: 0,
    fat_per_100g: 2.9,
  },
  {
    name: "Frango, coxa, assada, com pele",
    serving_label: "1 unidade média (65g)",
    serving_grams: 65,
    kcal_per_100g: 215,
    protein_per_100g: 28.4,
    carbs_per_100g: 0,
    fat_per_100g: 10.9,
  },
  {
    name: "Carne bovina, patinho, grelhado",
    serving_label: "1 bife médio (100g)",
    serving_grams: 100,
    kcal_per_100g: 219,
    protein_per_100g: 35.9,
    carbs_per_100g: 0,
    fat_per_100g: 7.3,
  },
  {
    name: "Carne bovina, alcatra, grelhada",
    serving_label: "1 bife médio (100g)",
    serving_grams: 100,
    kcal_per_100g: 215,
    protein_per_100g: 32.4,
    carbs_per_100g: 0,
    fat_per_100g: 8.7,
  },
  {
    name: "Atum, conservado em óleo, drenado",
    serving_label: "1 lata (170g)",
    serving_grams: 170,
    kcal_per_100g: 194,
    protein_per_100g: 25.6,
    carbs_per_100g: 0,
    fat_per_100g: 9.7,
  },
  {
    name: "Salmão, fresco, grelhado",
    serving_label: "1 filé médio (100g)",
    serving_grams: 100,
    kcal_per_100g: 211,
    protein_per_100g: 23.2,
    carbs_per_100g: 0,
    fat_per_100g: 12.9,
  },

  // Legumes
  {
    name: "Feijão, carioca, cozido",
    serving_label: "1 concha (80g)",
    serving_grams: 80,
    kcal_per_100g: 76,
    protein_per_100g: 4.8,
    carbs_per_100g: 13.6,
    fat_per_100g: 0.5,
  },
  {
    name: "Feijão, preto, cozido",
    serving_label: "1 concha (80g)",
    serving_grams: 80,
    kcal_per_100g: 77,
    protein_per_100g: 4.5,
    carbs_per_100g: 14.0,
    fat_per_100g: 0.5,
  },
  {
    name: "Lentilha, cozida",
    serving_label: "1 concha (80g)",
    serving_grams: 80,
    kcal_per_100g: 93,
    protein_per_100g: 6.3,
    carbs_per_100g: 16.3,
    fat_per_100g: 0.5,
  },
  {
    name: "Grão-de-bico, cozido",
    serving_label: "1 concha (80g)",
    serving_grams: 80,
    kcal_per_100g: 121,
    protein_per_100g: 8.4,
    carbs_per_100g: 20.5,
    fat_per_100g: 2.1,
  },

  // Dairy
  {
    name: "Leite, integral, UHT",
    serving_label: "1 copo (200ml)",
    serving_grams: 200,
    kcal_per_100g: 61,
    protein_per_100g: 2.9,
    carbs_per_100g: 4.3,
    fat_per_100g: 3.5,
  },
  {
    name: "Leite, desnatado, UHT",
    serving_label: "1 copo (200ml)",
    serving_grams: 200,
    kcal_per_100g: 35,
    protein_per_100g: 2.9,
    carbs_per_100g: 4.9,
    fat_per_100g: 0.2,
  },
  {
    name: "Iogurte, natural, integral",
    serving_label: "1 pote (170g)",
    serving_grams: 170,
    kcal_per_100g: 51,
    protein_per_100g: 4.1,
    carbs_per_100g: 1.9,
    fat_per_100g: 3.0,
  },
  {
    name: "Queijo, mussarela",
    serving_label: "1 fatia (20g)",
    serving_grams: 20,
    kcal_per_100g: 330,
    protein_per_100g: 22.6,
    carbs_per_100g: 3.0,
    fat_per_100g: 25.0,
  },
  {
    name: "Queijo, minas, frescal",
    serving_label: "1 fatia (30g)",
    serving_grams: 30,
    kcal_per_100g: 264,
    protein_per_100g: 17.4,
    carbs_per_100g: 3.2,
    fat_per_100g: 20.2,
  },
  {
    name: "Requeijão, cremoso",
    serving_label: "1 colher de sopa (20g)",
    serving_grams: 20,
    kcal_per_100g: 257,
    protein_per_100g: 9.6,
    carbs_per_100g: 3.2,
    fat_per_100g: 23.0,
  },

  // Fruits
  {
    name: "Banana, prata",
    serving_label: "1 unidade média (86g)",
    serving_grams: 86,
    kcal_per_100g: 98,
    protein_per_100g: 1.3,
    carbs_per_100g: 26.0,
    fat_per_100g: 0.1,
  },
  {
    name: "Maçã, com casca",
    serving_label: "1 unidade média (130g)",
    serving_grams: 130,
    kcal_per_100g: 56,
    protein_per_100g: 0.3,
    carbs_per_100g: 15.2,
    fat_per_100g: 0.0,
  },
  {
    name: "Mamão, formosa",
    serving_label: "1 fatia (170g)",
    serving_grams: 170,
    kcal_per_100g: 45,
    protein_per_100g: 0.8,
    carbs_per_100g: 11.6,
    fat_per_100g: 0.1,
  },
  {
    name: "Laranja, pera",
    serving_label: "1 unidade média (180g)",
    serving_grams: 180,
    kcal_per_100g: 37,
    protein_per_100g: 1.0,
    carbs_per_100g: 8.9,
    fat_per_100g: 0.1,
  },
  {
    name: "Abacate",
    serving_label: "1 colher de sopa (15g)",
    serving_grams: 15,
    kcal_per_100g: 96,
    protein_per_100g: 1.2,
    carbs_per_100g: 6.0,
    fat_per_100g: 8.4,
  },

  // Vegetables & tubers
  {
    name: "Batata, inglesa, cozida",
    serving_label: "1 unidade média (135g)",
    serving_grams: 135,
    kcal_per_100g: 52,
    protein_per_100g: 1.2,
    carbs_per_100g: 11.9,
    fat_per_100g: 0.0,
  },
  {
    name: "Batata-doce, cozida",
    serving_label: "1 unidade pequena (100g)",
    serving_grams: 100,
    kcal_per_100g: 77,
    protein_per_100g: 0.6,
    carbs_per_100g: 18.4,
    fat_per_100g: 0.1,
  },
  {
    name: "Mandioca, cozida",
    serving_label: "1 pedaço (75g)",
    serving_grams: 75,
    kcal_per_100g: 125,
    protein_per_100g: 0.6,
    carbs_per_100g: 30.1,
    fat_per_100g: 0.3,
  },
  {
    name: "Brócolis, cozido",
    serving_label: "1 buquê (30g)",
    serving_grams: 30,
    kcal_per_100g: 25,
    protein_per_100g: 2.1,
    carbs_per_100g: 4.0,
    fat_per_100g: 0.4,
  },
  {
    name: "Alface, crespa",
    serving_label: "1 folha (10g)",
    serving_grams: 10,
    kcal_per_100g: 11,
    protein_per_100g: 1.3,
    carbs_per_100g: 1.7,
    fat_per_100g: 0.2,
  },
  {
    name: "Tomate, cru",
    serving_label: "1 unidade média (100g)",
    serving_grams: 100,
    kcal_per_100g: 15,
    protein_per_100g: 1.1,
    carbs_per_100g: 3.1,
    fat_per_100g: 0.2,
  },
  {
    name: "Cenoura, crua",
    serving_label: "1 unidade média (78g)",
    serving_grams: 78,
    kcal_per_100g: 34,
    protein_per_100g: 1.3,
    carbs_per_100g: 7.7,
    fat_per_100g: 0.2,
  },

  // Beverages
  {
    name: "Café, infusão 10%",
    serving_label: "1 xícara (50ml)",
    serving_grams: 50,
    kcal_per_100g: 9,
    protein_per_100g: 0.7,
    carbs_per_100g: 1.7,
    fat_per_100g: 0.1,
  },
  {
    name: "Suco, laranja, natural",
    serving_label: "1 copo (200ml)",
    serving_grams: 200,
    kcal_per_100g: 37,
    protein_per_100g: 0.6,
    carbs_per_100g: 9.0,
    fat_per_100g: 0.1,
  },

  // Fats & oils
  {
    name: "Azeite, de oliva, extra virgem",
    serving_label: "1 colher de sopa (8g)",
    serving_grams: 8,
    kcal_per_100g: 884,
    protein_per_100g: 0,
    carbs_per_100g: 0,
    fat_per_100g: 100.0,
  },
  {
    name: "Manteiga, com sal",
    serving_label: "1 colher de chá (5g)",
    serving_grams: 5,
    kcal_per_100g: 726,
    protein_per_100g: 0.4,
    carbs_per_100g: 0.06,
    fat_per_100g: 82.4,
  },

  // Nuts
  {
    name: "Castanha-do-pará",
    serving_label: "1 unidade (5g)",
    serving_grams: 5,
    kcal_per_100g: 643,
    protein_per_100g: 14.5,
    carbs_per_100g: 15.1,
    fat_per_100g: 63.5,
  },
  {
    name: "Amendoim, torrado, salgado",
    serving_label: "1 colher de sopa (15g)",
    serving_grams: 15,
    kcal_per_100g: 544,
    protein_per_100g: 27.4,
    carbs_per_100g: 20.3,
    fat_per_100g: 43.9,
  },
];

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see `supabase status` for local values).",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const rows = FOODS.map((f) => ({
    ...f,
    name_normalized: normalize(f.name),
    source: "taco" as const,
    verified: true,
  }));

  console.log(`Upserting ${rows.length} TACO foods…`);
  const { error, count } = await supabase
    .from("foods")
    .upsert(rows, { onConflict: "source,name", count: "exact" });

  if (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }

  console.log(`✓ Seed complete (${count ?? rows.length} rows upserted).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
