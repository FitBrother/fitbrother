# M9 — Compartilhamento externo (cards estilo Strava) (design)

**Data:** 2026-06-19
**Fase:** 2 (rede social). Última de três: M7 ✅ → M8 ✅ → **M9**.
**Roadmap canônico:** [`docs/PLAN.md`](../../PLAN.md) §M9. Decisões transversais: [`2026-06-12-m7-m9-rede-social-master-plan-design.md`](2026-06-12-m7-m9-rede-social-master-plan-design.md).
**Status:** aprovado para implementação.
**Base:** branch empilhada em `feat/m8-2-insights` (precisa do `InsightCard`/insights do M8.2 e do `PostCard` do M7).

---

## 1. Objetivo

Motor de aquisição orgânica: o usuário gera uma **imagem exportável** (estilo Strava) a partir de um post, de um insight de IA, ou de uma refeição, e compartilha em apps externos (Instagram/WhatsApp Stories) ou salva na galeria. Tudo **client-side**, sem backend novo.

## 2. Decisões fechadas (brainstorm)

| Tema | Decisão |
|------|---------|
| Formato | **Stories 9:16** (1080×1920) apenas. Quadrado fica para v2. |
| Saída | Share sheet nativo (`expo-sharing`) **+** salvar na galeria (`expo-media-library`). |
| Origens | Post do feed **+** insight de IA **+** detalhe da refeição (3 pontos de entrada). |
| Abordagem | Client-side: renderiza componente RN → captura PNG (`react-native-view-shot`). Sem servidor; deep-link público fica para v2. |

## 3. Dependências novas
- `react-native-view-shot` — `captureRef(viewRef)` → arquivo PNG temporário.
- `expo-sharing` — `Sharing.shareAsync(uri)` (share sheet do SO).
- `expo-media-library` — `saveToLibraryAsync(uri)` (salvar na galeria; requer permissão).
- `expo-linear-gradient` — **já instalado** (fundo dos cards).

> Instalar via `npx expo install` (alinha versões com o SDK). Exige **dev build** (não funciona no Expo Go por causa dos módulos nativos) — o projeto já usa dev build desde M2.

## 4. Arquitetura

### 4.1 Componente `ShareCard`
- `components/domain/ShareCard.tsx` — renderiza um quadro **fixo 9:16** usando tokens do design system. Recebe um prop discriminado:
  - `{ kind: "meal"; title; imageUrl?; kcal; protein_g; carbs_g; fat_g }`
  - `{ kind: "insight"; title; headline; bullets; score? }`
- Variante **meal/post:** foto do usuário no topo (se `imageUrl`; senão fundo gradiente da marca) + título/legenda + bloco de macros (kcal + P/C/G, `tabular-nums`) + marca d'água.
- Variante **insight:** fundo gradiente da marca + título + headline + até 3 bullets + score (se houver) + marca d'água.
- **Marca d'água:** wordmark "Fitbrother" + ícone-folha (lucide `Leaf` ou asset de marca se existir) no rodapé. Sem hex inline — tokens via classes/`lib/colors`.
- O quadro é renderizado em tamanho fixo de layout (ex: 360×640 dp) com `collapsable={false}` e um `ref`; a captura em alta densidade gera ~1080×1920.

### 4.2 Util de captura/saída
- `lib/share-card.ts`:
  - `captureCard(ref): Promise<string>` — `captureRef(ref, { format: "png", quality: 1, result: "tmpfile" })` → uri.
  - `shareCard(uri): Promise<void>` — checa `Sharing.isAvailableAsync()` → `Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Compartilhar" })`.
  - `saveCardToGallery(uri): Promise<void>` — `MediaLibrary.requestPermissionsAsync()` → se concedido, `MediaLibrary.saveToLibraryAsync(uri)`; senão lança erro tratável.

### 4.3 Tela de preview
- `app/(app)/share/[type]/[id].tsx` — params `type` (`meal`|`post`|`insight`) + `id`.
  - Busca o dado: `meal` → `getMeal(id)`; `post` → `fetchPost(id)`; `insight` → `fetchInsight(id)` (novo: `GET /me/insights/:id`, já existe no backend M8.2).
  - Monta as props do `ShareCard` a partir do dado, renderiza o card (preview) + botões **Compartilhar** e **Salvar**.
  - Estados: loading (busca), capturing (durante captura/saída), erro (toast).

## 5. Fluxo de dados

```
origem (post/insight/refeição) ──► "Exportar imagem" ──► /(app)/share/<type>/<id>
   ──► fetch do dado ──► <ShareCard ref> renderiza preview
   ──► [Compartilhar] captureCard → shareCard (share sheet)
   ──► [Salvar]       captureCard → saveCardToGallery (permissão → galeria)
```

## 6. Pontos de entrada
- **Post:** ação "Exportar imagem" no `PostCard`/detalhe `post/[id]` → `share/post/<id>`.
- **Insight:** botão no `InsightCard`/tela de Análises → `share/insight/<id>`.
- **Refeição:** botão no detalhe da refeição → `share/meal/<id>`. **Distinguir do share interno:** hoje o `Share2` no detalhe é "Compartilhar no feed" (M7); o M9 adiciona "Exportar imagem" como ação separada (rótulos claros).

## 7. Tratamento de erros
- `Sharing.isAvailableAsync()` falso (raro) → toast "Compartilhamento indisponível neste aparelho".
- Permissão de galeria negada → toast "Permita o acesso às fotos pra salvar" (não quebra; share sheet segue funcionando).
- `captureRef` falha → toast "Não foi possível gerar a imagem" + log.
- Dado não encontrado (id inválido / fora de visibilidade) → tela de erro com voltar.

## 8. Testes
- **Device-only:** captura, share sheet e galeria não rodam em CI/SQL — verificação primária é **e2e manual no device** (gerar card de post, insight e refeição; compartilhar; salvar).
- **TS:** `npm run typecheck` + `npm run lint`. Sem migrations, sem checks SQL.

## 9. Fora de escopo / follow-ups
- Formato quadrado (1:1), render server-side, deep-link público compartilhável → v2.
- **M6/LGPD:** sem novo dado persistido (cards são efêmeros); nada a adicionar no export/delete.
- Eventual tracking de "quantos compartilharam" (analytics) → v2.

## 10. Feito quando
Usuário gera e compartilha externamente (share sheet) e salva na galeria um card 9:16 a partir de um post, de um insight e de uma refeição, com a marca d'água do app; permissões/erros são tratados sem quebrar a tela. **M9 e a Fase 2 concluídos.**

> Plano único (UI + util de captura) em `docs/superpowers/plans/`.
