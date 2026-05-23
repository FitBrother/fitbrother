import {
  FunctionCallingMode,
  GoogleGenerativeAI,
  SchemaType,
  type FunctionDeclaration,
} from "@google/generative-ai";
import { MealExtractionSchema, type LLMProvider } from "@fitbrother/shared";
import { env } from "../../lib/env.js";

/**
 * Gemini 1.5 Flash implementation of LLMProvider.
 *
 * Why function calling
 * ─────────────────────
 * The MealExtractionSchema is a strict contract — invalid output breaks the
 * pipeline. Letting the model freestyle then validating its JSON is fragile;
 * forcing a function call with a JSON-schema-like declaration is the most
 * reliable way to get well-formed structured data from Gemini.
 *
 * Cost
 * ────
 * Gemini 1.5 Flash pricing (2025): $0.075/1M input tokens, $0.30/1M output.
 * A typical meal extraction (~120 input + ~150 output tokens) costs ~0.006¢.
 * We multiply by 1000 below to track in *centi-cents* (1/100 of a cent) — the
 * numeric(8,2) column would lose precision otherwise.  AI_CAP_COST_CENTS is
 * still in cents; we divide by 1000 when computing what to record.
 */

const SYSTEM_PROMPT = `Você é um nutricionista especializado em extrair informações estruturadas de relatos de refeições em português brasileiro.

A partir do texto enviado pelo usuário, identifique cada alimento/bebida consumido e estime macros. Para cada item:
- description: descrição original do usuário (ex: "2 ovos cozidos")
- quantity + unit: quantidade numérica (g/ml/unit/slice/cup/tbsp/tsp)
- kcal/protein_g/carbs_g/fat_g: estimativa de macronutrientes para a quantidade real
- food_match_hint: nome canônico do alimento em português (ex: "ovo cozido", "café preto"), sem quantidade. Usado pra match com catálogo TACO.

Inferir meal_type pelo contexto (horário, conteúdo). Default "other" se incerto.

Estimar confidence (0.0-1.0):
- 0.9+: texto claro com quantidades explícitas
- 0.7-0.9: alimentos identificáveis mas quantidades aproximadas
- 0.5-0.7: ambíguo mas plausível
- <0.5: muito vago (será marcado pra revisão pelo usuário)

Seja conservador em estimativas — prefira valores realistas (TACO/USDA) a chutes otimistas.`;

// Gemini's typings demand `format: "enum"` for enum strings; we keep things
// explicit rather than casting around it.
const extractMealFunctionDeclaration: FunctionDeclaration = {
  name: "extract_meal",
  description: "Extract structured meal data from natural language Portuguese text",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      meal_type: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["breakfast", "lunch", "snack", "dinner", "other"],
        description: "Type of meal inferred from context",
      },
      items: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            description: { type: SchemaType.STRING },
            quantity: { type: SchemaType.NUMBER },
            unit: {
              type: SchemaType.STRING,
              format: "enum",
              enum: ["g", "ml", "unit", "slice", "cup", "tbsp", "tsp"],
            },
            kcal: { type: SchemaType.NUMBER },
            protein_g: { type: SchemaType.NUMBER },
            carbs_g: { type: SchemaType.NUMBER },
            fat_g: { type: SchemaType.NUMBER },
            food_match_hint: { type: SchemaType.STRING },
          },
          required: ["description", "quantity", "unit", "kcal", "protein_g", "carbs_g", "fat_g"],
        },
      },
      confidence: { type: SchemaType.NUMBER },
    },
    required: ["meal_type", "items", "confidence"],
  },
};

// Per-call cost in centi-cents (1/100 of a cent). Multiply by 1/1000 to get
// the cent value we store in ai_extractions.cost_cents.
function calculateCostCents(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * 0.075 * 100; // cents
  const outputCost = (outputTokens / 1_000_000) * 0.3 * 100; // cents
  return Math.round((inputCost + outputCost) * 1000) / 1000;
}

let _client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (_client) return _client;
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
  }
  _client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return _client;
}

export const geminiProvider: LLMProvider = {
  name: "gemini",

  async extractMeal({ text, locale }) {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [extractMealFunctionDeclaration] }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.ANY,
          allowedFunctionNames: ["extract_meal"],
        },
      },
    });

    const result = await model.generateContent(`Locale: ${locale}\n\nRefeição: ${text}`);

    const calls = result.response.functionCalls();
    if (!calls || calls.length === 0) {
      throw new Error("gemini_no_function_call");
    }
    const call = calls[0]!;
    if (call.name !== "extract_meal") {
      throw new Error(`gemini_unexpected_function: ${call.name}`);
    }

    // Validate against zod — Gemini's schema enforcement is best-effort, not
    // a contract. Throwing here surfaces drift fast.
    const parsed = MealExtractionSchema.safeParse(call.args);
    if (!parsed.success) {
      throw new Error(
        `gemini_schema_violation: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", ")}`,
      );
    }

    const usageMetadata = result.response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;

    return {
      output: parsed.data,
      usage: {
        inputTokens,
        outputTokens,
        costCents: calculateCostCents(inputTokens, outputTokens),
      },
    };
  },
};
