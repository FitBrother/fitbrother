import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** SHA-256 hex (lowercase) de um E.164 — mesma normalização do device. */
export function hashE164(e164: string): string {
  return createHash("sha256").update(e164).digest("hex");
}

/**
 * Reverse-match: ao verificar o telefone, todo dono que tinha ESTE número na
 * agenda (contact_links) passa a seguir o recém-verificado. Idempotente
 * (ON CONFLICT). Enfileira friend_activity push pra cada novo seguidor.
 */
export async function reverseMatchFollows(
  supabase: SupabaseClient,
  newUserId: string,
  phoneHash: string,
  fullName: string | null,
): Promise<number> {
  const { data: owners, error } = await supabase
    .from("contact_links")
    .select("owner_id")
    .eq("phone_hash", phoneHash)
    .neq("owner_id", newUserId);
  if (error) throw new Error(error.message);
  if (!owners || owners.length === 0) return 0;

  const rows = owners.map((o) => ({ follower_id: o.owner_id, followee_id: newUserId }));
  const { error: insErr } = await supabase
    .from("follows")
    .upsert(rows, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
  if (insErr) throw new Error(insErr.message);

  const notifs = owners.map((o) => ({
    user_id: o.owner_id,
    channel: "push" as const,
    kind: "friend_activity" as const,
    template: "contact_joined",
    payload: { followee_id: newUserId, full_name: fullName },
  }));
  await supabase.from("notifications").insert(notifs);

  return owners.length;
}

/**
 * Upsert dos hashes da agenda do dono + cria follows pros que já são usuários
 * verificados. Retorna os perfis recém/atualmente seguidos por esse match.
 */
export async function syncContacts(
  supabase: SupabaseClient,
  ownerId: string,
  hashes: string[],
): Promise<{ user_id: string; full_name: string | null }[]> {
  if (hashes.length === 0) return [];

  // 1. Guarda o grafo (idempotente).
  const links = hashes.map((h) => ({ owner_id: ownerId, phone_hash: h }));
  const { error: linkErr } = await supabase
    .from("contact_links")
    .upsert(links, { onConflict: "owner_id,phone_hash", ignoreDuplicates: true });
  if (linkErr) throw new Error(linkErr.message);

  // 2. Casa hashes contra usuários verificados. O filtro `.in()` vira query
  // string (GET), então uma agenda grande estoura o limite de URI do gateway —
  // fatiamos em lotes. Cada hash tem 64 chars; 100/lote mantém a URL folgada.
  const CHUNK = 100;
  const matches: { user_id: string; full_name: string | null }[] = [];
  for (let i = 0; i < hashes.length; i += CHUNK) {
    const slice = hashes.slice(i, i + CHUNK);
    const { data: privateRows, error: mErr } = await supabase
      .from("profiles_private")
      .select("user_id")
      .in("phone_hash", slice)
      .not("phone_verified_at", "is", null)
      .neq("user_id", ownerId);
    if (mErr) throw new Error(mErr.message);
    const ids = (privateRows ?? []).map((row) => row.user_id);
    if (ids.length === 0) continue;

    const { data: profileRows, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    if (pErr) throw new Error(pErr.message);
    if (profileRows) matches.push(...profileRows);
  }
  if (matches.length === 0) return [];

  // 3. Cria follows (owner → casado). Trigger cuida da conquista first_friend.
  const follows = matches.map((m) => ({ follower_id: ownerId, followee_id: m.user_id }));
  const { error: fErr } = await supabase
    .from("follows")
    .upsert(follows, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
  if (fErr) throw new Error(fErr.message);

  return matches.map((m) => ({ user_id: m.user_id, full_name: m.full_name }));
}
