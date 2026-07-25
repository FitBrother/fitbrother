# LGPD runbook

Scope: M6 backend LGPD endpoints and retention jobs.

## Export failed

Symptoms:

- `GET /account/export` returns `500 account_export_failed`.
- Backend log event: `account_export_failed`.
- Audit row: `account_export` with `status = failed`.

Checks:

1. Confirm the user is not deleted:
   ```sql
   select * from public.account_deletions where user_id = '<user_id>';
   ```
2. Check the failing table or storage bucket in the backend error log.
3. Verify Supabase service-role env vars are loaded by the server.

Expected behavior:

- Export is synchronous.
- Export includes JSON only; binary files are represented in `storage_manifest.json`.

## Delete requested

Symptoms:

- `DELETE /account` returns `deleted: true`.
- Later normal requests return `401 account_deletion_pending`.

Checks:

```sql
select * from public.account_deletions where user_id = '<user_id>';
select user_id, full_name, username, avatar_url from public.profiles where user_id = '<user_id>';
select user_id, phone_e164, phone_hash, phone_verified_at from public.profiles_private where user_id = '<user_id>';
```

Expected immediate effects:

- The account is hidden from every public/social surface.
- Identity and phone fields are retained only for possible reactivation.
- Meals/posts/comments are soft-deleted.
- Push tokens are revoked.
- Likes/follows/contact links remain stored but invisible.

## Reactivation

Endpoint: `POST /account/deletion/cancel`.

The user signs in again with password or OAuth. A valid login is expected:
normal routes return `account_deletion_pending`, while deletion state, export
and cancellation remain available.

Checks:

```sql
select requested_at, scheduled_purge_at, cancelled_at
from public.account_deletions
where user_id = '<user_id>';
```

Cancellation must restore only rows carrying the current
`account_deleted_at`. Rows deleted before the account request must remain
deleted. The app registers its push token again after reactivation.

## Purge D+30

Queue: `purge-accounts`.

Schedule: daily at `03:15 UTC`.

Expected behavior:

- Deletes user-owned objects from `meal-audios` and `post-images`.
- Calls Supabase Auth admin delete for the user.
- FK cascades physically remove application rows.
- `account_audit_log` keeps a minimal operational trace with `user_id` set null
  after the auth user is deleted.

Manual due-user query:

```sql
select user_id, requested_at, scheduled_purge_at
from public.account_deletions
where scheduled_purge_at <= now()
  and purged_at is null
order by scheduled_purge_at;
```

## Audio deleted

Queue: `purge-audios`.

Schedule: daily at `03:30 UTC`.

Expected behavior:

- Deletes `meal-audios` objects older than 30 days.
- Marks `meals.audio_deleted_at`.
- Keeps `meals.audio_path` as historical metadata.

Manual pending-audio query:

```sql
select id, user_id, audio_path, created_at
from public.meals
where audio_path is not null
  and audio_deleted_at is null
  and created_at < now() - interval '30 days'
order by created_at
limit 100;
```

## Consent revoked

Endpoint: `POST /account/consent`.

Rules:

- `terms`, `privacy` and `ai_processing` return
  `409 consent_required_for_service` when revoked.
- AI processing is core functionality and has no disable toggle.
- `marketing` can be granted/revoked.
- `data_export` is tracked but export does not require it.

Current-state query:

```sql
select distinct on (scope)
  scope, granted_at, revoked_at, policy_version
from public.consent_log
where user_id = '<user_id>'
order by scope, granted_at desc;
```
