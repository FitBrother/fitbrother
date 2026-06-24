# Fase 3 — Polish & Expansão (M10–M13) — Design

> Data: 2026-06-23. Status: aprovado (brainstorming). Master plan da fase; cada milestone ganha seu próprio spec datado em `specs/` antes de implementar, como nas Fases 1 e 2.

## Contexto

Fases 1 (M0–M6) e 2 (M7–M9) entregaram o app de nutrição com IA e a camada social. O app roda em Stack puro (sem tab bar), com captura por texto/áudio/foto, feed, conquistas, insights e share cards.

A Fase 3 prepara o app para **usuário real** (perfil/menus/LGPD na UI) e **expande a captura** (código de barras), além de uma passada de **polish de UI/UX**. Surgiu de 5 pedidos do dono; após auditoria de código, 1 deles já existia (foto) e virou correção de bug, e 1 (menus) se sobrepunha ao M6.

## Achados da auditoria (estado atual)

- **Registro por foto** — JÁ EXISTE e é funcional: `POST /meals/photo` (Gemini vision), `useCreateMealPhoto`, `uploadMealPhoto` (bucket `meal-photos`), botão no `MealComposer`. Não é feature nova. O dono reporta **falha no fluxo** → vira tarefa de correção de bug (não milestone).
- **Onboarding** — 9 steps razoáveis (`app/(onboarding)/`): nome, sexo/nascimento, medidas, metas, termos (step-8), username/avatar (step-9). Sem step de WhatsApp.
- **Perfil/menus** — `app/(app)/profile.tsx` é **placeholder** ("Perfil completo chega no próximo update"). Existem telas funcionais de achievements/feed/friends/insights/history. **Não existe**: settings, export/delete LGPD na UI, timezone, day_start_hour, tela Sobre. Esses itens estavam no escopo mobile do **M6**.
- **Barcode** — NÃO EXISTE (zero menção a expo-camera barcode / OpenFoodFacts).
- **Navegação** — Stack puro; a "tab bar nova (Hoje·Feed·Amigos·Perfil)" prevista no M7 nunca foi implementada. Composer fixo no rodapé já existe.
- **Design system** — `DESIGN_SYSTEM.md` existe; migração de marca (menta/tinta + Space Grotesk/Inter) feita em commit recente — podem restar pontas.

## Decisões transversais

1. **4 milestones novos** (M10–M13) numa Fase 3; cada card de milestone mantém um M correspondente no PLAN.
2. **Bug da foto** entra como item no card "Pendências transversais" (não é milestone); quando pego, usar debugging sistemático para achar a causa antes de corrigir.
3. **M6 perde os 2 itens mobile** (`profile.tsx` settings e tela Sobre) — migram para o M10. M6 vira backend LGPD + observabilidade + deploy/ops puro.
4. Numeração de migrations continua do ponto mais alto vigente quando cada milestone começar (não fixar agora).

## Milestones

### M10 — Perfil completo + menus internos (🤖 Claude)

**Meta:** `profile.tsx` real e todos os menus internos prontos, incluindo a UI de LGPD ligada ao backend do M6.

**Escopo:**
- `app/(app)/profile.tsx` completo (dados do usuário, avatar, atalhos para menus).
- Settings: alterar `timezone`, `day_start_hour`, consentimento granular (liga em `POST /account/consent`).
- UI de **exportar dados** (`GET /account/export`) e **deletar conta** (`DELETE /account`) — depende do backend do M6 estar pronto (ou stub atrás de flag).
- Tela **Sobre** (versão via `Constants.expoConfig.version` + links Termos/Privacidade).
- Organização/navegação dos menus internos existentes (achievements, friends, insights, history) a partir do perfil.

**Feito quando:** usuário abre Perfil real, edita timezone/day_start_hour, gerencia consentimento, dispara export e delete pela UI, e acessa Sobre.

**Dependência:** backend LGPD do M6 (export/delete/consent). Se M6 ainda não feito, M10 entrega a UI contra os endpoints definidos no M6.

### M11 — Aprimorar onboarding (🤖 Claude)

**Meta:** aumentar conclusão do onboarding e refinar a percepção, sem reestruturar o fluxo de 9 steps.

**Escopo:**
- **Reduzir fricção:** defaults inteligentes, tornar opcional o que não é essencial (ex.: avatar/username adiáveis para depois), permitir completar mais tarde no Perfil, reduzir taps.
- **Polish visual + copy:** revisar textos, microcopy, ilustrações/ícones, micro-animações e transições entre steps.

**Feito quando:** onboarding completável com menos atrito (medir nº de campos obrigatórios reduzido), copy revisada, sem regressão de dados coletados (profiles/anthropometrics/goals/consents intactos).

### M12 — Registro por código de barras (🤝 Híbrido)

**Meta:** registrar alimento escaneando o código de barras da embalagem.

**Escopo:**
- Scanner via `expo-camera` (barcode) numa entrada do `MealComposer` (junto de texto/áudio/foto).
- Lookup em **OpenFoodFacts** (API pública, grátis, sem key) por EAN/UPC → nome + macros por 100g/porção.
- Mapear resultado para item de refeição (reusar o caminho de `meal_items`/macros); permitir ajustar quantidade antes de salvar.
- Fallback manual quando o produto não é encontrado.
- **Parte humana:** novo dev build EAS (módulo nativo de câmera) + teste em device.

**Feito quando:** escanear código de produto conhecido → item com macros aparece pré-preenchido e editável → salva como refeição; produto desconhecido → fallback manual claro.

**Risco:** cobertura/qualidade do OpenFoodFacts varia por região; tratar ausência de macros graciosamente.

### M13 — Aprimorar UI/UX (🤝 Híbrido)

**Meta:** elevar a consistência e a navegação do app inteiro.

**Escopo:**
- **Nova tab bar** Hoje·Feed·Amigos·Perfil (substitui Stack puro + ícones no header); preservar o composer fixo da Home.
- **Finalizar migração de marca:** garantir menta/tinta + Space Grotesk/Inter em todas as telas; caçar resíduos de teal/Plus Jakarta.
- **Passada de polish geral:** estados vazios/loading/erro, espaçamento, hierarquia tipográfica, animações, acessibilidade (hit targets, labels).
- **Auditoria** própria de UI/UX gera a lista priorizada de ajustes (no spec do milestone).

**Parte humana:** validação visual em device + decisões de gosto/direção.

**Feito quando:** navegação por tab bar funcionando; nenhuma tela com marca antiga; checklist de polish auditado e aplicado.

## Ajustes em cards/PLAN existentes

- **M6 (PLAN + Trello):** remover os 2 itens mobile do checklist/seção; anotar que a UI de menus/LGPD vive no M10.
- **Pendências transversais (Trello):** adicionar "🐛 Corrigir falha no fluxo de registro por foto (debugging sistemático)".

## Prioridade sugerida (backlog)

M10 (perfil/LGPD são pré-lançamento) → M13 (UX) → M11 (onboarding) → M12 (barcode, feature nova). Todos entram em Backlog; o dono prioriza.

## Fora de escopo

- Reescrever o fluxo de onboarding do zero.
- Render server-side de share cards (já marcado v2 no M9).
- Novas fontes de dados além de OpenFoodFacts para barcode.
