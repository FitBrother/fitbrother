# Anamnese/Onboarding UX polish — design

Parte do "Grupo A" do batch de pré-lançamento web. Quatro mudanças em `apps/mobile`, sem impacto em schema/backend.

## 1. Number input mais intuitivo

`components/SliderInput.tsx` — o campo de valor exato (`TextInput` ao lado do label) não tem borda/fundo, só `min-w-[44px] py-1`. Fica reforçado com `border border-neutral-200 bg-white rounded-lg px-2` pra parecer um campo editável de verdade. `keyboardType="decimal-pad"` já mapeia pra `inputMode="decimal"` via react-native-web (confirmado em `node_modules/react-native-web/dist/cjs/exports/TextInput/index.js`) — sem bug de teclado a corrigir no código.

## 2. Validação de input

- `SliderInput` e o campo exato de `BodyFatBlock.tsx`: filtrar `onChangeText` pra aceitar só dígitos, vírgula e ponto — caracteres inválidos nem entram no campo.
- No commit (blur/submit), se o valor bruto estava fora de `[min, max]`, continua clampando (como já faz) mas agora mostra uma mensagem curta abaixo do campo — "Ajustado para o mínimo (Xkg)." / "...máximo (Xkg)." — que some quando o usuário edita de novo. Mesmo padrão visual do aviso de limite de proteína (Grupo B).

## 3. Destacar a data-alvo

`components/onboarding/blocks/GoalBlock.tsx` — o texto `projectedDateLabel` (hoje `text-sm text-neutral-600` simples) vira um card: fundo `bg-primary-50`, ícone `Calendar` (lucide-react-native), data em `text-primary-600 font-sans-semibold` com `tabular-nums`.

## 4. Checkboxes doença/medicação

`components/onboarding/blocks/HealthBlock.tsx`:
- Nova opção "Nenhuma dessas" (`key: "none"`, não é campo do store — é estado local `noneSelected`).
- Selecionar "Nenhuma dessas" zera as 4 condições no store; marcar qualquer condição desmarca "Nenhuma dessas".
- `nextDisabled = !hasAnySelected && !noneSelected` (hoje sempre `false`, já que o passo é pulável).
- Subtítulo perde a menção a "pode pular".

`lib/onboarding/blocks.ts` — remove `skippable: true` da entrada `health`, o que já tira o link "Pular esse passo" renderizado por `OnboardingChapterShell` (só aparece quando `onSkip` existe).

## Fora de escopo

- Backend/schema — os 4 booleans de `HealthBlock` já existem no store/payload, "Nenhuma dessas" não vira campo novo.
- Outros blocks numéricos fora dos citados (ex. `BasicsBlock`'s `DateInput`) — não usam `SliderInput`, fora de escopo.
