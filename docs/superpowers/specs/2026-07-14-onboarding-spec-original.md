# ONBOARDING_SPEC.md (original, fornecido pelo dono do produto)

> Documento fonte, recebido em 2026-07-14 e usado como base para o brainstorm da
> Fase 4. Reproduzido aqui sem edição para rastreabilidade — as decisões que
> **de fato** valem para o projeto estão em
> [`2026-07-14-fase-4-onboarding-master-plan-design.md`](2026-07-14-fase-4-onboarding-master-plan-design.md),
> que reconcilia este spec com o código existente e com as escolhas fechadas no
> brainstorm. Em caso de conflito, o master plan vence.

---

Especificação para reformular o onboarding do app (anamnese + geração de metas
nutricionais), **conciliando com o código já existente**.

> Uso: `implemente @ONBOARDING_SPEC.md` no Claude Code.
> Trabalhe em fases. **Não pule a Fase 0.** Pare para aprovação onde indicado.

---

## Contexto do produto

App de nutrição que registra refeições com IA (foto/voz/texto), salva macros e dá
feedback sobre as refeições. O app **já existe e está em produção ou perto disso**.
O objetivo aqui é substituir/aprimorar o onboarding, não reescrever o app.

O diferencial não é contar calorias — é a qualidade do feedback. Portanto os dados
da anamnese existem para **alimentar o contexto do feedback da IA**, não só para
calcular metas.

---

## FASE 0 — Auditoria (NÃO escreva código nesta fase)

Antes de qualquer alteração, mapeie o que já existe e me apresente um relatório:

1. **Stack e arquitetura**: framework, navegação, gerenciamento de estado, backend,
   banco, ORM/SDK, camada de autenticação.
2. **Onboarding atual**: quais telas existem, em que ordem, quais campos são
   coletados, onde o estado é guardado (local? servidor? em qual momento?).
3. **Modelo de dados do usuário**: todos os campos do perfil hoje, tipos, quais são
   nullable, quantos usuários existem (se der para inferir por migrations/schema).
4. **Cálculo de metas hoje**: existe? Onde mora? Qual fórmula? É determinístico ou
   passa por LLM?
5. **Pipeline de feedback da IA**: onde o prompt é montado, o que já é injetado como
   contexto do usuário, qual modelo, streaming ou não.
6. **Telemetria**: existe analytics? Qual ferramenta? Há eventos de funil?
7. **Testes**: existe suíte? Qual runner? Cobertura aproximada da lógica de negócio?

Depois do relatório, aponte explicitamente:

- O que do spec abaixo **já está atendido** (não refazer)
- O que **conflita** com o código atual e como você propõe resolver
- **Riscos de migração** para usuários existentes

## FASE 1 — Plano (aprovação obrigatória)

Escreva um plano de implementação em fases, com arquivos que serão criados/alterados
e ordem de execução. **Pare e espere aprovação antes de codar.**

---

## FASE 2 — Camada de cálculo (funções puras, sem UI, sem I/O)

Crie um módulo isolado e 100% testável. Nada de LLM aqui — isso é matemática
determinística.

### `computeTargets(profile) → Targets`

**TMB — Mifflin-St Jeor:**

```
homens:    TMB = 10*peso_kg + 6.25*altura_cm - 5*idade + 5
mulheres:  TMB = 10*peso_kg + 6.25*altura_cm - 5*idade - 161
```

**GET = TMB × fator de atividade:**

| nível | fator |
|---|---|
| sedentário | 1.2 |
| leve (1-3x/sem) | 1.375 |
| moderado (3-5x/sem) | 1.55 |
| intenso (6-7x/sem) | 1.725 |
| muito intenso | 1.9 |

Se houver integração HealthKit / Health Connect com histórico de ≥7 dias, prefira
derivar o gasto de passos + calorias ativas em vez do fator autodeclarado
(autorrelato é inflacionado de forma sistemática). Guarde qual fonte foi usada em
`Targets.tdeeSource`.

**Ajuste por objetivo:**

- Perda: déficit de 15–25%. Teto de ritmo: **1,0% do peso corporal/semana**.
  Recomendado no default: 0,5–0,75%.
- Ganho: superávit de 10–15%. Ritmo 0,25–0,5% do peso/semana.
- Manutenção: GET.

Converta ritmo↔déficit por `7700 kcal ≈ 1 kg`.

**Clamps (aplicar nesta ordem, sempre registrando warning):**

1. Ritmo pedido > teto → clampe ao teto, warning `rate_clamped`
2. Déficit resultante > 25% → clampe a 25%, warning `deficit_clamped`
3. kcal alvo < TMB → clampe à TMB, warning `below_bmr`
4. Piso absoluto: 1200 kcal (F) / 1500 kcal (M) → warning `hard_floor`

**Macros:**

- **Proteína**: 1,6–2,2 g/kg. Use 2,0–2,2 em déficit com treino de força; 1,6–1,8
  caso contrário. **Se IMC > 30, calcule sobre o peso-alvo, não o peso atual** —
  senão você prescreve 200 g de proteína para alguém que não consegue comer isso.
