import type { FastifyInstance } from "fastify";
import { ContactsSyncRequestSchema } from "@fitbrother/shared";
import { authRequired } from "../lib/auth.js";
import { internalError } from "../lib/errors.js";
import { supabaseService } from "../lib/supabase.js";
import { syncContacts } from "../services/contacts.js";

export async function contactsRoutes(app: FastifyInstance) {
  // Recebe hashes SHA-256 dos contatos (números em claro nunca chegam aqui),
  // guarda o grafo e cria follows pros contatos que já são usuários verificados.
  // Gate: só usuários com telefone verificado podem sincronizar.
  app.post("/contacts/sync", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = ContactsSyncRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_body" });
    }
    const userId = req.user!.id;
    const admin = supabaseService();

    const { data: prof, error: pErr } = await admin
      .from("profiles_private")
      .select("phone_verified_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) {
      return internalError(reply, req.log, pErr, { where: "contacts_sync_profile" });
    }
    if (!prof?.phone_verified_at) {
      return reply.code(403).send({ error: "phone_not_verified" });
    }

    try {
      const followed = await syncContacts(admin, userId, parsed.data.hashes);
      return reply.send({ followed });
    } catch (err) {
      return internalError(reply, req.log, err, { where: "contacts_sync" });
    }
  });
}
