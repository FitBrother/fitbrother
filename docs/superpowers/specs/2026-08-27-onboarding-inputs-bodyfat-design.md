# Onboarding: inputs por slider, % de gordura e proteína ajustável — Design

## Motivação

O onboarding redesenhado (spec de 2026-08-27, `onboarding-redesign-design.md`) resolveu
estrutura e motivação, mas manteve os controles de entrada originais. Três problemas
identificados pelo usuário:

1. **Altura/peso/peso-alvo/ritmo** usam `WheelPicker` — no native é uma roda com inércia
   (rápida), mas no web (`react-native-web`) cai num stepper de +/- (`WebStepper`), que é
   lento pra ajustar valores longe do padrão. Falta uma forma de digitar o número direto.
2. **Objetivo (`GoalBlock`)**: a opção "Recomposição" é redundante — já existe "Perder
   gordura" com sliders de peso-alvo/ritmo ajustáveis, que cobrem o mesmo caso de uso com
   mais controle. As descrições de "Perder gordura" e "Ganhar massa" travam um percentual
   fixo de déficit/superávit ("Déficit calórico de 20%") que não bate mais com a realidade
   assim que o usuário mexe nos sliders de ritmo. A tela também rola (scroll) no capítulo
   mais importante da anamnese — objetivo deveria caber inteiro na viewport.
3. **Proteína** é hoje calculada em cima do peso corporal total (com um paliativo pra
   IMC > 30 que troca peso atual por peso-alvo). Isso é impreciso: duas pessoas com o
   mesmo peso e composições corporais diferentes precisam de quantidades de proteína bem
   diferentes, porque proteína serve massa magra, não gordura.

## Escopo

**Dentro do escopo:**
- Componente `SliderInput` reutilizável (slider + input numérico sincronizados).
- Migração de altura, peso, peso-alvo e ritmo pra `SliderInput`.
- Redesenho do `GoalBlock`: remove "Recomposição" (schema + banco + tipo, não só UI),
  copy sem percentual fixo, layout compacto sem scroll.
- Novo bloco `BodyFatBlock` (obrigatório): seleção visual por faixas ilustradas + opção
  de digitar o número exato.
- Fórmula de proteína passa a usar massa magra (peso × (1 − %gordura)).
- Slider de ajuste de proteína na tela de revelação de metas (`RevealBlock`), com
  marcador no ponto recomendado, recalculando carboidrato ao vivo.
- Migration: coluna `anthropometrics.body_fat_pct` e remoção do valor `'recomp'` do enum
  Postgres `goal`.

**Fora do escopo (backlog):**
- Reaproveitar `body_fat_pct`/`protein_g_override` em uma futura tela de "editar metas"
  fora do onboarding (não existe ainda — só onboarding usa `computeTargets` hoje).
- Ilustrações desenhadas à mão pro seletor de % de gordura — v1 usa uma silhueta
  paramétrica em SVG (mesma forma, largura variando por faixa). Trocar por arte real do
  Design System fica pra depois, sem mudar a lógica do componente.
- Editar a fórmula de proteína pra doença renal (`has_kidney_disease`) — continua em
  g/kg de peso total (dosagem clínica, não de performance).

---

## 1. `SliderInput` — componente novo

`apps/mobile/components/SliderInput.tsx`. Usa a nova dependência
`@react-native-community/slider`.

```ts
interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  markerValue?: number; // opcional: risco visual no ponto recomendado
  onChange: (value: number) => void;
}
```

Layout: linha com `label` à esquerda e o valor em `TextInput` numérico editável à
direita (mesma linha, alinhado à direita), slider embaixo ocupando a largura toda. Digitar
no `TextInput` e mover o slider ficam sincronizados nos dois sentidos; o `TextInput` clampa
pra `[min, max]` no blur. Quando `markerValue` é passado, desenha um traço fino na
posição correspondente da track (View absoluta posicionada por `%`).

Altura total do componente (label + slider + input): ~70px — bem mais compacto que o
`WheelPicker` (220px fixos).

## 2. `HeightBlock` / `WeightBlock`

Trocam `WheelPicker` por `SliderInput`, mesmos ranges/steps de hoje:
- Altura: min 120, max 220, step 1, unit "cm".
- Peso: min 30, max 200, step 0.5, unit "kg".

`scrollable={false}` no shell continua (sem mudança de comportamento aqui).

## 3. `GoalBlock` — redesenho

**Opções** (de 4 pra 3):

| value | title | desc |
|---|---|---|
| `lose` | Perder gordura | "Você define o ritmo abaixo." |
| `maintain` | Manter peso | "Calorias = TDEE." (sem mudança) |
| `gain` | Ganhar massa | "Você define o ritmo abaixo." |

`recomp` sai da lista de opções e do tipo `Goal` inteiro (ver §6).

**Peso-alvo e ritmo** (exibidos quando `goal` é `lose`/`gain`) trocam de `WheelPicker`
pra `SliderInput`:
- Peso-alvo: min 30, max 250, step 0.5, unit "kg".
- Ritmo: min 0.1, max 1.0, step 0.1, unit "kg/semana".

