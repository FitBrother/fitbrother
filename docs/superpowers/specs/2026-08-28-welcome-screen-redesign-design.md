# Tela de boas-vindas (Welcome) — redesign — Design

## Motivação

A primeira tela do app (`app/(auth)/welcome.tsx`) hoje é só logo + uma frase + botão
"Criar conta". Além de vender pouco o produto antes de pedir qualquer ação, ela sempre
aparece com cara de celular estreito (~440px) mesmo em desktop, porque o layout
compartilhado do grupo `(auth)` (`app/(auth)/_layout.tsx`) aplica
`md:max-w-[440px]` em **todas** as telas do grupo — inclusive nesta.

## Escopo

**Dentro do escopo:**
- Novo conteúdo de introdução na Welcome: headline + 3 bullets de valor com ícone.
- CTA primário passa de "Criar conta" pra "Comece agora" (secundário "Já tenho conta"
  não muda).
- Layout responsivo próprio pra Welcome: uma coluna no mobile, duas colunas em `lg+`
  (valor à esquerda, CTA à direita).
- `(auth)/_layout.tsx` perde o `md:max-w-[440px]` genérico (vira `<Stack/>` puro, mesmo
  padrão já usado em `(onboarding)/_layout.tsx`); `sign-in.tsx` (única outra tela do
  grupo) ganha esse mesmo max-width diretamente nela, pra não regredir.

**Fora do escopo:** conteúdo/copy de `sign-in.tsx` em si, ilustrações customizadas
(fica só ícone + texto), qualquer mudança em `(onboarding)`.

## Conteúdo

Bullets (ícone `lucide-react-native` + frase curta):

| Ícone | Texto |
|---|---|
| `MessageCircle` | Registre em linguagem natural, texto ou áudio |
| `Zap` | Macros calculados na hora, sem digitar nada |
| `Flame` | Streaks e conquistas pra manter o ritmo |

## Layout

- **Mobile (padrão):** uma coluna — logo, subtítulo, bullets empilhados, botões no fim
  (mesmo espírito do `justify-between` atual: bullets centralizados no espaço
  disponível, CTA ao final).
- **`lg+`:** duas colunas lado a lado, centralizadas como grupo na tela (não esticadas
  borda a borda): esquerda (~480px) com logo/headline/bullets, direita (~360px) com os
  dois botões de CTA.

## Arquivos afetados

- Modificado: `apps/mobile/app/(auth)/welcome.tsx` (reescrito)
- Modificado: `apps/mobile/app/(auth)/_layout.tsx` (simplificado pra `<Stack/>` puro)
- Modificado: `apps/mobile/app/(auth)/sign-in.tsx` (ganha `md:mx-auto md:max-w-[440px]`
  na View de conteúdo, pra manter o comportamento atual)

Nenhuma mudança de dados, backend ou schema — é só UI.
