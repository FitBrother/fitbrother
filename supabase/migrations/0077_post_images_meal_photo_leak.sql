-- Correção da 0076. A política de seguidor casava com QUALQUER objeto sob
-- `{authorId}/`, e `meal-photos/` mora na mesma pasta — foto de refeição é
-- privada e estava legível para quem segue o autor. Pior: `storage.list()`
-- também é SELECT em storage.objects, então dava para enumerar.
--
-- Reproduzido em scripts/checks/share-camera-0-rls.sql antes de corrigir: um
-- seguidor lia e LISTAVA os três arquivos de uma pasta `meal-photos/` de teste.
--
-- A regra passa a casar o nome do arquivo de post (`{authorId}/post-{id}.jpg`,
-- ver `uploadPostImage`), que é o que a 0076 queria liberar.
DROP POLICY IF EXISTS post_images_follower_select ON storage.objects;

CREATE POLICY post_images_follower_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'post-images'
    AND name LIKE ((storage.foldername(name))[1] || '/post-%')
    AND EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid()
        AND f.followee_id::text = (storage.foldername(name))[1]
    )
  );
