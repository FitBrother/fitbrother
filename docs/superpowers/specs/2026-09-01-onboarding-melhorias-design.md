# Melhorias no onboarding — Enter, stepper e folga nos limites

**Data:** 2026-09-01
**Status:** aprovado, pronto pra plano de implementação

## Contexto

O app está em produção na web. Três atritos observados no onboarding:

1. Não dá pra avançar com Enter — obriga o mouse a cada etapa, em 17 blocos.
2. O campo numérico acima dos sliders (altura, peso, peso-alvo, ritmo) é um
   `TextInput` pequeno e genérico, destoante da identidade visual.
3. Os limites de peso-alvo e de ritmo estão apertados demais.

Nada disso muda schema, migration ou contrato de API. É trabalho de cliente
(`apps/mobile`) mais três constantes e uma função nova em `packages/shared`.

## Escopo

Dentro:

- Navegação por Enter no `OnboardingChapterShell`.
- Redesign do `SliderInput` como stepper.
- Afrouxamento dos limites de peso-alvo e de ritmo, mantendo as fórmulas.

Fora:

- Qualquer mudança nos gates de segurança (`gates.ts`).
- Redesign das telas de onboarding além do componente de slider.
- Navegação por teclado além do Enter (setas, Tab explícito).

---

## 1. Enter para continuar

### Desenho

Um hook `useEnterToContinue`, chamado de dentro do `OnboardingChapterShell`.
O shell já é dono de `onNext` e `nextDisabled`, então um único ponto de
integração cobre os 17 blocos sem tocar em nenhum deles.

Arquivo novo: `apps/mobile/lib/onboarding/useEnterToContinue.ts`

```ts
useEnterToContinue({ onNext, disabled, enabled });
```

Comportamento:

- Só onde existe DOM (`typeof document === "undefined"` → retorna sem
  registrar nada). É a checagem honesta: o que o hook precisa é de DOM, não de
  uma plataforma específica — e é testável, já que o ambiente de teste do app
  não tem `document`.
- Listener de `keydown` no `window`, registrado uma vez, **na fase de
  captura**. `onNext` e `disabled` entram por `useRef` atualizado a cada
  render, pra não re-registrar o listener a cada tecla digitada.
- Dispara em `Enter` sem `shiftKey`/`metaKey`/`ctrlKey`/`altKey`.
- Sequência ao disparar: `preventDefault()` → `document.activeElement.blur()` →
  `onNext()`, tudo síncrono.

O `blur()` antes do avanço existe porque o campo numérico do `SliderInput`
faz o commit (parse + clamp) no `onBlur`. Sem ele, digitar `185` e apertar
Enter avançaria com o valor antigo ainda no store.

Dois detalhes que só apareceram rodando no navegador — o desenho original
errava nos dois:

- **Captura, não bolha.** O `TextInput` do React Native Web chama
  `stopPropagation` no Enter pra implementar `onSubmitEditing`. Um listener de
  bolha no `window` nunca vê a tecla vinda de um campo — que é justamente o
  caso principal. Ver o evento primeiro não atropela ninguém: a exclusão por
  seletor continua devolvendo o Enter pros elementos que o tratam sozinhos, e
  `preventDefault` não impede o handler do próprio campo.
- **Síncrono, sem `requestAnimationFrame`.** A ideia original era esperar um
  frame pro React reconciliar o commit antes de reler `disabled`. Mas em aba
  de segundo plano o rAF fica suspenso e o Enter nunca avançava. A espera era
  desnecessária: `blur()` despacha o evento na hora, o commit escreve no store
  do zustand na hora, e `onNext` lê via `getState()` — nada no caminho depende
  de reconciliação. E nenhum bloco tem `nextDisabled` dependente de um valor
  de slider, então ler o ref pré-blur está correto.

### Exclusões

O handler ignora o evento quando o alvo casa com:

```
[role="button"], [role="link"], [role="checkbox"], a, button, textarea
```

Motivos concretos:

- `Pressable` do React Native Web vira `<div role="button" tabindex="0">`, e o
  próprio RNW já dispara `onPress` no Enter. Sem a exclusão, Enter com foco no
  botão "Voltar" voltaria **e** avançaria.
