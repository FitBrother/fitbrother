-- Foto de refeição deixa de viver só no storage.
--
-- `POST /meals/photo` já subia a foto para
-- `post-images/{userId}/meal-photos/{mealId}.jpg`, mas guardava o caminho
-- apenas como texto em `raw_input: 'Foto: ' || path`. Resultado: a foto
-- existia e nada no app a lia de volta — a tela de compartilhar uma refeição
-- nunca tinha foto, e os presets que dependem dela (Moldura, Etiqueta,
-- Discreto) eram descartados pelo `presetsFor`.
--
-- Sem constraint ligando `image_path` a `source`, ao contrário de `audio_path`
-- (que o `meals_audio_path_matches_source` amarra): uma foto pode chegar
-- DEPOIS, numa refeição registrada por texto, áudio ou código de barras. É o
-- caso central da feature de câmera no compartilhar.
ALTER TABLE public.meals ADD COLUMN image_path text;

-- Backfill: resgata o path de quem já registrou por foto. `from 7` pula
-- exatamente os 6 caracteres de 'Foto: ' — conferido em
-- scripts/checks/share-camera-1-image-path.sql, que falha se o prefixo vier
-- junto.
UPDATE public.meals
   SET image_path = substring(raw_input from 7)
 WHERE source = 'app_photo'
   AND raw_input LIKE 'Foto: %'
   AND image_path IS NULL;
