# Documentos legais

Os textos **não** ficam aqui. A fonte da verdade é:

```
landing-page/content/legal/
```

## Por que lá e não em docs/

A landing é um projeto Vercel próprio com Root Directory `landing-page/` (commit
`3cfd084`). O script de build roda dentro desse diretório e não enxerga `../docs/`.
Manter o markdown dentro do root de build elimina essa fragilidade.

## Documentos e rotas

| Arquivo | URL publicada |
|---|---|
| `politica-de-privacidade.md` | https://lp.fitbrother.app/privacidade |
| `termos-de-uso.md` | https://lp.fitbrother.app/termos |
| `exclusao-de-dados.md` | https://lp.fitbrother.app/exclusao-de-dados |
| `aviso-de-saude.md` | https://lp.fitbrother.app/aviso-de-saude |
| `politica-de-cookies.md` | https://lp.fitbrother.app/cookies |

Todas as cinco são as URLs referenciadas em `apps/mobile/app.json` → `extra.legal`.

**Por que `lp.` e não o domínio principal:** o combinado original era `fitbrother.app`
(sem `www`) servir a landing/documentos legais e `www.fitbrother.app` servir o app. Na
Vercel, hoje `fitbrother.app` só redireciona (308) para `www.fitbrother.app`, que está
atribuído ao projeto do app (PWA) — então qualquer link pra `fitbrother.app/termos`
cai no rewrite catch-all do app e nunca chega na landing. `lp.fitbrother.app` é onde o
projeto da landing está de fato publicado, e funciona hoje. Se a atribuição de domínio
for corrigida na Vercel (fitbrother.app → projeto da landing, sem esse redirect), as
URLs em `apps/mobile/app.json` podem voltar a apontar pro domínio principal.

## Como funciona a publicação

`npm run build` na landing roda `vite build` e em seguida
`scripts/build-legal.mjs`, que converte cada markdown em `dist/<slug>.html`.
O `cleanUrls: true` do Vercel serve esses arquivos sem a extensão.

Para conferir localmente:

```bash
cd landing-page && npm run build && npm run preview
```

## Ao alterar um documento

Mudança de redação sem efeito material: atualize `updated` no frontmatter.

Mudança material — nova finalidade, novo suboperador, mudança de retenção ou de
direitos: além do frontmatter, **bumpe `POLICY_VERSION`** em
`apps/mobile/lib/constants.ts`. Isso faz o app recoletar o consentimento e
registrar a nova versão em `consent_log`.

## Consentimento de dado de saúde

O art. 11, I da LGPD exige consentimento **específico e destacado** para dado
sensível. O escopo `health_data` cobre isso, separado do genérico `privacy`:

- Enum em `0073_health_data_consent_enum.sql` (migration isolada — valor de enum
  não pode ser usado na mesma transação em que é criado)
- Trava obrigatória e backfill em `0074_health_data_consent.sql`
- Bloco visualmente destacado em `ConsentBlock.tsx` — borda, ícone e a lista
  explícita do que é coletado, deliberadamente diferente dos outros checkboxes

### Quem ainda precisa reconsentir

Contas criadas antes da migration receberam o escopo derivado do consentimento
de `privacy`, marcadas com `policy_version = 'v1.0-migrado'` em vez de `'v1.0'`.
Elas nunca viram o consentimento destacado, e a marca preserva essa distinção na
trilha de auditoria:

```sql
SELECT user_id FROM public.consent_log
WHERE scope = 'health_data' AND policy_version = 'v1.0-migrado'
  AND revoked_at IS NULL;
```

Se um dia essas contas passarem a ser de usuários reais, e não de teste, vale
interceptá-las com uma tela de reconsentimento antes de seguir.

## Ressalva

Este material não é aconselhamento jurídico. Antes de operar em escala ou
processar pagamentos, vale revisão por advogado especializado em proteção de dados.
