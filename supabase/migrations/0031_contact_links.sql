-- M5.3 — Grafo de contatos hasheado. O app normaliza os números pra E.164 e
-- envia SHA-256 (hex, lowercase) — números em claro nunca chegam ao servidor.
-- Guardar o grafo habilita o reverse-match: quando alguém verifica o telefone,
-- todo dono que tinha o número dele passa a segui-lo automaticamente.
CREATE TABLE public.contact_links (
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, phone_hash)
);

-- Reverse-lookup: "quem tem ESTE hash na agenda?" (na verificação de telefone).
CREATE INDEX contact_links_phone_hash_idx ON public.contact_links (phone_hash);

ALTER TABLE public.contact_links ENABLE ROW LEVEL SECURITY;

-- Owner-only. Escrita via service-role (rota /contacts/sync).
CREATE POLICY contact_links_owner_read
  ON public.contact_links
  FOR SELECT
  USING (auth.uid() = owner_id);
