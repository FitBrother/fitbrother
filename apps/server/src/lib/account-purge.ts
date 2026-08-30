import type { FastifyBaseLogger } from "fastify";
import { supabaseService } from "./supabase.js";

/**
 * Passos comuns a qualquer purge de conta (LGPD ou cadastro abandonado):
 * limpa os buckets do usuário e deleta o auth user, registrando em
 * account_audit_log. Quem chama decide o critério de elegibilidade e
 * qualquer bookkeeping específico do próprio fluxo (ex.: account_deletions).
 */
export async function removeUserStorage(bucket: string, userId: string): Promise<void> {
  const storage = supabaseService().storage.from(bucket);
  let hasObjects = true;
  while (hasObjects) {
    const { data, error } = await storage.list(userId, { limit: 1000, offset: 0 });
    if (error) throw new Error(`${bucket}: ${error.message}`);
    const paths = (data ?? []).map((object) => `${userId}/${object.name}`);
    if (paths.length === 0) {
      hasObjects = false;
      continue;
    }
    const { error: removeError } = await storage.remove(paths);
    if (removeError) throw new Error(`${bucket}: ${removeError.message}`);
  }
}

export async function deleteAuthUserAndAudit(
  userId: string,
  action: string,
  metadata: Record<string, unknown>,
  log: FastifyBaseLogger,
): Promise<void> {
  const admin = supabaseService();

  await admin.from("account_audit_log").insert({
    user_id: userId,
    action,
    status: "started",
    metadata,
  });

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    await admin.from("account_audit_log").insert({
      user_id: userId,
      action,
      status: "failed",
      metadata: { ...metadata, error: error.message },
    });
    log.error({ err: error, user_id: userId, action }, "purge_delete_user_failed");
    throw new Error(error.message);
  }

  log.info({ user_id: userId, action }, "purge_delete_user_done");
}