- O `MealComposer` do `FirstMealBlock` usa `TextInput` multiline, que vira
  `<textarea>`. Enter ali é quebra de linha.
- `[role="checkbox"]` fica de fora porque alternar **não** é idempotente: no
  `ConsentBlock`, Enter com foco num checkbox desmarcaria o consentimento e
  avançaria com ele desmarcado.

`[role="radio"]` **não** entra na lista, de propósito. Três dos oito blocos de
dados são radiogroups (gordura corporal, atividade, objetivo): o usuário clica
na opção e o foco fica no radio. Excluí-lo mataria o Enter em quase metade do
fluxo — o oposto do que a feature promete. Re-disparar a seleção de um radio
já selecionado é idempotente, então os dois handlers podem rodar juntos.

Essa distinção só apareceu percorrendo o onboarding inteiro no navegador; a
primeira versão excluía radio junto com checkbox e quebrava esses três blocos
em silêncio.

### Blocos que optam por fora

`OnboardingChapterShell` ganha a prop `enterToContinue?: boolean` (default
`true`). Só o `SignupBlock` passa `false`.

Justificativa: o `SignupBlock` já implementa o encadeamento correto de
formulário — `returnKeyType="next"` no e-mail e na senha focando o próximo
campo, `returnKeyType="go"` no confirmar chamando `handleSubmit`. Um handler
global de "Enter submete de qualquer campo" substituiria esse comportamento
por um pior.

`CalculatingBlock`, `RevealBlock`, `SubmittingBlock` e `FirstMealBlock` não
passam `onNext` ou usam `showNav={false}` — o hook não faz nada neles sem
precisar de configuração.

O `ConsentBlock` **mantém** o Enter: `nextDisabled` só libera depois que os
quatro consentimentos foram marcados um a um. Enter ali é equivalente a
clicar em "Continuar", que já é uma ação deliberada.

---

## 2. `SliderInput` como stepper

### Desenho

O `TextInput` solto no canto superior direito vira um controle segmentado
`−  [170 cm]  +` na mesma posição.

`apps/mobile/components/SliderInput.tsx`, sem mudança de API pública. Os
quatro pontos de consumo (`HeightBlock`, `WeightBlock`, `GoalBlock` ×2)
continuam passando as mesmas props — `HeightBlock` e `WeightBlock` não são
tocados. O `GoalBlock` muda, mas por causa da seção 3 (limites novos e
`step` do ritmo), não por causa deste redesign.

Anatomia:

- Botão `−` e botão `+`: `44×44` (regra 4 do CLAUDE.md), `border-neutral-200`,
  `bg-white`, `active:bg-neutral-50`, `rounded-l-full` / `rounded-r-full` nas
  pontas externas. Ícones `Minus` e `Plus` do `lucide-react-native`, size 16,
  `colors.neutral[600]`.
- Centro: `TextInput` editável, `h-11`, bordas superior e inferior
  `neutral-200`, `bg-white`, largura explícita de `56px`. Número em
  `font-sans-semibold`, `text-neutral-800`,
  `style={{ fontVariant: ["tabular-nums"] }}`. Unidade logo depois em
  `text-sm font-sans text-neutral-500`, dentro do campo.
  A largura explícita não é escolha estética: na web o `TextInput` vira
  `<input>`, que assume a largura intrínseca padrão do navegador (~253px),
  estoura a linha e espreme o label. Descoberto rodando a app.
- Passo dos botões = a prop `step`. Resultado clampado em `[min, max]`.
- `Haptics.selectionAsync()` no toque, mesmo padrão do `GoalBlock`.
- No limite: botão fica `opacity-40` e sem `onPress`, com
  `accessibilityState={{ disabled: true }}`.
- `accessibilityLabel` derivado do `label`: `"Diminuir altura"` /
  `"Aumentar altura"`.
- `accessibilityRole="button"` nos dois.

Preservados sem alteração: o commit no `onBlur`, o `sanitizeNumericText`, a
mensagem de clamp, o `markerValue` na track e o `Slider` em si.

### Alinhamento do máximo com a grade de passos

O `Slider` do `@react-native-community/slider` snapa em `min + n * step`.
Com os limites calculados da seção 3, `max` raramente cai na grade — o
usuário arrasta até o fim e para antes do máximo real.