**Sem scroll:** `scrollable={false}` no shell. Com a 4ª opção removida e os dois
`WheelPicker` (220px cada) trocados por `SliderInput` (~70px cada), a tela cabe na
viewport padrão sem rolagem. O texto de data projetada continua abaixo dos sliders.

## 4. `BodyFatBlock` — novo bloco (capítulo 1, obrigatório)

Posição no fluxo: depois de `weight`, antes de `activity` (mesmo grupo de medidas
físicas). Não é pulável — safety gates dependem de peso/altura, mas a proteína agora
depende de composição corporal, então não faz sentido deixar em branco.

**Seleção visual:** 5 faixas ilustradas por sexo, cada uma com um % representativo usado
no cálculo:

| Faixa | Homem | Mulher |
|---|---|---|
| 1 | 10% | 17% |
| 2 | 14% | 22% |
| 3 | 20% | 28% |
| 4 | 26% | 34% |
| 5 | 33% | 40% |

Pra `sex === "other"`, usa uma faixa neutra no meio-termo entre as duas tabelas acima
(mesmo padrão já usado no cálculo de BMR pra esse caso — constante intermediária).

Ilustração: `apps/mobile/components/onboarding/BodyFatSilhouette.tsx`, recebe
`{ sex: Sex; bucket: 1 | 2 | 3 | 4 | 5 }` e renderiza uma silhueta em `react-native-svg`
com a largura do tronco/cintura escalando por `bucket` (mesma forma base, path
parametrizado — não são 10 assets desenhados à mão). Cores via `lib/colors.ts`
(`neutral-100` de fundo, `primary-400` no estado selecionado).

**Número exato:** abaixo da grade de 5 cards, um link de texto "Prefiro digitar o número
exato" revela um `Input` numérico (min 3, max 60, unit "%"). Ao digitar um valor, a
ilustração da faixa mais próxima fica destacada (feedback visual), mas o valor persistido
em `body_fat_pct` é o número exato digitado, não o ponto médio da faixa.

Estado: um único campo `body_fat_pct: number` no store — tanto tocar num card quanto
digitar um número escrevem nesse mesmo campo.

## 5. Fórmula de proteína — massa magra

`packages/shared/src/targets/compute-targets.ts`:

- Remove `useTargetWeightForProtein` / branch de IMC > 30 / warning
  `protein_on_current_weight_imc_over_30` inteiros — não são mais necessários porque
  `body_fat_pct` agora está sempre disponível.
- `leanMass = input.weight_kg * (1 - input.body_fat_pct / 100)`.
- Multiplicadores (g/kg de massa magra), substituindo os atuais 1.8/2.0/1.6 g/kg peso
  total:
  - `lose`: **2,2 g/kg MM**
  - `maintain` / `gain`: **1,8 g/kg MM**
  - `has_kidney_disease` (qualquer objetivo): continua **0,8 g/kg de peso total** — dose
    clínica, não muda.
- `protein_g = leanMass * proteinPerKg` (ou peso total pra doença renal, como hoje).

`TargetsInput` (`packages/shared/src/targets/types.ts`) ganha `body_fat_pct: number`
(obrigatório — único call site hoje é o onboarding, que sempre coleta isso).

## 6. Remoção de `recomp`

`recomp` sai completamente — enum Postgres, tipo TS, schema zod:

- **Migration nova**: recria o enum Postgres `goal` sem `'recomp'`. Único uso como tipo
  de coluna é `profiles.goal` (`0003_profiles.sql:25`); os demais usos de `goal` nas
  migrations são declarações de variável local (`v_goal goal := ...`) dentro de funções
  PL/pgsql, que não precisam de migração de dados. Sequência segura (produto ainda não
  lançado, sem linhas de produção com `goal = 'recomp'`):
  ```sql
  CREATE TYPE goal_new AS ENUM ('lose', 'maintain', 'gain');
  ALTER TABLE public.profiles ALTER COLUMN goal TYPE goal_new USING goal::text::goal_new;
  DROP TYPE public.goal;
  ALTER TYPE goal_new RENAME TO goal;
  ```
- `packages/shared/src/targets/types.ts`: `Goal = "lose" | "maintain" | "gain"`.
- `packages/shared/src/targets/compute-targets.ts`: remove o branch
  `effectiveGoal === "recomp"` (`kcal = tdee * 0.95`) e as referências a `recomp` no
  cálculo de proteína.
- `packages/shared/src/schemas.ts`: `GoalSchema` perde `"recomp"`.
- Testes (`compute-targets.test.ts`, `gates.test.ts` se houver casos de recomp) atualizados.

## 7. Proteína ajustável — `RevealBlock`

**Motivação:** o valor calculado é uma recomendação, não uma imposição — o usuário pode
preferir mais ou menos proteína dentro de uma faixa segura.

