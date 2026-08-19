# M10 — Perfil completo + menus internos

Fase 3 (Polish & Expansão). Depende do backend LGPD do M6, já implementado e
estável (`apps/server/src/routes/account.ts`) mas não deployado em produção —
isso não bloqueia esta fatia, que só consome o contrato local. Fonte:
`docs/PLAN.md` linhas 548-564.

## Decisões fechadas no brainstorm

- Achievements/Friends/Insights/History saem dos ícones do `HomeHeader` e
  viram atalhos só dentro do Perfil. `Feed` e `Buscar pessoas` continuam no
  header (fora do escopo do M10).
- URLs de Termos/Privacidade não existem ainda — usa constantes
  placeholder em `lib/constants.ts`, comentadas como pendentes de troca
  antes do lançamento.
- Exportar dados: baixa o ZIP e abre o share sheet nativo
  (`expo-sharing`, já dependência; `expo-file-system` precisa ser
  adicionada).
- Excluir conta: modal de confirmação (`Alert.alert`, padrão já usado em
  `meal/[id]/index.tsx`) explicando a janela de reativação — sem fricção
  extra de digitar texto/senha.

## 1. Estrutura de telas e navegação

```
app/(app)/profile.tsx          → reescrita completa
app/(app)/settings/
  index.tsx                    → preferências + consentimentos
  privacy.tsx                  → exportar dados + excluir conta
  about.tsx                    → versão + links Termos/Privacidade
```

`HomeHeader.tsx` perde os botões `Calendar`/`Sparkles`/`Users` (que hoje
levam a `history`/`insights`/`friends`) — mantém só `Rss` (feed), `Search`
(buscar pessoas) e `User` (profile). `profile.tsx` ganha os 5 atalhos:
Conquistas, Amigos, Análises, Histórico, Configurações.

## 2. Fonte de dados do perfil — `useAccountProfile`

`GET /account/profile` tem um shape diferente do que `useProfile()`
(`/me`) já expõe — `user{id,email}`, `private{phone_verified_at}`,
`consents`, `account{delete_requested_at,scheduled_purge_at}` não existem
no `Profile` de `lib/profile/types.ts`. Em vez de estender esse tipo, M10
cria um hook novo e independente: `useAccountProfile()`
(`apps/mobile/lib/hooks/useAccountProfile.ts`), `useQuery` simples
envolvendo `getAccountProfile()` de um `lib/api/account.ts` novo, retorno
tipado por `AccountProfileResponse` (já existe em `@fitbrother/shared`,
zero schema novo necessário).

`avatar_url` vem do banco como **path de storage** (`${userId}/avatar.jpg`),
não uma URL pronta — o bucket `post-images` é privado com RLS
owner-only-select. `profile.tsx` resolve isso client-side com
`supabase.storage.from("post-images").createSignedUrl(path, 3600)`
(funciona porque é o dono olhando o próprio avatar — RLS permite). Enquanto
resolve ou se `avatar_url` for `null`, mostra o fallback `UserCircle2`
(mesmo padrão visual do círculo em `IdentityBlock.tsx`, só sem a parte de
upload/câmera).

## 3. `profile.tsx`

Header (fora do card): círculo de avatar (112×112, `rounded-full border
border-neutral-200 bg-white`) + `full_name` + `@username` abaixo. Card de
atalhos (`rounded-2xl border border-neutral-200 bg-white`, linhas
`min-h-[44px]`): Conquistas → `/(app)/achievements`, Amigos →
`/(app)/friends`, Análises → `/(app)/insights`, Histórico →
`/(app)/history`, Configurações → `/(app)/settings`. Botão "Sair" mantido
no rodapé (já existe, sem mudança de comportamento).

Sem edição de nome/avatar/username nesta fatia — não existe endpoint pra
isso (`PATCH /account/settings` só aceita `timezone`/`day_start_hour`) e
não está no escopo do milestone.

## 4. `settings/index.tsx` — Preferências + Consentimentos

**Preferências:**
- `day_start_hour`: reaproveita o padrão exato de `ContactBlock.tsx` —
  `Input` com `keyboardType="number-pad"`, `value={String(day_start_hour)}`,
  `onChangeText={(v) => setValue(clampHour(v))}`. Ao perder foco (`onBlur`)
  ou um botão "Salvar" explícito, chama `PATCH /account/settings`.
- `timezone`: mostra o valor atual (texto), com um botão "Detectar
  novamente" que roda `Intl.DateTimeFormat().resolvedOptions().timeZone` e
  faz o PATCH imediatamente — sem seletor manual de fuso horário.

