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
| `politica-de-privacidade.md` | https://fitbrother.app/privacidade |
| `termos-de-uso.md` | https://fitbrother.app/termos |
| `exclusao-de-dados.md` | https://fitbrother.app/exclusao-de-dados |
| `aviso-de-saude.md` | https://fitbrother.app/aviso-de-saude |
| `politica-de-cookies.md` | https://fitbrother.app/cookies |

As duas primeiras são as URLs referenciadas em `apps/mobile/app.json` → `extra.legal`.

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

## Pendência conhecida

O art. 11 da LGPD exige consentimento **específico e destacado** para dado
sensível. Hoje os dados de saúde (peso, altura, % de gordura, diabetes tipo 1,
doença renal, gestação/lactação, uso de GLP-1, rastreio de transtorno alimentar)
são consentidos sob o escopo genérico `privacy`.

Corrigir exige um escopo `health_data` próprio: migration no enum
`consent_scope`, ajuste no servidor, no `ConsentBlock` e no `onboardingStore`.
Registrado em
[`docs/superpowers/specs/2026-08-31-documentos-legais-design.md`](../superpowers/specs/2026-08-31-documentos-legais-design.md).

## Ressalva

Este material não é aconselhamento jurídico. Antes de operar em escala ou
processar pagamentos, vale revisão por advogado especializado em proteção de dados.