- `TargetsInput` ganha `protein_g_override?: number`. Dentro de `computeTargets()`: se
  presente, clampa entre **1,2–3,0 g/kg de massa magra** (mesma massa magra calculada em
  §5) e usa o valor clampado como `protein_g` no lugar do valor calculado pelos
  multiplicadores padrão; `carbs_g` é recalculado com a fórmula existente
  (`(kcal - 4*protein_g - 9*fat_g) / 4`), kcal e gordura não mudam. Uma função só, usada
  tanto no preview local (client) quanto no servidor — sem duplicar lógica.
- `useOnboardingResultStore` passa a guardar também o `targetsInput` usado (não só o
  `Targets` de saída), pra o `RevealBlock` poder rechamar `computeTargets()` a cada
  movimento do slider sem precisar reconstruir o input do zero.
- `RevealBlock` deixa de ser estático: kcal fica fixo (texto grande, como hoje); abaixo,
  um `SliderInput` de proteína — `min`/`max` calculados a partir da faixa 1,2–3,0 g/kg MM
  em gramas, `step` de 1g, `markerValue` no `protein_g` recomendado (calculado sem
  override). Carboidrato e gordura exibidos abaixo do slider, recalculados ao vivo a cada
  mudança.
- Se o usuário nunca toca no slider, `protein_g_override` fica `undefined` — nada muda no
  payload nem no servidor (mesmo comportamento de hoje). Se toca, o valor final é
  persistido em `onboardingStore.protein_g_override` e enviado em
  `OnboardingPayloadSchema.protein_g_override` (opcional) → `buildTargetsInput` no
  servidor aplica o mesmo override antes de chamar a RPC `complete_onboarding` — cliente
  e servidor ficam consistentes porque usam a mesma função `computeTargets()`.

## 8. Dados e persistência

- `supabase/migrations/`: nova migration adiciona `anthropometrics.body_fat_pct
  numeric(4,1)` (nullable, mesmo padrão de `bmr_kcal`/`tdee_kcal` — futuras remedições
  podem não incluir) com `CHECK (body_fat_pct IS NULL OR (body_fat_pct > 0 AND
  body_fat_pct < 70))`.
- `complete_onboarding_impl` (redefinição via `CREATE OR REPLACE`, nova migration):
  INSERT em `anthropometrics` passa a incluir `body_fat_pct` a partir de
  `(payload->>'body_fat_pct')::numeric`. Não precisa tocar na lógica de
  `nutrition_goals` — `v_targets` já vem pronto do TS (protein_g já reflete massa magra
  e eventual override, calculado em `apps/server/src/routes/onboarding.ts` antes da
  chamada à RPC).
- `OnboardingPayloadSchema`: `body_fat_pct: z.number().min(3).max(60)` (obrigatório,
  igual `weight_kg`/`height_cm`), `protein_g_override: z.number().positive().optional()`.
- `onboardingStore.ts`: novos campos `body_fat_pct: number | undefined` e
  `protein_g_override: number | undefined`, incluídos em `toAnswers()`; `toPayload()`
  passa a exigir `body_fat_pct !== undefined` (mesmo padrão de `weight_kg`/`height_cm` —
  retorna `null` se faltar) e inclui `protein_g_override` quando definido.
- `apps/server/src/services/targets.ts` (`buildTargetsInput`): inclui
  `body_fat_pct: payload.body_fat_pct` e `protein_g_override: payload.protein_g_override`.
- `apps/mobile/lib/onboarding/blocks.ts`: novo bloco `body_fat` entra no array entre
  `weight` e `activity` (chapter 1). `DATA_BLOCK_COUNT` sobe de 12 pra 13 (mais um bloco
  de anamnese antes de `signup`).
- `GoalBlock` e `CalculatingBlock` (preview local) passam `body_fat_pct: s.body_fat_pct`
  pro `computeTargets()`/`TargetsInput` que já montam — valor sempre definido nesse ponto
  do fluxo porque `body_fat` é obrigatório e vem antes de `goal` na ordem dos blocos.

---

## Resumo de arquivos afetados

**Novos:**
- `apps/mobile/components/SliderInput.tsx`
- `apps/mobile/components/onboarding/blocks/BodyFatBlock.tsx`
- `apps/mobile/components/onboarding/BodyFatSilhouette.tsx`
- `supabase/migrations/NNNN_body_fat_pct_and_goal_enum.sql`

**Modificados:**
- `apps/mobile/components/onboarding/blocks/{Height,Weight,Goal,Calculating,Reveal}Block.tsx`
- `apps/mobile/lib/stores/onboardingStore.ts`
- `apps/mobile/lib/stores/onboardingResultStore.ts`
- `apps/mobile/lib/onboarding/blocks.ts`
- `packages/shared/src/targets/types.ts`
- `packages/shared/src/targets/compute-targets.ts`
- `packages/shared/src/targets/compute-targets.test.ts`
- `packages/shared/src/schemas.ts`
- `apps/server/src/services/targets.ts`
- `apps/mobile/package.json` (nova dependência `@react-native-community/slider`)

**Removido (dead code por design, precedente de `SOFT_MODE`):** nenhum arquivo — `recomp`
sai do enum/tipo/schema ativamente (decisão explícita do usuário, diferente do TCA), mas
não há arquivo dedicado a remover.
