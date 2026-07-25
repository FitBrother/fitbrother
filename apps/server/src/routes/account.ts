import {
  DeleteAccountRequestSchema,
  PatchAccountSettingsRequestSchema,
  PostAccountConsentRequestSchema,
  type ConsentScope,
} from "@fitbrother/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import JSZip from "jszip";
import { z } from "zod";
import { activeAccountRequired, authTokenRequired } from "../lib/auth.js";
import { Sentry } from "../lib/sentry.js";
import { supabaseFromJwt, supabaseService } from "../lib/supabase.js";

const CONSENT_SCOPES = [
  "terms",
  "privacy",
  "marketing",
  "ai_processing",
  "data_export",
] as const satisfies readonly ConsentScope[];

const NON_REVOKABLE_SCOPES = new Set<ConsentScope>(["terms", "privacy", "ai_processing"]);

type ConsentLogRow = {
  scope: ConsentScope;
  granted_at: string;
  revoked_at: string | null;
  policy_version: string;
};

type ConsentState = {
  scope: ConsentScope;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  policy_version: string | null;
};

const ExportTableSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
});

export async function accountRoutes(app: FastifyInstance) {
  const activeAccount = { preHandler: [authTokenRequired, activeAccountRequired] };
  const tokenOnly = { preHandler: [authTokenRequired] };

  app.get("/account/profile", activeAccount, async (req, reply) => {
    const userId = req.user!.id;
    const admin = supabaseService();

    Sentry.addBreadcrumb({ category: "account", message: "profile_read" });
    const [profileQ, privateQ, consentQ, deletionQ] = await Promise.all([
      admin
        .from("profiles")
        .select(
          "full_name, username, avatar_url, timezone, day_start_hour, locale, created_at, updated_at",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("profiles_private")
        .select("phone_verified_at")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("consent_log")
        .select("scope, granted_at, revoked_at, policy_version")
        .eq("user_id", userId)
        .order("granted_at", { ascending: false }),
      admin
        .from("account_deletions")
        .select("requested_at, scheduled_purge_at")
        .eq("user_id", userId)
        .is("cancelled_at", null)
        .is("purged_at", null)
        .maybeSingle(),
    ]);

    const firstError = profileQ.error ?? privateQ.error ?? consentQ.error ?? deletionQ.error;
    if (firstError) {
      req.log.error({ err: firstError, user_id: userId }, "account_profile_failed");
      return reply.code(500).send({ error: firstError.message });
    }
    if (!profileQ.data) return reply.code(404).send({ error: "profile_not_found" });

    return reply.send({
      user: { id: userId, email: req.user!.email },
      profile: profileQ.data,
      private: { phone_verified_at: privateQ.data?.phone_verified_at ?? null },
      consents: currentConsentState((consentQ.data ?? []) as ConsentLogRow[]),
      account: {
        delete_requested_at: deletionQ.data?.requested_at ?? null,
        scheduled_purge_at: deletionQ.data?.scheduled_purge_at ?? null,
      },
    });
  });

  app.patch("/account/settings", activeAccount, async (req, reply) => {
    const parsed = PatchAccountSettingsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.code(400).send({ error: "empty_patch" });
    }
    if (parsed.data.timezone && !isValidTimeZone(parsed.data.timezone)) {
      return reply.code(400).send({ error: "invalid_timezone" });
    }

    const userId = req.user!.id;
    const admin = supabaseService();
    const patch: Record<string, unknown> = {};
    if (parsed.data.timezone) patch.timezone = parsed.data.timezone;
    if (parsed.data.day_start_hour !== undefined) patch.day_start_hour = parsed.data.day_start_hour;

    req.log.info(
      { user_id: userId, request_id: req.id, action: "account_settings" },
      "account_action",
    );
    Sentry.addBreadcrumb({ category: "account", message: "settings_update" });

    const { data, error } = await admin
      .from("profiles")
      .update(patch)
      .eq("user_id", userId)
      .select("timezone, day_start_hour, updated_at")
      .single();

    if (error) {
      await auditAccountAction(req, "account_settings", "failed", { error: error.message });
      req.log.error({ err: error, user_id: userId, request_id: req.id }, "account_settings_failed");
      return reply.code(500).send({ error: error.message });
    }

    await auditAccountAction(req, "account_settings", "success", {
      fields: Object.keys(patch),
    });
    return reply.send({ settings: data });
  });

  app.post("/account/consent", activeAccount, async (req, reply) => {
    const parsed = PostAccountConsentRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }

    const { scope, granted, policy_version } = parsed.data;
    if (!granted && NON_REVOKABLE_SCOPES.has(scope)) {
      return reply.code(409).send({ error: "consent_required_for_service", scope });
    }

    const userId = req.user!.id;
    const admin = supabaseService();
    req.log.info(
      { user_id: userId, request_id: req.id, action: "account_consent", scope, granted },
      "account_action",
    );
    Sentry.addBreadcrumb({
      category: "account",
      message: "consent_update",
      data: { scope, granted },
    });

    if (granted) {
      const { error } = await admin.from("consent_log").insert({
        user_id: userId,
        scope,
        policy_version,
      });
      if (error) {
        await auditAccountAction(req, "account_consent", "failed", { scope, error: error.message });
        req.log.error({ err: error, user_id: userId, scope }, "account_consent_grant_failed");
        return reply.code(500).send({ error: error.message });
      }
    } else {
      const { error } = await admin
        .from("consent_log")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("scope", scope)
        .is("revoked_at", null);
      if (error) {
        await auditAccountAction(req, "account_consent", "failed", { scope, error: error.message });
        req.log.error({ err: error, user_id: userId, scope }, "account_consent_revoke_failed");
        return reply.code(500).send({ error: error.message });
      }
    }

    const consent = await loadConsentState(userId, scope);
    await auditAccountAction(req, "account_consent", "success", { scope, granted });
    return reply.send({ consent });
  });

  app.get("/account/export", tokenOnly, async (req, reply) => {
    const userId = req.user!.id;
    req.log.info(
      { user_id: userId, request_id: req.id, action: "account_export" },
      "account_action",
    );
    Sentry.addBreadcrumb({ category: "account", message: "export_started" });

    try {
      const zipBuffer = await buildAccountExport(userId, req.user!.email);
      await auditAccountAction(req, "account_export", "success", { files: zipBuffer.files });

      const date = new Date().toISOString().slice(0, 10);
      reply
        .header("Content-Type", "application/zip")
        .header("Content-Disposition", `attachment; filename="fitbrother-export-${date}.zip"`)
        .header("Cache-Control", "no-store");
      return reply.send(zipBuffer.buffer);
    } catch (err) {
      await auditAccountAction(req, "account_export", "failed", {
        error: err instanceof Error ? err.message : "unknown_error",
      });
      req.log.error({ err, user_id: userId, request_id: req.id }, "account_export_failed");
      Sentry.captureException(err);
      return reply.code(500).send({ error: "account_export_failed" });
    }
  });

  app.get("/account/deletion", tokenOnly, async (req, reply) => {
    const { data, error } = await supabaseService()
      .from("account_deletions")
      .select("requested_at, scheduled_purge_at")
      .eq("user_id", req.user!.id)
      .is("cancelled_at", null)
      .is("purged_at", null)
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({
      pending: Boolean(data),
      requested_at: data?.requested_at ?? null,
      scheduled_purge_at: data?.scheduled_purge_at ?? null,
      can_reactivate: Boolean(data) && new Date(data!.scheduled_purge_at) > new Date(),
    });
  });

  app.post("/account/deletion/cancel", tokenOnly, async (req, reply) => {
    const client = supabaseForToken(req);
    const { data, error } = await client.rpc("fitbrother_cancel_account_deletion", {
      p_request_id: req.id,
    });
    if (error) {
      const expired = error.message.includes("purge window expired");
      return reply.code(expired ? 409 : 500).send({
        error: expired ? "account_reactivation_expired" : "account_reactivation_failed",
      });
    }
    const row = Array.isArray(data) ? data[0] : data;
    return reply.send({
      reactivated: row?.reactivated ?? false,
      cancelled_at: row?.cancelled_at ?? null,
    });
  });

  app.delete("/account", tokenOnly, async (req, reply) => {
    const parsed = DeleteAccountRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }

    const userId = req.user!.id;
    req.log.info(
      { user_id: userId, request_id: req.id, action: "account_delete" },
      "account_action",
    );
    Sentry.addBreadcrumb({ category: "account", message: "delete_requested" });

    const { data, error } = await supabaseForToken(req).rpc("fitbrother_request_account_deletion", {
      p_reason: parsed.data.reason ?? null,
      p_request_id: req.id,
    });

    if (error) {
      req.log.error({ err: error, user_id: userId }, "account_delete_mark_failed");
      return reply.code(500).send({ error: "account_delete_failed" });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return reply.send({
      deleted: true,
      requested_at: row.requested_at,
      scheduled_purge_at: row.scheduled_purge_at,
    });
  });
}

