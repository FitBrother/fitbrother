import type { OnboardingState } from "@/lib/stores/onboardingStore";

// A rota é uma URL comum — nada impede alguém de editar o endereço direto
// pra "/(onboarding)/consent" ou "/(onboarding)/signup" sem ter passado
// pelos blocos de dado físico antes. Isso nunca ameaçou a integridade do
// cadastro (o servidor recusa qualquer payload sem peso/altura/etc., ver
// OnboardingPayloadSchema), mas dava uma experiência quebrada: telas que
// não deviam ser alcançáveis ainda, terminando num "faltam informações"
// genérico lá no fim, sem levar de volta pra etapa que faltou.
//
// Só cobre os blocos 0-6 de ONBOARDING_BLOCKS (os que alimentam campo
// obrigatório em toPayload()) — health/signup/identity/consent não têm
// pré-requisito de dado físico próprio, e o servidor já é a rede de
// segurança real pra consentimento/conta.
//
// Vive num arquivo próprio, fora de blocks.ts, de propósito: blocks.ts
// importa os 17 componentes de bloco (cadeia pesada, inclusive
// @fitbrother/shared) só pra montar ONBOARDING_BLOCKS — essa checagem é
// lógica pura, sem motivo pra arrastar esse import inteiro junto.
const GATE_CHECKS: Array<(s: OnboardingState) => boolean> = [
  (s) => s.full_name.trim().length > 0, // name
  (s) => Boolean(s.sex) && s.birth_date.trim().length > 0, // basics
  (s) => s.height_cm !== undefined, // height
  (s) => s.weight_kg !== undefined, // weight
  (s) => s.body_fat_pct !== undefined, // body_fat
  (s) => Boolean(s.activity_level), // activity
  (s) => Boolean(s.goal), // goal
];

/**
 * Primeiro índice em ONBOARDING_BLOCKS cujo pré-requisito ainda falta —
 * Infinity se os blocos 0-6 já estão todos preenchidos, pra "nenhum bloco
 * mais à frente fica bloqueado" valer pra QUALQUER índice depois do 6
 * (health, calculating, reveal, ...), não só pra GATE_CHECKS.length (7).
 * Retornar 7 fixo já causou loop infinito: com `index <= gate` no
 * [block].tsx, isso liberava só até o índice 7 (health) — o índice 8
 * (calculating) caía como bloqueado de novo, redirecionando de volta pro
 * health pra sempre.
 */
export function firstIncompleteGateIndex(state: OnboardingState): number {
  const i = GATE_CHECKS.findIndex((check) => !check(state));
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}
