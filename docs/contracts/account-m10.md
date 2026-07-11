# Account API contract for M10

Backend scope: M6 — Backend LGPD + contratos para M10.

All endpoints require `Authorization: Bearer <supabase_access_token>`.

## GET /account/profile

Returns the current profile, settings and consent state used by the M10 Profile
and Settings screens.

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "profile": {
    "full_name": "Samuel",
    "username": "samuel",
    "avatar_url": null,
    "timezone": "America/Sao_Paulo",
    "day_start_hour": 4,
    "locale": "pt-BR",
    "created_at": "2026-07-07T12:00:00.000Z",
    "updated_at": "2026-07-07T12:00:00.000Z"
  },
  "private": {
    "phone_verified_at": null
  },
  "consents": {
    "terms": {
      "scope": "terms",
      "granted": true,
      "granted_at": "2026-07-07T12:00:00.000Z",
      "revoked_at": null,
      "policy_version": "v1.0"
    }
  },
  "account": {
    "delete_requested_at": null,
    "scheduled_purge_at": null
  }
}
```

Errors:

- `401 missing bearer token`
- `401 invalid token`
- `401 account_deleted`
- `404 profile_not_found`

## PATCH /account/settings

Updates profile settings.

Request:

```json
{
  "timezone": "America/Sao_Paulo",
  "day_start_hour": 4
}
```

Rules:

- At least one field is required.
- `timezone` must be a valid IANA timezone.
- `day_start_hour` must be an integer from `0` to `23`.

Response:

```json
{
  "settings": {
    "timezone": "America/Sao_Paulo",
    "day_start_hour": 4,
    "updated_at": "2026-07-07T12:00:00.000Z"
  }
}
```

## POST /account/consent

Grants or revokes a granular consent scope.

Request:

```json
{
  "scope": "marketing",
  "granted": false,
  "policy_version": "v1.0"
}
```

Scopes:

- `terms`
- `privacy`
- `marketing`
- `ai_processing`
- `data_export`

Rules:

- `terms` and `privacy` cannot be revoked through this endpoint. The user must
  delete the account if they no longer accept them.
- Revoking `ai_processing` is allowed and should make M10 disable AI-backed
  actions while keeping manual flows available.
- Exporting account data does not require a separate `data_export` consent.

Response:

```json
{
  "consent": {
    "scope": "marketing",
    "granted": false,
    "granted_at": "2026-07-07T12:00:00.000Z",
    "revoked_at": "2026-07-07T13:00:00.000Z",
    "policy_version": "v1.0"
  }
}
```

## GET /account/export

Returns a synchronous ZIP with JSON files only. No binary audio or image files
are included.

Response headers:

- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="fitbrother-export-YYYY-MM-DD.zip"`

Included files:

- `account.json`
- `profile.json`
- `profiles_private.json`
- `anthropometrics.json`
- `nutrition_goals.json`
- `subscriptions.json`
- `consents.json`
- `meals.json`
- `meal_items.json`
- `daily_summaries.json`
- `ai_usage.json`
- `ai_extraction_hits.json`
- `ai_insights.json`
- `user_achievements.json`
- `contact_links.json`
- `posts.json`
- `post_likes.json`
- `post_comments.json`
- `follows.json`
- `notifications.json`
- `push_tokens.json`
- `account_deletions.json`
- `account_audit_log.json`
- `storage_manifest.json`

Privacy rule:

- Follows include relationships where the user is one side.
- Posts include only posts owned by the user.
- Likes and comments include only likes/comments made by the user.
- `account_audit_log.json` is sanitized and does not include stack traces,
  tokens or raw export payloads.

## DELETE /account

Requests account deletion. The account is anonymized immediately and physically
purged after D+30.

Request:

```json
{
  "confirm": true,
  "reason": "optional"
}
```

Immediate effects:

- `profiles.full_name`, `profiles.username`, `profiles.avatar_url` are cleared.
- `profiles_private.phone_e164`, `phone_hash`, `phone_verified_at` are cleared.
- Meals, posts and comments made by the user are soft-deleted.
- Push tokens are revoked.
- Likes made by the user are deleted.
- Follows and contact links are deleted.
- Future authenticated requests return `401 account_deleted`.

Response:

```json
{
  "deleted": true,
  "requested_at": "2026-07-07T12:00:00.000Z",
  "scheduled_purge_at": "2026-08-06T12:00:00.000Z"
}
```
