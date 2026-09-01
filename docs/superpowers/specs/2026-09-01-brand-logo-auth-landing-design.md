# Logo da marca, saída do login e landing alinhada ao produto real

**Data:** 2026-09-01
**Contexto:** pós-lançamento da versão web. Quatro pontos levantados no uso real.

---

## Problema

1. O app escreve `Fitbrother` como texto em cinco telas, mesmo tendo o lockup horizontal
   empacotado. Só o `Sidebar` usa o logo de verdade.
2. Na tela de login, o botão "Voltar" chama `router.back()` — não faz nada para quem abre
   `/sign-in` direto pela URL, porque não existe histórico. A tela também não tem logo, então
   não há nenhuma saída de volta para a landing.
3. A tela de boas-vindas não tem como voltar para a landing page.
4. A landing vende o WhatsApp como pronto em cinco lugares (o M4 está parado esperando a
   verificação da Meta) e nunca menciona o registro por foto, que já está no ar.

---

## Decisões

| Questão | Decisão |
|---|---|
| Botão quebrado do login | Vira "Ainda não tenho conta" → `router.replace("/(auth)/welcome")` |
| Escopo da troca texto→logo | As cinco ocorrências, incluindo o `ShareCard` (exige variante branca) |
| WhatsApp na landing | Passo 01 do "Como funciona" passa a ser o registro por foto; WhatsApp vira card com selo "Em breve" |

---

## Arquitetura

### Componente `Logo`

`apps/mobile/components/Logo.tsx`. O PNG é 1182×191 — ratio 6.188. O componente recebe
apenas `height` e deriva a largura, de forma que o lockup nunca deforme. Hoje o `Sidebar`
carrega `height: 28, width: 173` hardcoded; passa a usar o componente.

```tsx
type LogoProps = { height: number; variant?: "menta" | "white" };
```

Metro exige import estático de assets, então o componente importa as duas variantes no topo
e escolhe pelo prop. Não recebe `onPress` — a navegação é responsabilidade de quem usa.

### Asset da variante branca

`apps/mobile/assets/brand/logo-horizontal-branco.png`, derivado do menta. O logo é uma cor
sólida (`#06D59F`) sobre transparente com antialiasing no canal alpha, então a conversão é
setar RGB para branco preservando o alpha: sem reamostragem e sem perda de borda.

Necessária porque o `ShareCard` renderiza sobre um gradiente `primary-600 → primary-400` —
o logo menta desapareceria ali.

### URL da landing

O app roda em `www.fitbrother.app` e a landing em `fitbrother.app`. A URL vai para
`app.json → extra.landingUrl`, seguindo o padrão já estabelecido por `extra.legal`, e é lida
por `apps/mobile/lib/site.ts`. Assim staging e produção mudam por build, sem tocar em
componente.

### Logo clicável

Só é interativo quando `Platform.OS === "web"`. No app nativo não existe "voltar para o
site", então lá o logo é imagem pura — sem `Pressable` inerte anunciando um papel de link
que não leva a lugar nenhum.

Aplicado em **welcome** e **sign-in**. Deliberadamente **não** aplicado no onboarding: sair
no meio do fluxo perde o progresso, e um logo clicável ali é uma armadilha.

---

## Mudanças

### App — texto vira logo

| Arquivo | Antes | Depois |
|---|---|---|
| `app/(auth)/welcome.tsx:34` | `text-5xl` menta | `<Logo height={40}>` clicável → landing |
| `app/(auth)/sign-in.tsx` | (não tem) | `<Logo height={28}>` clicável → landing |
| `components/onboarding/OnboardingChapterShell.tsx:147` | `text-xl` | `<Logo height={24}>` estático |
| `components/onboarding/OnboardingChapterShell.tsx:190` | `text-lg` | `<Logo height={22}>` estático |
| `app/(app)/about.tsx:13` | `text-2xl` | `<Logo height={26}>` estático |
| `components/domain/ShareCard.tsx:26-31` | folha + texto branco | `<Logo height={28} variant="white">` |
| `components/layout/Sidebar.tsx:39` | `<Image>` com tamanho fixo | `<Logo height={28}>` |