`SliderInput` passa a alinhar internamente o teto pra grade:

```ts
const gridMax = min + Math.floor((max - min) / step) * step;
```

`gridMax` alimenta o `Slider` e o botão `+`. O campo de texto continua
aceitando e commitando o `max` exato — quem quiser o valor de ponta digita.

### Granularidade do ritmo

O slider de ritmo passa de `step={0.1}` pra `step={0.05}`. Com a faixa nova
(seção 3) indo de 0,1 a ~0,55–0,75, o passo de 0,1 daria poucas posições
úteis. `decimalsFor(0.05)` já devolve 2 casas, sem mudança.

---

## 3. Limites de peso-alvo e de ritmo

### Achado que motiva o desenho

O slider de ritmo é fixo em `0.1–1.0 kg/semana` pra todo mundo. O limite real
aplicado em `computeTargets` é outro, e é **duplo**: um teto de percentual do
peso (`RATE_CAP_PCT`) e um teto de déficit sobre o TDEE (`DEFICIT_CAP_PCT`).

Simulando casos reais, o teto de déficit é o que trava em praticamente todo
caso de "perder" — o teto de percentual do peso nunca chega a valer:

| caso | cap %/sem | cap déficit | efetivo |
|---|---|---|---|
| 60kg F 165cm 30a moderado | 0,60 | **0,47** | 0,47 |
| 80kg M 180cm 30a moderado | 0,80 | **0,63** | 0,63 |
| 110kg M 180cm 40a sedentário | 1,10 | **0,55** | 0,55 |
| 70kg M 178cm 25a ativo, ganhar | **0,35** | 0,40 | 0,35 |

Duas consequências:

1. O slider sempre permite escolher acima do efetivo. O usuário arrasta pra
   1.0, o backend clampa em silêncio e emite um `warning` que a UI não mostra.
2. Afrouxar só o `RATE_CAP_PCT` não daria folga nenhuma em "perder".

### Peso-alvo

Em `packages/shared/src/targets/formulas.ts`:

- `MIN_HEALTHY_BODY_FAT_PCT`: `{ male: 10, female: 17, other: 13 }` →
  `{ male: 8, female: 14, other: 11 }`
- `MAX_BMI_FOR_TARGET_WEIGHT`: `30` → `33`

Em `computeTargetWeightBounds`, um piso novo no caminho de "perder". Hoje o
mínimo termina em `Math.max(min, 1)` — literalmente 1kg. Um usuário magro
consegue escolher um alvo que o gate `target_weight_underweight` (IMC ≤ 18,5)
vai **bloquear** depois, no `RevealBlock`, depois de já ter passado pela tela.
Afrouxar o %BF mínimo sem corrigir isso aumentaria a frequência do problema.

Piso novo:

```ts
const minByBmi = 18.6 * heightM * heightM;
const min = Math.max(minByLeanMass, minByBmi);
```

18,6 e não 18,5 porque o gate compara com `bmiRounded1`, que arredonda pra uma
casa: um alvo em IMC 18,54 arredonda pra 18,5 e bloqueia. Com o piso em 18,6
o slider nunca produz um valor que o próprio sistema recusa.

**Arredondamento pra dentro.** `round1` (`Math.round`) pode empurrar um limite
pra fora do intervalo real por até 0,05kg, o que reaparece como um clamp logo
depois. Os limites calculados passam a arredondar pra dentro: `Math.ceil` nos
pisos, `Math.floor` nos tetos.

Efeito, 1,75m: teto de "ganhar" vai de 91,9kg pra 101,1kg. 80kg masculino a
20% de gordura: piso de "perder" vai de 71,1kg pra 69,6kg.

### Ritmo

Função nova em `formulas.ts`, exportada pelo índice de `targets`:

```ts
export function computeRateBounds(input: {
  goal: "lose" | "gain";
  sex: Sex;
  age_years: number;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
}): { min: number; max: number };
```

`max = min(capPorPeso, ritmoEquivalenteAoCapDeDéficit)`, arredondado pra baixo
em 2 casas. `min = 0.1`, com `max` garantido `>= min`.

`RATE_CAP_PCT` e `DEFICIT_CAP_PCT` saem de `compute-targets.ts` (onde são
privados) pra `formulas.ts`, exportados, e `compute-targets.ts` passa a
importá-los. Fonte única — o slider e o cálculo não podem divergir.

