-- Vazamento de foto de refeição via post_images_follower_select (0076).
-- Monta dois usuários, um seguindo o outro, e pergunta à política se o
-- seguidor pode LER a foto de refeição do seguido.
\set ON_ERROR_STOP on
BEGIN;

-- Dois usuários reais em auth.users: as FKs de follows apontam para lá.
INSERT INTO auth.users (id, email)
VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'autor-rls@fitbrother.test'),
       ('bbbbbbbb-0000-4000-8000-000000000002', 'seguidor-rls@fitbrother.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.follows (follower_id, followee_id)
VALUES ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO storage.objects (bucket_id, name, owner)
VALUES
  ('post-images',
   'aaaaaaaa-0000-4000-8000-000000000001/meal-photos/cccccccc-0000-4000-8000-000000000003.jpg',
   'aaaaaaaa-0000-4000-8000-000000000001'),
  ('post-images',
   'aaaaaaaa-0000-4000-8000-000000000001/post-dddddddd-0000-4000-8000-000000000004.jpg',
   'aaaaaaaa-0000-4000-8000-000000000001')
ON CONFLICT (bucket_id, name) DO NOTHING;

-- Passa a ser o seguidor: as políticas de storage.objects leem auth.uid(), e
-- `postgres` é superusuário — sem trocar de role a RLS seria ignorada e o
-- check mediria nada.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims =
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

-- Check 1: a foto de refeição do seguido NÃO deve ser legível.
SELECT 'check_1_meal_photo_hidden' AS check,
       NOT EXISTS (
         SELECT 1 FROM storage.objects
         WHERE bucket_id = 'post-images'
           AND name LIKE 'aaaaaaaa-0000-4000-8000-000000000001/meal-photos/%'
       ) AS pass;

-- Check 2: a foto de POST do seguido DEVE continuar legível — é o que a 0076
-- existe para permitir, e a correção não pode levar isso embora.
SELECT 'check_2_post_photo_visible' AS check,
       EXISTS (
         SELECT 1 FROM storage.objects
         WHERE bucket_id = 'post-images'
           AND name LIKE 'aaaaaaaa-0000-4000-8000-000000000001/post-%'
       ) AS pass;

ROLLBACK;
