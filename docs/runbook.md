# Fitbrother operational runbook

This runbook covers the code-ready M6 behavior. Production provisioning,
external Sentry setup, alert webhooks, stores, Meta and PITR are deferred.

## LGPD and retention

See [`runbooks/lgpd.md`](runbooks/lgpd.md) for export, reversible deletion,
reactivation, D+30 purge, audio retention and consent.

## Pre-launch user migration

See [`runbooks/pre-launch-user-migration.md`](runbooks/pre-launch-user-migration.md)
for the mandatory safety checklist (retroactive `evaluateSafetyGates`,
goal-recalculation confirmation flow, incremental field collection) to run
once before the first real public user signs up.

## AI quota exhausted

Symptoms:

- API returns `429 AI_QUOTA_EXCEEDED`;
- structured log contains the quota kind;
- provider is not called after the cap check fails.

Checks:

```sql
select *
from public.ai_usage
where day >= current_date - 2
order by day desc, updated_at desc;
```

Do not manually zero usage without confirming whether the record is incorrect.
Compare it with `ai_extractions`, `transcriptions` and `metrics_daily`.

## Daily metrics missing or divergent

Queue: `metrics-daily`, scheduled at `04:00 UTC`. It computes the previous UTC
day and is idempotent.

```sql
select *
from public.metrics_daily
where day = current_date - 1
order by metric, source, stage, provider, model;

select public.fitbrother_compute_metrics_daily(current_date - 1);
```

Re-running replaces the selected day. `metrics_daily` must never contain
`user_id`, email, raw input or file paths.

## Pipeline failure

Correlate by `request_id`, then inspect structured fields:

```text
user_id, meal_id, source, stage, provider, model,
duration_ms, success, error_code
```

Expected stages are transcription, extraction, catalog, persistence and total.
Authorization headers, tokens, phone, email, raw meal text and provider payloads
must be redacted.

If Sentry is configured, the event must carry `request_id` and the authenticated
`user_id`, with stage breadcrumbs in order.

## RLS suspected

1. Reproduce with a disposable local user.
2. Compare the user-scoped query with service-role output.
3. Inspect policies and `auth.uid()`.
4. Never solve an owner query by moving it to service role without an explicit
   server-side ownership check.
5. Verify a second user cannot read or mutate the row.

## Audio recovery

Before 30 days, an existing object may still be downloaded under its owner
policy. After `purge-audios` succeeds, the object is intentionally
unrecoverable and `meals.audio_deleted_at` is the marker. If Storage removal
fails, the worker must not set that marker and a retry is safe.

## Worker failure

All workers log a completion summary. Retention workers are retry-safe:

- Storage already empty is success;
- account purge records attempt/error state before retry;
- cancelled deletion cycles are never selected;
- audio metadata changes only after Storage succeeds.

## WhatsApp webhook

`wa_messages` and stuck-webhook alerts are not part of M6. They return with the
paused M4 WhatsApp implementation.
