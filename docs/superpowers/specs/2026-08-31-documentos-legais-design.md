# Documentos Legais — Design

**Data:** 2026-08-31
**Status:** aprovado, aguardando plano de implementação

## Objetivo

Escrever os documentos legais do FitBrother e publicá-los nas URLs que o app já
referencia, destravando a submissão às lojas.

O app já implementa toda a mecânica de LGPD — `consent_log` com versionamento,
exportação, exclusão com purga em D+30, retenção de áudio de 30 dias. O que falta
é o texto: [`about.tsx`](../../../apps/mobile/app/(app)/about.tsx) linka para
`fitbrother.app/termos` e `fitbrother.app/privacidade`, e ambas as URLs estão mortas.

## Decisões

| Decisão | Escolha |
|---|---|
| Controlador | Pedro de Oliveira Britto — `pedro@fitbrother.app` (PF, sem CPF público) |
| Idade mínima | 18+ |
| Documentos | Privacidade, Termos, Exclusão de dados, Aviso de saúde/IA, Cookies |
| Fonte da verdade | Markdown versionado no git |
| Publicação | HTML estático gerado no build da landing |
| Escopo de código | Apenas o fix de `policy_version`; sem mudança no fluxo de consentimento |

## Requisitos que moldam o texto

Levantados por pesquisa, não por suposição:

- **LGPD art. 11, I** — dado de saúde exige consentimento livre, informado,
  inequívoco, **específico e destacado**. Dados antropométricos (peso, altura,
  % de gordura) são dado de saúde.
- **LGPD art. 33** — transferência internacional precisa de base legal declarada.
  OpenAI, Google, Sentry e Vercel processam fora do Brasil.
- **Google Play** — política em URL pública, não-geofenced, **não-PDF**, não editável.
  A URL de exclusão precisa citar o nome do app/desenvolvedor, ser funcional,
  ter o caminho de exclusão em destaque e revelar as práticas de retenção.
- **Apple 5.1.3** — dado de saúde não pode ir para publicidade, data mining
  baseado em uso, nem ser vendido a data brokers. Compromisso explícito no texto.

## Conteúdo

O diferencial destes documentos é descreverem o comportamento **real do código**,
não boilerplate. Cada afirmação abaixo é verificável no repositório:

- Áudio apagado em 30 dias — worker `purge-audios`, `meals.audio_deleted_at`
- Exclusão com purga em D+30 e janela de reativação — worker `purge-accounts`,
  tabela `account_deletions`
- Cache de IA por hash — `transcriptions(audio_hash)`, `ai_extractions(input_hash)`
- Consentimentos não-revogáveis sem encerrar a conta — `NON_REVOKABLE_SCOPES`
  em [`account.ts`](../../../apps/server/src/routes/account.ts)
- Cap diário de IA por usuário — tabela `ai_usage`

**Suboperadores a declarar:** Google (Gemini 2.5 Flash), OpenAI (Whisper),
Supabase, Meta/WhatsApp Cloud API, Sentry, Expo Push, Fly.io, AWS Lambda, Vercel.

**Cookies:** a landing não tem nenhum tracker — verificado por varredura
(`gtag`, GTM, pixel, Plausible, Hotjar, Clarity: zero ocorrências). O documento
declara isso, em vez de inventar um banner desnecessário.

## Arquitetura

### Onde o markdown vive

Em `landing-page/content/legal/*.md`, **não** em `docs/legal/`.

O commit `3cfd084` configurou a landing como projeto Vercel com Root Directory
= `landing-page/`. Um build script rodando ali não consegue ler `../docs/`.
Colocar a fonte dentro do root de build elimina essa fragilidade.

`docs/legal/README.md` fica como ponteiro para descoberta.

### Como vira HTML

A landing é Vite single-page sem router, e `react-router` seria uma dependência
de runtime para páginas que são texto estático. Em vez disso: um script de build
converte markdown em HTML usando `marked` como **devDependency** — build-time
apenas, zero JavaScript adicional entregue ao cliente.

A landing não está nos npm workspaces (tem `package.json` e lock próprios), então
a dependência fica isolada e não toca o lockfile do monorepo.

O HTML gerado herda os tokens visuais de `index.css` para as páginas legais não
parecerem descoladas do resto do site.

### Rotas

`cleanUrls: true` no `landing-page/vercel.json` serve `/termos` a partir de
`termos.html`, sem extensão na URL.

| Arquivo | URL |
|---|---|
| `politica-de-privacidade.md` | `fitbrother.app/privacidade` |
| `termos-de-uso.md` | `fitbrother.app/termos` |
| `exclusao-de-dados.md` | `fitbrother.app/exclusao-de-dados` |
| `aviso-de-saude.md` | `fitbrother.app/aviso-de-saude` |
| `politica-de-cookies.md` | `fitbrother.app/cookies` |

As duas primeiras batem exatamente com [`app.json`](../../../apps/mobile/app.json),
então os links quebrados do app passam a funcionar sem tocar no app. Confirmado
com o usuário que `fitbrother.app` (sem `www`) é servido pela landing, portanto o
rewrite catch-all do PWA não intercepta essas rotas.

O Footer já tem uma coluna "Legal" com `<span>` inertes para "Termos de Uso" e
"Privacidade" — viram links reais, mais os três documentos novos.

### Fix de código

[`account.ts:37`](../../../apps/mobile/lib/api/account.ts) envia
`policy_version: "v1.0"` hardcoded em vez de importar `POLICY_VERSION` de
`lib/constants.ts`. Ao bumpar a versão da política, o consentimento de marketing
gravaria a versão errada no `consent_log`. Uma linha.

## Versionamento

`POLICY_VERSION` continua `v1.0` — estes são os documentos originais, não uma
revisão. Cada documento carrega sua data de vigência no cabeçalho. Mudança
material futura = bump da constante, que faz o app recoletar consentimento.

## Fora de escopo

**Consentimento destacado para dado de saúde.** O art. 11 pede consentimento
específico para dado sensível; hoje saúde está implícito no escopo `privacy`.
Corrigir exigiria migration no enum `consent_scope`, mudanças no servidor, no
`ConsentBlock` e no `onboardingStore`. Fica registrado como pendência conhecida,
a ser priorizada separadamente.

**Ressalva:** este material não é aconselhamento jurídico. Antes de operar em
escala ou processar pagamentos, vale revisão por advogado especializado em
proteção de dados.