- **Gordura**: alvo 25% das kcal, com **piso absoluto de 0,6 g/kg** (função
  hormonal). O piso vence o percentual.
- **Carboidrato**: o restante. Se cair abaixo de 100 g/dia → warning `low_carb`.
  Abaixo de 50 g → warning `very_low_carb`.
- **Fibra**: 14 g por 1000 kcal, teto de 40 g.

**Retorno:**

```ts
type Targets = {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  bmr: number
  tdee: number
  tdeeSource: 'declared' | 'wearable' | 'adaptive'
  projectedRateKgPerWeek: number
  projectedGoalDate: string | null
  warnings: Warning[]
  blocked: boolean
  blockReason: string | null
}
```

### `evaluateSafetyGates(profile) → GateResult[]`

Função pura separada, com severidade `BLOCK | SOFT_MODE | REFER | WARN`.
`computeTargets` **deve** consultá-la e respeitar `BLOCK`.

| condição | severidade | comportamento |
|---|---|---|
| idade < 18 | BLOCK (perda de peso) | fluxo alternativo, sem déficit |
| gestante ou lactante | BLOCK (déficit) + REFER | manutenção + encaminhamento |
| IMC atual < 18,5 | BLOCK (perda) | oferecer manutenção/ganho |
| peso-alvo implica IMC < 18,5 | BLOCK | forçar mínimo = IMC 18,5 |
| triagem de TCA positiva | SOFT_MODE | ver abaixo |
| doença renal | REFER + cap proteína 0,8 g/kg | avisar contraindicação |
| diabetes tipo 1 | REFER | não ajustar terapeuticamente |
| uso de GLP-1 | WARN | proteína no topo da faixa, ramo de apetite baixo |

**Nunca** contorne um `BLOCK` por conta de input do usuário. Isso é regra de
arquitetura, não validação de formulário.

### `SOFT_MODE` — especificação

Quando ativo, em **todo o app** (não só no onboarding):

- Não exibir números de caloria em nenhuma tela
- Não exibir déficit, projeção de peso, nem countdown de meta
- Sem streaks nem pressão de aderência
- Feedback foca em regularidade, variedade e presença de grupos alimentares
- Oferecer, uma vez e sem insistência, orientação para buscar profissional
  (nutricionista/psiquiatra). No Brasil, CVV 188 para suporte emocional.
- Persistir como flag no perfil, reversível só pelo usuário nas configurações

### Triagem de TCA

3 perguntas, tom neutro, **sem** enquadramento de diagnóstico, com opção de pular.
Escreva perguntas próprias sobre: perda de controle ao comer, preocupação com peso
interferindo no dia, e uso de compensação (restrição severa/exercício punitivo).
Trate como **sinal fraco** que ativa modo suave — não como diagnóstico. Não
reproduza instrumentos clínicos protegidos; se a equipe quiser um validado, isso
passa por revisão profissional.

---

## FASE 3 — Máquina de estados do onboarding

Modele o fluxo como máquina de estados declarativa (config em array/objeto), não
navegação hardcoded tela a tela. Requisitos:

- **Persistência a cada passo** no servidor (`onboarding_progress`), não só local
- **Retomada**: usuário que abandona volta exatamente onde parou
- **Ramificação**: gates e respostas alteram os próximos passos
- **Feature flag** para rodar A/B contra o onboarding antigo
- Uma pergunta por tela, barra de progresso, voltar sempre disponível

### Blocos

```
0. Gancho            3 telas, zero input. Proposta de valor + como funciona.
1. Dados             sexo biológico, idade, altura, peso atual
2. Objetivo          perder/manter/ganhar → peso-alvo → slider de ritmo
                     (mostrar data projetada em tempo real conforme arrasta)
3. Rotina            atividade, treinos/semana e tipo, horários de refeição,
                     quem cozinha, frequência de comer fora
4. Barreiras         "o que te impediu antes?" (múltipla escolha)
                     NÃO entra no cálculo. Entra no tom do feedback.
5. Alimentação       restrições, alergias, alimentos que odeia, orçamento
6. Saúde             condições, medicamentos, gravidez/amamentação, triagem TCA
7. Permissões        notificações + HealthKit AQUI, nunca na primeira tela
8. Cálculo           loading 3-5s com revelação progressiva
9. Revelação         tela de payoff com as metas
10. Paywall          (usar o existente, não mexer)
11. Primeira vitória registro guiado da primeira refeição
```

**Progressive profiling**: o caminho crítico até a Fase 11 deve ser curto. Perguntas
não essenciais (blocos 3, 5 parcialmente) podem virar uma "anamnese completa"
destravável depois, apresentada como *melhoria do feedback da IA*, não como
formulário pendente. Se o código atual já tiver um onboarding curto, prefira essa
rota a alongá-lo.

---

## FASE 4 — Migração de usuários existentes

Ponto crítico. Usuários que já existem **não podem** ser forçados a refazer
onboarding.

1. Migration que adiciona os novos campos como nullable
2. Backfill do que for derivável do que já existe
3. Rodar `evaluateSafetyGates` nos perfis existentes; se algum retornar `BLOCK` ou
   `SOFT_MODE`, aplicar (isso é correção de segurança, não feature)
