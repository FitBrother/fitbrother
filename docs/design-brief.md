# Briefing — Fitbrother: novo design system + landing page

## 1. Sobre o produto

**Fitbrother** é um app de nutrição com IA. O usuário registra refeições em **linguagem natural** — texto ou áudio — direto no app **ou via WhatsApp**. A IA transcreve, identifica os alimentos, calcula macros (kcal, proteína, carboidrato, gordura) e sincroniza tudo em tempo real entre os canais. O engajamento é sustentado por **gamificação estilo Duolingo**: streaks de ofensiva, conquistas, amigos e ranking semanal.

**Diferenciais que precisam transparecer no design:**
- Input multi-modal (voz + texto, no app e fora dele).
- Realtime: o que entra pelo WhatsApp aparece no app na hora.
- Camada social leve, sem pressão de "fitness hardcore".

**O que NÃO é:** não é um app de fitness com macros para atletas. Não é um app de dieta restritiva. Não é frio/clínico nem agressivamente "wellness". Pense em algo entre **Duolingo + Notion Calendar + um aplicativo financeiro moderno (Nubank, Mercury)**: lúdico mas sério, números claros, sem infantilizar.

## 2. Público e personalidade

**Persona:** 25–40 anos, classe média urbana brasileira, já tentou MyFitnessPal e desistiu pelo atrito de busca por alimento. Quer entender o que come sem virar refém de planilha.

**Atributos de marca (escolher 4-5 como norte):**
- Acolhedor (não julga "comi pizza")
- Inteligente (a IA é parceira, não professora)
- Brasileiro (sem ser brega — pense Quero Quero, não Casas Bahia)
- Honesto com números (tipografia tabular, valores precisos)
- Brincalhão na gamificação, sóbrio nos dados

**Tom de voz:** segunda pessoa informal ("Bora registrar o almoço?"), frases curtas, zero jargão nutricional sem tradução.

## 3. Restrições técnicas (mobile)

- **Stack:** React Native + Expo + NativeWind v4 (Tailwind v3 sob o capô).
- Cada token de cor/tipo/espaço precisa ter equivalente em Tailwind config.
- **Tipografia em RN:** preciso de famílias separadas por peso (não dá só `font-weight: 600` — tem que carregar a fonte certa). Se sugerir uma fonte, garanta que tem variantes 400/500/600/700/800 disponíveis no Google Fonts ou via `@expo-google-fonts`.
- **Sem dark mode no MVP.**
- **Ícones:** assumir `lucide-react-native` (ou propor alternativa equivalente em qualidade/cobertura).
- **Hit target mínimo 44×44 pt** em qualquer Pressable.
- **Números nutricionais sempre tabulares** (`fontVariant: ["tabular-nums"]`).

## 4. O que entregar

### A) Design System

1. **Filosofia visual** — 2-3 parágrafos descrevendo a direção (mood, referências, decisões fundadoras). Ex.: "geométrico mas com cantos arredondados generosos; cor de marca quente em vez de teal frio; ilustração custom em vez de stock photos".

2. **Paleta de cores completa** com escalas 50–900:
   - Marca primária (e secundária se houver).
   - Neutros (frios ou quentes? justificar).
   - Feedback: success / warning / danger / info.
   - **Cores semânticas de macros:** proteína / carboidrato / gordura — cada uma precisa ser distinguível em gráficos lado a lado, com versões 50/100/500 no mínimo.
   - **Cor de streak/gamificação** (foguinho).
   - Cada cor com HEX, contraste WCAG mínimo testado contra branco e contra preto, e o uso recomendado em uma frase.

3. **Tipografia**:
   - Família escolhida + justificativa.
   - Escala de tamanhos (12 → 48px) com line-height e use case por linha.
   - Pesos disponíveis e quando usar cada um.

4. **Espaçamento e raios** — escala base 4px, mostrando onde cada step é usado. Raios para botão, input, card, sheet, badge.

5. **Elevação** — 3 níveis de sombra, com valores `shadowOpacity/shadowRadius/elevation` prontos para RN.

6. **Motion** — durations (fast/base/slow) e easings, com casos de uso (press, sheet, ring animation, streak pulse).

7. **Componentes base** com mock ASCII ou descrição estruturada:
   Button (variantes primary/dark/outline/ghost + sizes sm/md/lg), Input (default/focused/error), Card (elevated/outlined/flat), Checkbox, Progress Bar linear, Error Banner, Bottom Sheet, Toast, Skeleton, Tab Bar (4 tabs com o "+" central elevado).

