-- M7.2 fix — RLS de storage.objects só liberava SELECT em post-images pro
-- dono do arquivo (0040), mas a visibilidade de posts (0041) já inclui quem
-- segue o autor. Resultado: abrir/compartilhar/salvar a foto de um post de
-- alguém que você segue falhava com 400 no createSignedUrl. Espelha a mesma
-- regra de visibilidade de public.posts.
CREATE POLICY post_images_follower_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'post-images'
    AND EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid()
        AND f.followee_id::text = (storage.foldername(name))[1]
    )
  );
