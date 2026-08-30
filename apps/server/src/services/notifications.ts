import type { FastifyBaseLogger } from "fastify";
import { env } from "../lib/env.js";
import { supabaseService } from "../lib/supabase.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const RESEND_API_URL = "https://api.resend.com/emails";
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
    case "insight_ready":
      return {
        title: "Sua análise está pronta ✨",
        body: "Veja o que a IA achou do seu período no Fitbrother.",
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

type PendingEmailNotification = PendingNotification & { payload: { email?: string } };

/** Keyed on `kind` — só onboarding_reminder por enquanto (M17). */
function renderEmail(
  n: PendingEmailNotification,
): { subject: string; html: string; text: string } | null {
  switch (n.kind) {
    case "onboarding_reminder":
      return {
        subject: "Falta pouco pra terminar seu cadastro no Fitbrother",
        text: `Você começou a criar sua conta no Fitbrother mas não terminou o cadastro. Acesse ${env.APP_URL} pra continuar de onde parou.`,
        html: `<p>Você começou a criar sua conta no Fitbrother mas não terminou o cadastro.</p><p><a href="${env.APP_URL}">Continue de onde parou</a>.</p>`,
      };
    default:
      return null;
  }
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  // Sem chave configurada (dev local) — no-op silencioso, não é um erro.
  if (!env.RESEND_API_KEY) return false;
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text }),
  });
  return res.ok;
}

/**
 * Drain the email outbox: send every pending `channel='email'` notification
 * via Resend and stamp `sent_at`. Mesmo padrão de dispatchPendingPush, canal
 * separado.
 */
export async function dispatchPendingEmail(log: FastifyBaseLogger): Promise<number> {
  const supabase = supabaseService();

  const { data: pending, error } = await supabase
    .from("notifications")
    .select("id, user_id, kind, template, payload")
    .eq("channel", "email")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    log.error({ err: error }, "dispatch_email_query_failed");
    throw new Error(error.message);
  }
  if (!pending || pending.length === 0) return 0;

  let sent = 0;
  for (const n of pending as PendingEmailNotification[]) {
    const stamp: { sent_at: string; error: string | null } = {
      sent_at: new Date().toISOString(),
      error: null,
    };

    const to = n.payload.email;
    const rendered = to ? renderEmail(n) : null;

    if (!to || !rendered) {
      stamp.error = "missing_email_or_template";
    } else {
      try {
        const ok = await sendEmail(to, rendered.subject, rendered.html, rendered.text);
        if (ok) sent += 1;
        else stamp.error = "email_send_failed";
      } catch (err) {
        stamp.error = err instanceof Error ? err.message : "email_send_failed";
        log.error({ err, notificationId: n.id }, "email_send_failed");
      }
    }

    await supabase.from("notifications").update(stamp).eq("id", n.id);
  }

  log.info({ processed: pending.length, sent }, "dispatch_email_done");
  return pending.length;
}
