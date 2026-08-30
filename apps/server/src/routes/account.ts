import {
  AuthorizeAccountDeletionPasswordRequestSchema,
  CompleteAccountDeletionOAuthRequestSchema,
  DeleteAccountRequestSchema,
  PatchAccountProfileRequestSchema,
  PatchAccountSettingsRequestSchema,
  PostAccountConsentRequestSchema,
  StartAccountDeletionOAuthRequestSchema,
  type ConsentScope,
} from "@fitbrother/shared";
import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import JSZip from "jszip";
import { z } from "zod";
import { activeAccountRequired, authTokenRequired } from "../lib/auth.js";
import { internalError } from "../lib/errors.js";
import { Sentry } from "../lib/sentry.js";
import { supabaseAnonymous, supabaseFromJwt, supabaseService } from "../lib/supabase.js";

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
      return internalError(reply, req.log, firstError, {
        user_id: userId,
        where: "account_profile",
      });
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
      return internalError(reply, req.log, error, { user_id: userId, where: "account_settings" });
    }

    await auditAccountAction(req, "account_settings", "success", {
      fields: Object.keys(patch),
    });
    return reply.send({ settings: data });
  });

  app.patch("/account/profile", activeAccount, async (req, reply) => {
    const parsed = PatchAccountProfileRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }
    const userId = req.user!.id;
    const nextPath = parsed.data.avatar_url;
    if (nextPath !== null && !isOwnedAvatarPath(nextPath, userId)) {
      return reply.code(400).send({ error: "invalid_avatar_path" });
    }

    const admin = supabaseService();
    const { data: previous, error: readError } = await admin
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", userId)
      .single();
    if (readError)
      return internalError(reply, req.log, readError, { where: "account_profile_avatar_read" });

    const { data, error } = await admin
      .from("profiles")
      .update({ avatar_url: nextPath })
      .eq("user_id", userId)
      .select("avatar_url, updated_at")
      .single();
    if (error)
      return internalError(reply, req.log, error, { where: "account_profile_avatar_update" });

    const oldPath = previous.avatar_url as string | null;
    if (oldPath && oldPath !== nextPath && isOwnedAvatarPath(oldPath, userId)) {
      const { error: storageError } = await admin.storage.from("post-images").remove([oldPath]);
      if (storageError) {
        req.log.warn({ err: storageError, user_id: userId }, "old_avatar_cleanup_failed");
      }
    }
    await auditAccountAction(req, "account_profile", "success", { avatar_changed: true });
    return reply.send({ profile: data });
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
        return internalError(reply, req.log, error, {
          user_id: userId,
          scope,
          where: "account_consent_grant",
        });
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
        return internalError(reply, req.log, error, {
          user_id: userId,
          scope,
          where: "account_consent_revoke",
        });
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
    if (error) return internalError(reply, req.log, error, { where: "account_deletion_get" });
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

  app.post(
    "/account/deletion/authorize/password",
    {
      ...activeAccount,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const parsed = AuthorizeAccountDeletionPasswordRequestSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_payload" });
      if (!req.user!.email) return reply.code(409).send({ error: "password_not_available" });

      const { data, error } = await supabaseAnonymous().auth.signInWithPassword({
        email: req.user!.email,
        password: parsed.data.password,
      });
      if (error || data.user?.id !== req.user!.id) {
        return reply.code(401).send({ error: "invalid_password" });
      }
      const authorization = await createAuthorization(req.user!.id, "password");
      return reply.header("Cache-Control", "no-store").send(authorization);
    },
  );

  app.post("/account/deletion/authorize/oauth/start", activeAccount, async (req, reply) => {
    const parsed = StartAccountDeletionOAuthRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_payload" });
    const claims = jwtClaims(req.user!.accessToken);
    const challenge = await createAuthorization(
      req.user!.id,
      "oauth_challenge",
      parsed.data.provider,
      typeof claims.session_id === "string" ? claims.session_id : null,
    );
    return reply.header("Cache-Control", "no-store").send({
      challenge_token: challenge.authorization_token,
      expires_at: challenge.expires_at,
    });
  });

  app.post("/account/deletion/authorize/oauth/complete", activeAccount, async (req, reply) => {
    const parsed = CompleteAccountDeletionOAuthRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_payload" });
    const admin = supabaseService();
    const challengeHash = hashToken(parsed.data.challenge_token);
    const { data: challenge, error } = await admin
      .from("account_action_authorizations")
      .select("id, user_id, provider, original_session_id, created_at, expires_at, consumed_at")
      .eq("token_hash", challengeHash)
      .eq("method", "oauth_challenge")
      .maybeSingle();
    const claims = jwtClaims(req.user!.accessToken);
    const appMetadata =
      claims.app_metadata && typeof claims.app_metadata === "object"
        ? (claims.app_metadata as Record<string, unknown>)
        : {};
    const identities =
      (await admin.auth.admin.getUserById(req.user!.id)).data.user?.identities ?? [];
    const providerLinked = identities.some(
      (identity) => identity.provider === parsed.data.provider,
    );
    const freshSession =
      typeof claims.session_id === "string" &&
      claims.session_id !== challenge?.original_session_id &&
      typeof claims.iat === "number" &&
      claims.iat * 1000 >= new Date(challenge?.created_at ?? 0).getTime() - 1000 &&
      appMetadata.provider === parsed.data.provider;
    if (
      error ||
      !challenge ||
      challenge.user_id !== req.user!.id ||
      challenge.provider !== parsed.data.provider ||
      challenge.consumed_at ||
      new Date(challenge.expires_at) <= new Date() ||
      !providerLinked ||
      !freshSession
    ) {
      return reply.code(401).send({ error: "oauth_reauthentication_invalid" });
    }
    const { data: consumed, error: consumeError } = await admin
      .from("account_action_authorizations")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id)
      .is("consumed_at", null)
      .select("id")
      .maybeSingle();
    if (consumeError || !consumed) {
      return reply.code(401).send({ error: "oauth_reauthentication_invalid" });
    }
    return reply
      .header("Cache-Control", "no-store")
      .send(await createAuthorization(req.user!.id, "oauth", parsed.data.provider));
  });

  app.delete("/account", tokenOnly, async (req, reply) => {
    const parsed = DeleteAccountRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }

    const userId = req.user!.id;
    const tokenHash = hashToken(parsed.data.authorization_token);
    const { data: authorized, error: authorizationError } = await supabaseForToken(req).rpc(
      "fitbrother_consume_account_action_authorization",
      { p_token_hash: tokenHash, p_action: "account_delete" },
    );
    if (authorizationError || authorized !== true) {
      return reply.code(401).send({ error: "deletion_authorization_invalid" });
    }
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

export function isOwnedAvatarPath(path: string, userId: string): boolean {
  return path === `${userId}/avatar.jpg`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function createAuthorization(
  userId: string,
  method: "password" | "oauth_challenge" | "oauth",
  provider?: "google" | "apple",
  originalSessionId?: string | null,
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const { error } = await supabaseService()
    .from("account_action_authorizations")
    .insert({
      user_id: userId,
      action: "account_delete",
      method,
      provider: provider ?? null,
      token_hash: hashToken(token),
      original_session_id: originalSessionId ?? null,
      expires_at: expiresAt,
    });
  if (error) throw new Error(error.message);
  return { authorization_token: token, expires_at: expiresAt };
}

export function jwtClaims(accessToken: string): Record<string, unknown> {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return {};
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
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
