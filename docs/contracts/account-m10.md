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
- `401 account_deletion_pending`
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

- `terms`, `privacy` and `ai_processing` cannot be revoked through this
  endpoint. AI processing is part of the product core and is not represented
  as a toggle in M10. The user must delete the account if they no longer accept
  any mandatory consent.
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
purged after D+30. A recent, one-use authorization obtained with the user's
password or a linked Google/Apple identity is mandatory.

Request:

```json
{
  "confirm": true,
  "authorization_token": "opaque-one-use-token",
  "reason": "optional"
}
```

Immediate effects:

- The account disappears from public profiles, search, feed, ranking and
  contact discovery.
- Identity and private fields are retained, inaccessible, for reactivation
  during the 30-day window.
- Meals, posts and comments made by the user are soft-deleted by the deletion
  cycle.
- Push tokens are revoked.
- Likes, follows and contact links are retained but hidden.
- Future normal requests return `401 account_deletion_pending`.
- Export, deletion status and reactivation remain available.

Response:

```json
{
  "deleted": true,
  "requested_at": "2026-07-07T12:00:00.000Z",
  "scheduled_purge_at": "2026-08-06T12:00:00.000Z"
}
```

## Recent authorization for deletion

All authorization and challenge tokens expire after five minutes and can only
be used once.

### POST /account/deletion/authorize/password

Request `{ "password": "..." }`. The backend verifies the password with
Supabase and returns `{ "authorization_token": "...", "expires_at": "..." }`.
Passwords and authorization tokens are redacted from logs.

### POST /account/deletion/authorize/oauth/start

Request `{ "provider": "google" }` or `{ "provider": "apple" }`. Returns an
OAuth challenge token. The mobile app must then complete a fresh provider login.

### POST /account/deletion/authorize/oauth/complete

Request `{ "provider": "google", "challenge_token": "..." }` using the newly
created Supabase session. The backend validates the same user, linked provider,
new session and challenge lifetime, then returns the one-use deletion
authorization.

## PATCH /account/profile

Updates the avatar storage path. M10 accepts only `"{auth.uid()}/avatar.jpg"` or
`null`; replaced/removed avatar objects are cleaned from the private
`post-images` bucket.

## GET /account/deletion

Available after login even while deletion is pending.

```json
{
  "pending": true,
  "requested_at": "2026-07-07T12:00:00.000Z",
  "scheduled_purge_at": "2026-08-06T12:00:00.000Z",
  "can_reactivate": true
}
```

## POST /account/deletion/cancel

Reactivates a pending account before the D+30 deadline. No request body.

```json
{
  "reactivated": true,
  "cancelled_at": "2026-07-10T12:00:00.000Z"
}
```

M10 flow:

1. User signs in again with email/password or OAuth.
2. A normal account request returns `account_deletion_pending`.
3. M10 asks whether the user wants to reactivate.
4. Confirmation calls this endpoint.
5. The app reloads the profile and registers its push token again.