### App — saída do login

`app/(auth)/sign-in.tsx`: o botão "Voltar" com `router.back()` vira "Ainda não tenho conta"
com `router.replace("/(auth)/welcome")`. `replace` e não `push` para não empilhar
welcome → sign-in → welcome.

O label não é "Criar conta" porque o destino é a tela de boas-vindas, não um formulário de
cadastro — prometeria algo que não aparece no toque seguinte.

### Landing — alinhar com o produto real

- **`Hero.jsx`** — descrição perde "no app ou no WhatsApp" e ganha foto. Métrica
  "App + Zap / Sincronizado" → "Voz · Foto / ou texto".
- **`HowItWorks.jsx`** — passo 01 troca o mockup de conversa de WhatsApp por um visual de
  registro por foto. As classes `.wa-chat` / `.wa-bubble` ficam órfãs e saem do `index.css`.
- **`Features.jsx`** — passa a ter 5 cards: novo "Foto e código de barras" (ambos existem —
  `MealComposer` e a rota `/scan`), e o card do WhatsApp ganha selo "Em breve" com descrição
  no futuro. O grid `auto-fit minmax(240px, 1fr)` renderiza 4 colunas e deixaria o quinto
  card órfão; vira 3 colunas no desktop, lendo 3 + 2.
- **`Faq.jsx`** — "Funciona pelo WhatsApp?" responde "Sim" hoje; passa a dizer que está em
  desenvolvimento. Nova pergunta sobre registro por foto.
- **`Icon.jsx`** — novo path `camera`.

Navbar e Footer já usam o logo corretamente e não são tocados.

---

## Fora de escopo

- Gerar o logo branco para a landing page (ela não tem superfície escura que precise dele).
- Tornar o logo do `Sidebar` clicável para a Home — é navegação interna, outro assunto.
- Qualquer mudança no fluxo de cadastro em si.

---

## Verificação

Rodar o app web e o dev server da landing, e confirmar no navegador:

1. `/(auth)/welcome` mostra o logo; clicar leva para `fitbrother.app`.
2. Abrir `/sign-in` **direto pela URL** (sem histórico) — o botão de saída funciona e leva
   para welcome. Era exatamente o caso que o `router.back()` não cobria.
3. O logo não deforma em nenhum dos tamanhos.
4. Landing: WhatsApp aparece como "Em breve" nos cinco pontos, foto aparece no passo 01 e
   nos recursos, e o grid de 5 cards não deixa card órfão.
5. `npm run typecheck` e `npm run lint`.

---

## Bloqueio encontrado na verificação (2026-09-01)

O passo 1 falhou por motivo externo ao código: **a landing page não está publicada
em nenhum host alcançável.**

```
https://fitbrother.app       → 301 → https://www.fitbrother.app   (serve o app Expo)
https://www.fitbrother.app   → 200                                 (serve o app Expo)
```

O ápice redireciona para o `www`, e o `www` é o deploy do app. Como o `vercel.json` da
raiz reescreve `/(.*)` para `/index.html`, qualquer caminho cai no app.

Duas consequências:

1. O logo clicável funciona (navega), mas desemboca no próprio app — não na landing.
   O código está correto; falta o domínio apontar para o deploy da landing.
2. **Os cinco documentos legais estão inacessíveis em produção.** `fitbrother.app/termos`,
   `/privacidade`, `/exclusao-de-dados`, `/aviso-de-saude` e `/cookies` retornam o HTML do
   app em vez do documento. São as URLs que o consentimento do onboarding e
   Perfil → Privacidade abrem, e que `app.json → extra.legal` referencia.

Correção é de infraestrutura (atribuição de domínio na Vercel), não de código, e está fora
do escopo deste spec.
