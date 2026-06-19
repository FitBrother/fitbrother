import type { FastifyBaseLogger } from "fastify";
import { supabaseService } from "../lib/supabase.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH = 100;

type PendingNotification = {
  id: string;
  user_id: string;
  kind: string;
  template: string;
  payload: Record<string, unknown>;
};

type ExpoMessage = { to: string; title: string; body: string; data: Record<string, unknown> };

/**
 * Render a notification row into the Expo push title/body. Keyed on `kind`;
 * M5.2 only produces `achievement`, M5.3 adds streak_alert / goal_reminder.
 */
function renderPush(n: PendingNotification): { title: string; body: string } {
  switch (n.kind) {
    case "achievement":
      return {
        title: "Nova conquista! 🏆",
        body: String(n.payload.title ?? "Você desbloqueou uma conquista."),
      };
    case "streak_alert":
      return {
        title: "Sua ofensiva está em risco! 🔥",
        body: "Registre uma refeição hoje pra não perder a sequência.",
      };
    case "goal_reminder":
      return {
        title: "Faltam macros pra meta de hoje",
        body: "Você ainda não chegou perto da sua meta. Bora?",
      };
    case "friend_activity":
      return {
        title: "Seu contato entrou no Fitbrother 👋",
        body: `${String(n.payload.full_name ?? "Um contato")} agora está no Fitbrother.`,
      };
    case "post_like":
      return {
        title: "Curtiram seu post 👏",
        body: "Alguém curtiu seu post no feed.",
      };
    case "post_comment":
      return {
        title: "Comentário novo 💬",
        body: String(n.payload.excerpt ?? "Alguém comentou no seu post."),
      };
    default:
      return { title: "Fitbrother", body: String(n.payload.body ?? "") };
  }
}

/**
 * Drain the push outbox: send every pending `channel='push'` notification via
 * Expo Push and stamp `sent_at`. WA is paused (M4), so only push is handled.
 *
 * A notification for a user with no active token can never be delivered — it's
 * stamped sent with error='no_active_tokens' so it doesn't requeue forever.
 */
export async function dispatchPendingPush(log: FastifyBaseLogger): Promise<number> {
  const supabase = supabaseService();

  const { data: pending, error } = await supabase
    .from("notifications")
    .select("id, user_id, kind, template, payload")
    .eq("channel", "push")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    log.error({ err: error }, "dispatch_query_failed");
    throw new Error(error.message);
  }
  if (!pending || pending.length === 0) return 0;

  // Active tokens for the users in this batch, fetched once.
  const userIds = [...new Set(pending.map((n) => n.user_id))];
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", userIds)
    .is("revoked_at", null);

  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens ?? []) {
    const list = tokensByUser.get(t.user_id) ?? [];
    list.push(t.token);
    tokensByUser.set(t.user_id, list);
  }

  let sent = 0;
  for (const n of pending as PendingNotification[]) {
    const userTokens = tokensByUser.get(n.user_id) ?? [];
    const stamp: { sent_at: string; error: string | null } = {
      sent_at: new Date().toISOString(),
      error: null,
    };

    if (userTokens.length === 0) {
      stamp.error = "no_active_tokens";
    } else {
      const { title, body } = renderPush(n);
      const messages: ExpoMessage[] = userTokens.map((to) => ({
        to,
        title,
        body,
        data: { kind: n.kind, ...n.payload },
      }));
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(messages),
        });
        if (!res.ok) stamp.error = `expo_${res.status}`;
        else sent += 1;
      } catch (err) {
        stamp.error = err instanceof Error ? err.message : "expo_send_failed";
        log.error({ err, notificationId: n.id }, "expo_push_failed");
      }
    }

    await supabase.from("notifications").update(stamp).eq("id", n.id);
  }

  log.info({ processed: pending.length, sent }, "dispatch_done");
  return pending.length;
}
