# Auth/Signup polish — design

Parte do "Grupo D" do batch de pré-lançamento web (ver conversa). Duas mudanças pequenas e isoladas em `apps/mobile`, sem impacto em schema/backend.

## 1. Cor do loading em "Criando sua conta..."

`components/onboarding/blocks/SubmittingBlock.tsx:80` renderiza `<ActivityIndicator size="large" />` sem `color`. No web isso cai no azul padrão do Material Design, destoando do verde-menta da marca.

**Fix:** `color={colors.primary[500]}` (`#05B789`) — bom contraste sobre o fundo `bg-neutral-50` da tela.

## 2. Campo de confirmar senha

`components/onboarding/blocks/SignupBlock.tsx` tem só `email` + `password` (via `PasswordInput`). Sem confirmação, um erro de digitação na senha só aparece no próximo login.

**Fix:**
- Novo estado `confirmPassword` no `SignupBlock`.
- Segundo `PasswordInput` "Confirmar senha" abaixo do campo "Senha", sem `showStrength` (a força só é relevante no campo principal).
- Estado `confirmTouched` (mesmo padrão do `emailTouched` já existente) — erro "As senhas não coincidem" só aparece depois que o campo perde o foco, e só se `confirmPassword` tiver conteúdo.
- `canSubmit` passa a exigir `confirmPassword === password` além das checagens já existentes (`emailValid && passwordValid`).
- Ordem de tab/submit: e-mail → senha → confirmar senha → submit (`onSubmitEditing` do campo senha muda de `handleSubmit` para focar o novo campo; o novo campo chama `handleSubmit`).

## Fora de escopo

- Backend/schema — `supabase.auth.updateUser` já só recebe `password`, não muda.
- Força de senha do campo de confirmação — não se aplica.
