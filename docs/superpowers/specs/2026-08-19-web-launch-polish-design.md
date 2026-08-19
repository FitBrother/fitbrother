# Web launch prep: UI polish + screenshot set — Design

## Contexto

Lançar o Fitbrother pra web primeiro (App Store/Play Store travados por ora). Antes disso: (1) confirmar que o app roda e é utilizável em web, (2) resolver as inconsistências visuais que sobraram, (3) gerar um conjunto de prints de todas as telas pro usuário levar ao Figma e conduzir um redesign de identidade visual por conta própria depois.

**Achado que muda o escopo original:** o `DESIGN_SYSTEM.md` §0 descreve uma migração de marca (teal→menta/tinta, Plus Jakarta→Space Grotesk/Inter) como "pendente". Na prática ela **já foi aplicada** no commit `a4cea6e` (`feat(mobile): migra app para a marca real`, 2026-06-22) — `tailwind.config.ts` e `lib/colors.ts` já usam os tokens novos. A doc só não foi atualizada depois do merge. Não há, portanto, uma migração de cor/fonte pendente para implementar; "identidade visual mais sólida" se reduz a polimento de consistência.

Escopo confirmado com o usuário: **não** mexer na paleta/tipografia em si (isso fica pro redesign no Figma); só arrumar o que já deveria seguir o padrão documentado e não segue.

## O que será feito

### 1. Rodar em web
`expo start --web` (bundler já configurado como `metro` em `app.json`). Navegar pelas ~30 rotas em `apps/mobile/app/` e registrar o que não funciona em browser — APIs nativas sem shim web (câmera/scanner de código de barras em `scan.tsx`, contacts sync em `friends.tsx`, push notifications, `react-native-view-shot` em `share/[type]/[id].tsx`). Sem tentar portar essas features agora — só documentar como limitação conhecida no relatório final.

### 2. Polimento de consistência
- Corrigir a nota "pendente" do §0 em `DESIGN_SYSTEM.md` — a migração já aconteceu, a doc precisa refletir isso.
- Trocar hex inline por tokens/`lib/colors.ts` nos ~20 arquivos identificados (`Card.tsx`, `Input.tsx`, `DateInput.tsx`, blocos de onboarding, etc.) — a maioria são `color=` de ícones lucide e `placeholderTextColor`, já com o valor correto, só não importado do token.
- Durante a navegação em web, corrigir violações óbvias das regras de ouro do `CLAUDE.md`/`DESIGN_SYSTEM.md` que aparecerem (tabular-nums faltando em número, hit target abaixo de 44×44, `font-bold` em vez de `font-sans-bold`) — sem redesenhar layout ou hierarquia.

### 3. Dados de teste
Sem fixtures de demo no repo (`supabase/seed/` só tem `foods-taco.ts`). Criar uma conta demo via fluxo normal de sign-up e semear ~1 semana de refeições **via chamada direta à API do server** (não digitando pela UI) para popular Home, Histórico e Insights com dados reais em vez de empty states.

### 4. Captura de prints
Navegar tela por tela (autenticado, com dados semeados) usando o browser embutido, capturando cada rota — incluindo 1-2 estados adicionais relevantes (ex: modal de edição, um erro) onde fizer sentido. Salvar os PNGs numa pasta fora do git (é material de referência, não artefato de código), nomeados por rota.

### 5. Entrega
- Pasta com os PNGs de todas as telas alcançáveis em web.
- Relatório curto: o que ficou de fora/quebrado em web (features nativas) + o que foi corrigido no polimento.

## Fora de escopo
- Redesenhar paleta, tipografia ou hierarquia visual — fica para o Figma.
- Portar features nativas (câmera, contacts, share nativo) para web.
- Criar fixtures/seed permanentes no repo — os dados semeados são só para os prints, numa conta demo local.

## Verificação
- `npm run typecheck` e `npm run lint` limpos após os ajustes de hex→token.
- App navega em `http://localhost:8081` (ou porta do Expo web) sem crash nas rotas alcançáveis sem hardware nativo.
- Todos os PNGs entregues correspondem a rotas existentes em `apps/mobile/app/`.