**Consentimentos:** lista os 5 escopos de `ConsentScopeSchema`
(`terms`, `privacy`, `marketing`, `ai_processing`, `data_export`).
`terms`/`privacy`/`ai_processing` renderizam como linha estática
("Concedido — obrigatório pro serviço", sem toggle interativo — tentar
revogar já dá 409 no backend, não faz sentido oferecer a ação). `marketing`
e `data_export` são switches reais que chamam `POST /account/consent`.

## 5. `settings/privacy.tsx` — Dados e exclusão

**Exportar meus dados:** botão "Exportar meus dados" → `getAccountExport()`
(nova função em `lib/api/account.ts`, chama `GET /account/export` e
devolve o `Response` cru, sem `.json()` — é um stream de ZIP) → salva em
arquivo temporário via `expo-file-system` (`File`/`downloadAsync`,
dependência nova — `npx expo install expo-file-system`) → abre o share
sheet com `Sharing.shareAsync(uri, { mimeType: "application/zip" })`
(mesmo padrão de `share-card.ts`, adaptado pra um arquivo já em disco em
vez de uma view capturada).

**Excluir conta:** botão "Excluir conta" (variante `danger` nova em
`Button.tsx` — não existe hoje, só `primary/dark/outline/ghost`; adiciona
uma 5ª entrada nos 3 mapas de estilo usando `colors.danger`) → `Alert.alert`
com título "Excluir conta?", corpo explicando que a conta é desativada,
some das telas sociais, e pode ser reativada fazendo login de novo dentro
do prazo — botões `Cancelar` (`style: "cancel"`) e `Excluir conta`
(`style: "destructive"`, chama `DELETE /account` com `{confirm: true}`,
depois `supabase.auth.signOut()` e `router.replace("/(auth)/welcome")`).

## 6. `settings/about.tsx`

Versão via `Constants.expoConfig?.version ?? "—"`. Dois links (Termos,
Privacidade) abrindo `TERMS_URL`/`PRIVACY_URL` — novas constantes em
`apps/mobile/lib/constants.ts`, com comentário marcando que são
placeholder (mesma decisão já usada pra `POLICY_VERSION`) até existirem
URLs reais publicadas (item já pendente no M6 Ops).

## 7. Cliente API — `apps/mobile/lib/api/account.ts`

Mesmo padrão de `lib/api/me.ts` (`parseOrThrow` + `Schema.parse`):

```ts
export async function getAccountProfile(): Promise<AccountProfileResponse>
export async function patchAccountSettings(body: PatchAccountSettingsRequest): Promise<AccountSettingsResponse>
export async function postAccountConsent(body: PostAccountConsentRequest): Promise<AccountConsentResponse>
export async function getAccountExport(): Promise<Response>  // stream cru, sem parse
export async function deleteAccount(): Promise<DeleteAccountResponse>
```

Todos os tipos (`AccountProfileResponse`, `PatchAccountSettingsRequest`,
etc.) já existem em `@fitbrother/shared` — zero schema novo. `getAccountExport`
é a única exceção ao padrão `parseOrThrow`: devolve o `Response` cru pro
caller decidir como consumir o stream binário.

Hooks (`apps/mobile/lib/hooks/`): `useAccountProfile` (query),
`usePatchAccountSettings`/`usePostAccountConsent`/`useDeleteAccount`
(mutations simples — `onSuccess` invalida `["account-profile"]`, sem
necessidade de optimistic update dado o volume de interação baixo dessas
telas).

## 8. Verificação

Sem Vitest (UI + chamadas HTTP contra contrato já validado no M6). Typecheck
+ lint do monorepo. Walkthrough manual via Expo: perfil carrega
nome/avatar/username reais; editar `day_start_hour` e redetectar
`timezone` persistem (confirmar com refresh); toggle de
`marketing`/`data_export` funciona e persiste; export baixa e abre o share
sheet com um ZIP de verdade; excluir conta desloga e — fazendo login de
novo — a conta reaparece (confirma a janela de reativação do M6 ponta a
ponta pela primeira vez).

## Fora de escopo

- Editar nome/avatar/username (sem endpoint, sem pedido no milestone).
- Seletor manual de timezone (redetecção cobre o caso real, app é Brasil-only).
- UI de reativação de conta antes do prazo expirar (usuário só loga de novo).
- URLs reais de Termos/Privacidade (placeholder até existirem).