8. **Componentes de domínio nutricional** (essenciais — o coração do produto):
   - **Progress Ring** (anel SVG para macros, com versão hero 160px e compact 80px)
   - **Macro Bar** (alternativa horizontal)
   - **Meal Card** (cabeça com ícone+horário+menu, lista de itens, linha de macros)
   - **Streak Counter** (foguinho + número, com estados ativo/em-risco/quebrado)
   - **Audio Recorder Button** (idle/recording/processing — botão central da home)
   - **Chat Bubble** (preview de conversa do WhatsApp dentro do app)
   - **Leaderboard Row** (posição, avatar, nome, streak, dias-com-meta)
   - **Empty State**

Para cada componente: visual (ASCII ou descrição), props, estados, tokens usados.

### B) Landing page (web responsiva)

Marketing page para `fitbrother.com.br`. Stack assumida: **Next.js + Tailwind** (mas o design pode ser entregue como HTML/CSS estático se preferir).

**Seções obrigatórias:**

1. **Hero** — H1 + subhead + CTA principal ("Entrar na lista de espera" ou "Baixar"). Mockup do app à direita ou abaixo. Precisa comunicar "registre falando" em <3 segundos.

2. **Demo do diferencial** — animação ou sequência mostrando: usuário fala no WhatsApp → aparece no app. Pode ser GIF / vídeo loop / animação CSS.

3. **3 pilares** — Multi-modal · Realtime · Social. Card por pilar, ícone + headline + 2 linhas.

4. **Como funciona** — 3 ou 4 passos numerados, com screenshots dos states reais do app.

5. **Gamificação** — seção mostrando streak counter gigante, leaderboard mockado, tom "torne hábito em vez de tarefa".

6. **Prova social** (placeholder) — depoimentos, logos de imprensa se rolar.

7. **FAQ** — accordion com 5-7 perguntas (privacidade, preço, dieta restritiva, etc.).

8. **Footer** — links institucionais, contato, redes sociais.

**Princípios da landing:**
- **Mobile-first** mesmo sendo web (60%+ do tráfego será mobile no Brasil).
- Performance: hero precisa carregar em <1s em 4G; imagens em WebP/AVIF.
- A landing usa **o mesmo design system** do app (mesmas cores, mesma fonte, mesma personalidade) — não inventar visual separado.
- Português do Brasil. Sem "Em breve!" — copy precisa parecer produto pronto.

### C) Mapa de tokens → Tailwind

Entregar (ou descrever) um `tailwind.config.ts` que materializa o design system: cores, fontFamily com variantes nomeadas (`sans`, `sans-medium`, `sans-semibold`, `sans-bold`, `sans-extrabold`), spacing extra, shadows, radius. Esse arquivo é o contrato entre design e código.

## 5. Direções que NÃO quero

- **Teal cyan estilo Cal AI / Lifesum.** Já é o padrão de mercado, fica genérico.
- **Verde "saúde" tipo HealthifyMe.** Cansado.
- **Glassmorphism** ou neumorfismo — datado.
- Ilustrações estilo Notion / Linear (gradients neon brancos em fundo preto) — não combina com o público brasileiro.
- "Apple Health clone" — frio demais.

## 6. Direções a explorar (não obrigatório, mas é o tipo de coisa que me anima)

- **Cor primária quente** (laranja queimado, coral, terracota) — diferenciação no mercado.
- **Tipografia com personalidade no display** (ex: uma serif moderna no H1 contra sans-serif no resto, ou uma grotesque condensada).
- **Sistema de ilustração custom** simples — formas geométricas, paleta restrita — que apareça no onboarding, empty states e landing.
- **Numeração orgulhosa** — números grandes como protagonistas, tabular sempre, talvez com uma fonte de display diferente do corpo.
- **Foguinho do streak com personalidade** — pode virar mascote leve, sem virar emoji infantil.

## 7. Formato da entrega

1. **Markdown estruturado** com tabelas de tokens (HEX, classes, usos).
2. **Mockups ASCII ou descrições visuais** para cada componente.
3. **Pelo menos um screen mockado por inteiro** (Dashboard com rings + lista de meals — a tela mais importante do app) — pode ser SVG, código React, ou mockup detalhado em ASCII com cotas.
4. **Landing page** em HTML+CSS standalone OU componentes React+Tailwind navegáveis.
5. **`tailwind.config.ts` final.**

## 8. Ordem de execução sugerida

1. Comece pela **filosofia visual** (parágrafos) — preciso aprovar a direção antes de você gastar tempo em tokens.
2. Em seguida, **paleta + tipografia** — base do sistema.
3. Depois, **um screen mockado por inteiro** (Dashboard) — prova que o sistema funciona em conjunto.
4. Aí sim: resto dos componentes + landing + `tailwind.config.ts`.

Apresente cada bloco e me pergunte se sigo antes de avançar — quero iterar, não receber 40 páginas de uma vez.

---

**Pronto?** Comece pela filosofia visual: 2-3 parágrafos descrevendo a direção que você escolheu e por quê. Inclua 3-5 referências (apps, sites, marcas, posters) que orbitam a direção — não para copiar, para eu calibrar.