Constantes afrouxadas:

- `RATE_CAP_PCT`: `{ lose: 1.0, gain: 0.5 }` → `{ lose: 1.25, gain: 0.75 }`
- `DEFICIT_CAP_PCT`: `{ lose: 25, gain: 15 }` → `{ lose: 30, gain: 20 }`

Subir o cap de déficit de 25% pra 30% do TDEE é o que efetivamente destrava a
folga em "perder" — decisão de produto tomada com a ressalva de que os pisos
clínicos por baixo continuam ativos.

Efeito:

| caso | efetivo hoje | proposto | delta |
|---|---|---|---|
| 60kg F, moderado, perder | 0,47 | 0,56 | +19% |
| 80kg M, moderado, perder | 0,63 | 0,75 | +19% |
| 110kg M, sedentário, perder | 0,55 | 0,66 | +20% |
| 70kg M, ativo, ganhar | 0,35 | 0,53 | +51% |

### Consumo no `GoalBlock`

`GoalBlock` já reúne `sex`, `height_cm`, `activity_level` e `body_fat_pct` pro
cálculo da data projetada. Passa a chamar `computeRateBounds` com os mesmos
dados e alimentar `min`/`max` do slider de ritmo.

Quando algum desses campos ainda estiver indefinido (o bloco renderiza antes
do preenchimento completo em algum caminho de retomada), cai no intervalo
fixo atual `0.1–1.0` — mesmo comportamento de hoje, sem crash.

O `selectedRate` derivado precisa ser clampado nos novos limites, e o
`useEffect` que já existe pro `target_weight_kg` ganha um irmão pro
`rate_kg_per_week`: trocar de objetivo muda o teto, e um valor salvo fora da
faixa nova seria submetido intacto se o usuário não tocasse no slider.

### O que não muda

Os pisos que são de fato clínicos ficam como estão:

- TMB como chão de kcal (`below_bmr`).
- Piso absoluto: 1200 kcal feminino, 1500 masculino, 1350 outro
  (`hard_floor`).
- Gate de IMC ≤ 18,5 no peso-alvo (`target_weight_underweight`).
- Gates de idade < 18, gestação/lactação, doença renal, diabetes tipo 1,
  GLP-1.

`gates.ts` não é tocado.

---

## Testes

`packages/shared` (vitest):

- `computeRateBounds` — invariante central: pra uma grade de perfis
  (sexo × atividade × peso × objetivo), `computeTargets` chamado com
  `rate_kg_per_week = bounds.max` **não** emite `rate_clamped` nem
  `deficit_clamped`. É o teste que garante que o slider parou de mentir.
- `computeRateBounds` — `max >= min` mesmo em perfis extremos (peso baixo,
  sedentário).
- `computeTargetWeightBounds` — pra a mesma grade, `evaluateSafetyGates` com
  `target_weight_kg = bounds.min` não devolve `target_weight_underweight`.
- Atualizar as asserções existentes em `formulas.test.ts` e
  `compute-targets.test.ts` que fixam 25%, 1,0%/sem e IMC 30.

`apps/mobile` (jest):

- `SliderInput.test.tsx` — `+`/`−` movem por `step`; ficam desabilitados em
  `min`/`max`; o campo de texto continua commitando no blur; `gridMax` não
  ultrapassa `max`.
- `useEnterToContinue.test.ts` — Enter chama `onNext`; não chama quando
  `disabled`; não chama quando o alvo é `role="button"` ou `<textarea>`; não
  chama com modificador; não registra listener fora da web.

## Verificação manual

Antes de considerar pronto, no dev server web:

1. Percorrer o onboarding inteiro só com o teclado até o `SignupBlock`.
2. No `SignupBlock`, confirmar que Enter ainda encadeia e-mail → senha →
   confirmar → submit.
3. No `HeightBlock`, digitar `185`, apertar Enter, e confirmar que a etapa
   seguinte recebeu 185 (não 170).
4. No `GoalBlock` com "perder", arrastar o ritmo até o máximo e confirmar no
   `RevealBlock` que nenhum warning de clamp aparece e que a data projetada
   bate com o ritmo escolhido.