4. Campos faltantes são coletados **incrementalmente e em contexto**, um por vez, em
   momentos naturais de uso — nunca num modal bloqueante no login
5. Metas existentes não mudam silenciosamente. Se o recálculo alterar as metas,
   mostrar comparação e pedir confirmação.

---

## FASE 5 — Contexto do feedback da IA

Crie `buildCoachContext(profile) → CoachContext`: objeto **compacto** (é token em
cada request) injetado no prompt de feedback de refeição.

```json
{
  "objetivo": "perder_peso",
  "metas": { "kcal": 1850, "prot": 140, "carb": 180, "gord": 55 },
  "restricoes": ["sem_lactose"],
  "odeia": ["peixe"],
  "barreira_principal": "fim_de_semana",
  "come_fora": "4x_semana",
  "treino": "musculacao_4x",
  "modo_suave": false,
  "consumido_hoje": { "kcal": 1200, "prot": 95, "carb": 110, "gord": 40 }
}
```

Derive **regras de tom** da barreira principal e injete como instrução:

- `falta_de_tempo` → sugestões executáveis em <10 min
- `fim_de_semana` → antecipar, dar folga planejada, não punir retroativamente
- `ansiedade` → nunca moralizar comida; sem "bom/ruim"
- `desisto_rapido` → reforçar consistência acima de precisão
- `nao_sei_o_que_comer` → sempre terminar com uma sugestão concreta

Meta de qualidade: o feedback deve sair de *"você excedeu 300 kcal"* para *"boa
proteína no almoço — como sexta é seu ponto fraco, mantendo esse padrão você chega
no fim de semana com folga"*.

Se `modo_suave` estiver ativo, `metas` e `consumido_hoje` **não** vão para o prompt.

---

## FASE 6 — Linguagem e conformidade (Brasil)

No Brasil a prescrição de plano alimentar é atividade privativa de
nutricionista/médico. Isso **não é aconselhamento jurídico** e precisa de revisão de
advogado, mas implemente as salvaguardas de linguagem:

- Centralize toda a copy de metas num único arquivo de constantes
- Use: "metas estimadas", "estimativa", "ferramenta de acompanhamento"
- **Nunca** use: "prescrição", "sua dieta", "plano alimentar prescrito", "recomendação
  médica"
- Componente de disclaimer visível na tela de revelação e na tela de metas
- Nenhum ajuste terapêutico para condição de saúde — sempre `REFER`
- Adicione um teste de lint/CI que falhe se termos da blocklist aparecerem na copy

---

## FASE 7 — Telemetria

Eventos por tela: `onboarding_step_viewed`, `_completed`, `_skipped`, `_back`, com
`step_id` e `variant` (flag do A/B). Além disso:

- `onboarding_abandoned` com último `step_id`
- `targets_computed` com warnings e gates disparados (sem PII de saúde)
- `time_to_first_meal_logged`
- Retenção D1/D7 segmentável por respostas do onboarding

---

## Testes obrigatórios

Unitários na camada de cálculo, incluindo estes casos exatos:

**Caso 1 — clamp de ritmo + piso de gordura interagindo**
Mulher, 32 anos, 165 cm, 78 kg, atividade leve (1.375), quer perder 0,5 kg/semana.
Esperado: TMB ≈ 1490, GET ≈ 2049. O déficit pedido (550 kcal) daria 26,8% → clampa
em 25% → **kcal ≈ 1537**, warning `deficit_clamped`. Proteína 1,8 g/kg = **140 g**.
Gordura: 25% daria 42,7 g, mas piso 0,6×78 = **47 g** → piso vence. Carbo ≈ **139 g**.
Fibra ≈ **22 g**. Ritmo projetado ≈ 0,47 kg/sem.

**Caso 2 — BLOCK por IMC**
Homem, 25 anos, 180 cm, 60 kg (IMC 18,5), quer perder peso →
`blocked: true`, sem `Targets` de déficit, oferece manutenção/ganho.

**Caso 3 — BLOCK por peso-alvo**
Peso-alvo que resulte em IMC 17 → `blocked`, com sugestão do mínimo em IMC 18,5.

**Caso 4 — IMC > 30 usa peso-alvo para proteína**
Verificar que a proteína não é calculada sobre o peso atual.

**Caso 5 — SOFT_MODE**
Triagem positiva → nenhuma kcal em nenhum retorno de API/render, e
`buildCoachContext` omite metas.

Adicione ainda um teste de integração da máquina de estados: abandonar no bloco 5 e
retomar deve cair exatamente no bloco 5 com respostas anteriores preservadas.

---

## Regras invioláveis

1. **Não reescreva telas existentes que já funcionam.** Adapte e reaproveite.
2. **Não quebre usuários existentes.** Migração antes de feature.
3. Cálculo é função pura e determinística. **LLM não calcula metas.**
4. Gates de segurança são arquitetura, não validação de form.
5. Toda alteração de schema vem com migration reversível.
6. Commits pequenos e por fase, cada um com os testes da fase passando.
7. Em caso de ambiguidade entre este spec e o código existente: **pergunte**, não
   assuma.
