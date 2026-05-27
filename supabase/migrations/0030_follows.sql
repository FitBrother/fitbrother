-- M5.3 — Follow assimétrico (estilo Duolingo). Substitui o friendships
-- (pedido→aceite) rascunhado em FEATURES §3.4. Não há aceite: seguir é
-- unilateral. O leaderboard agrega quem o usuário segue.
CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> followee_id)
);

-- Reverse-lookup (quem segue X) e contagem de seguidores.
CREATE INDEX follows_followee_idx ON public.follows (followee_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Vejo os follows em que eu sou uma das pontas (quem sigo + quem me segue).
CREATE POLICY follows_participant_read
  ON public.follows
  FOR SELECT
  USING (auth.uid() IN (follower_id, followee_id));
-- Escrita só via service-role (rotas /contacts/sync e reverse-match).
