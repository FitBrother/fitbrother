-- Tour guiado pós-primeiro-registro (spotlight sobre Home/Social/Análises +
-- Perfil + atalho de instalação) — marca quando o usuário terminou ou pulou.
-- Ver docs/superpowers/specs/2026-09-17-tour-guiado-primeiro-registro-design.md.
--
-- Backfill dentro da própria migration: toda conta já existente recebe
-- now() aqui, então só quem se cadastra depois deste deploy nasce com a
-- coluna NULL. Sem isso, usuários antigos (já com muitas refeições
-- registradas) seriam tratados como novos na primeira vez que
-- registrassem algo depois do deploy, e o tour dispararia sem sentido.
ALTER TABLE public.profiles ADD COLUMN tutorial_completed_at timestamptz;

UPDATE public.profiles SET tutorial_completed_at = now() WHERE tutorial_completed_at IS NULL;