function currentConsentState(rows: ConsentLogRow[]): Record<ConsentScope, ConsentState> {
  const result = Object.fromEntries(
    CONSENT_SCOPES.map((scope) => [
      scope,
      {
        scope,
        granted: false,
        granted_at: null,
        revoked_at: null,
        policy_version: null,
      },
    ]),
  ) as Record<ConsentScope, ConsentState>;

  for (const scope of CONSENT_SCOPES) {
    const latest = rows.find((row) => row.scope === scope);
    if (!latest) continue;
    result[scope] = {
      scope,
      granted: latest.revoked_at == null,
      granted_at: latest.granted_at,
      revoked_at: latest.revoked_at,
      policy_version: latest.policy_version,
    };
  }

  return result;
}

async function loadConsentState(userId: string, scope: ConsentScope): Promise<ConsentState> {
  const { data, error } = await supabaseService()
    .from("consent_log")
    .select("scope, granted_at, revoked_at, policy_version")
    .eq("user_id", userId)
    .eq("scope", scope)
    .order("granted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return currentConsentState(data ? ([data] as ConsentLogRow[]) : [])[scope];
}

async function auditAccountAction(
  req: FastifyRequest,
  action: string,
  status: string,
  metadata: Record<string, unknown> = {},
) {
  if (!req.user) return;
  const { error } = await supabaseService().from("account_audit_log").insert({
    user_id: req.user.id,
    action,
    status,
    request_id: req.id,
    metadata,
  });
  if (error) {
    req.log.warn({ err: error, action, status, user_id: req.user.id }, "account_audit_failed");
  }
}

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

async function queryExportTable(
  table: string,
  column: string,
  userId: string,
  select = "*",
): Promise<unknown[]> {
  const rows: unknown[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseService()
      .from(table)
      .select(select)
      .eq(column, userId)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = ExportTableSchema.parse({ data: data ?? [] }).data;
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function buildAccountExport(
  userId: string,
  email: string | null,
): Promise<{ buffer: Buffer; files: string[] }> {
  const admin = supabaseService();
  const zip = new JSZip();
  const files: string[] = [];

  function addJson(path: string, value: unknown) {
    files.push(path);
    zip.file(path, `${JSON.stringify(value, null, 2)}\n`);
  }

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userId);
  if (authError) throw new Error(`auth_user: ${authError.message}`);
  addJson("account.json", {
    exported_at: new Date().toISOString(),
    user: {
      id: userId,
      email,
      created_at: authUser.user?.created_at ?? null,
      last_sign_in_at: authUser.user?.last_sign_in_at ?? null,
    },
  });

  const simpleTables: Array<[string, string, string]> = [
    ["profile.json", "profiles", "user_id"],
    ["profiles_private.json", "profiles_private", "user_id"],
    ["anthropometrics.json", "anthropometrics", "user_id"],
    ["nutrition_goals.json", "nutrition_goals", "user_id"],
    ["subscriptions.json", "subscriptions", "user_id"],
    ["consents.json", "consent_log", "user_id"],
    ["daily_summaries.json", "daily_summaries", "user_id"],
    ["streaks.json", "streaks", "user_id"],
    ["ai_usage.json", "ai_usage", "user_id"],
    ["ai_extraction_hits.json", "ai_extraction_hits", "user_id"],
    ["ai_insights.json", "ai_insights", "user_id"],
    ["user_achievements.json", "user_achievements", "user_id"],
    ["contact_links.json", "contact_links", "owner_id"],
    ["posts.json", "posts", "user_id"],
    ["post_likes.json", "post_likes", "user_id"],
    ["post_comments.json", "post_comments", "user_id"],
    ["notifications.json", "notifications", "user_id"],
    ["push_tokens.json", "push_tokens", "user_id"],
    ["account_deletions.json", "account_deletions", "user_id"],
  ];

  for (const [file, table, column] of simpleTables) {
    addJson(file, await queryExportTable(table, column, userId));
  }

  const meals = await queryExportTable("meals", "user_id", userId);
  addJson("meals.json", meals);
  const mealIds = meals
    .map((meal) => (meal as Record<string, unknown>).id)
    .filter((id): id is string => typeof id === "string");
  if (mealIds.length > 0) {
    const { data, error } = await admin.from("meal_items").select("*").in("meal_id", mealIds);
    if (error) throw new Error(`meal_items: ${error.message}`);
    addJson("meal_items.json", data ?? []);
  } else {
    addJson("meal_items.json", []);
  }

  const { data: follows, error: followsError } = await admin
    .from("follows")
    .select("*")
    .or(`follower_id.eq.${userId},followee_id.eq.${userId}`);
  if (followsError) throw new Error(`follows: ${followsError.message}`);
  addJson("follows.json", follows ?? []);

  const { data: audit, error: auditError } = await admin
    .from("account_audit_log")
    .select("action, status, request_id, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (auditError) throw new Error(`account_audit_log: ${auditError.message}`);
  addJson("account_audit_log.json", sanitizeAuditRows(audit ?? []));

  const storageManifest = await buildStorageManifest(userId);
  addJson("storage_manifest.json", storageManifest);

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer, files };
}

function sanitizeAuditRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    action: row.action,
    status: row.status,
    request_id: row.request_id,
    created_at: row.created_at,
    metadata: row.metadata,
  }));
}

async function buildStorageManifest(userId: string): Promise<Record<string, unknown>> {
  return {
    note: "Export M6 inclui apenas JSON. Arquivos binarios nao sao anexados.",
    buckets: {
      "meal-audios": await listStorageObjects("meal-audios", userId),
      "post-images": await listStorageObjects("post-images", userId),
    },
  };
}

async function listStorageObjects(bucket: string, userId: string): Promise<unknown[]> {
  const result: unknown[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseService()
      .storage.from(bucket)
      .list(userId, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) throw new Error(`${bucket}: ${error.message}`);
    for (const obj of data ?? []) {
      result.push({
        path: `${userId}/${obj.name}`,
        id: obj.id,
        name: obj.name,
        size: obj.metadata?.size ?? null,
        mimetype: obj.metadata?.mimetype ?? null,
        created_at: obj.created_at ?? null,
        updated_at: obj.updated_at ?? null,
      });
    }
    if ((data ?? []).length < pageSize) break;
  }
  return result;
}

function supabaseForToken(req: FastifyRequest) {
  if (!req.user) throw new Error("authenticated request required");
  return supabaseFromJwt(req.user.accessToken);
}
