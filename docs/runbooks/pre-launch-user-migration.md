# Pre-launch user migration runbook

Scope: mandatory safety checklist to run once, **before the first real
public user signs up**. M15/M16 shipped the calculation engine and safety
gates (`evaluateSafetyGates`, `computeTargets`) and the columns they need
(`anthropometrics`, `profiles.soft_mode`), but no existing account has ever
had them run against it — there are no real users yet, so M17 documents the
procedure instead of scheduling it. Do not skip this before opening
signups; do not run it speculatively before there's data to migrate.

## 1. Backfill derivable fields

Before running the gates, check whether any of the M15/M16 columns can be
filled in from data that already exists, instead of being left `NULL`.
Today none can — every new column was added nullable with no equivalent in
the old schema — but re-check this each time the schema grows before
launch, since a future migration might add a column that overlaps with
something already collected elsewhere.

Query to find accounts with gaps that would block an accurate gate
evaluation (missing the inputs `TargetsInput` requires):

```sql
select p.user_id, a.weight_kg, a.height_cm, p.birth_date, p.sex,
       p.activity_level, p.goal
from public.profiles p
join public.anthropometrics a on a.user_id = p.user_id
where a.weight_kg is null
   or a.height_cm is null
   or p.birth_date is null
   or p.sex is null
   or p.activity_level is null
   or p.goal is null
order by p.created_at;
```

Any row returned here cannot get an accurate `evaluateSafetyGates` result
in step 2 — treat those accounts as needing the incremental collection flow
(step 4) before they can be evaluated, not as a reason to block launch.

## 2. Run `evaluateSafetyGates` retroactively

For every account, in a script (not ad-hoc SQL — this needs the real TS
gate logic, not a reimplementation):

1. Load `anthropometrics` (latest row) and `profiles` for the user.
2. Build a `TargetsInput` the same way `buildTargetsInput`
   (`apps/server/src/services/targets.ts`) does from onboarding payloads —
   `sex`, age from `birth_date`, `weight_kg`, `height_cm`, `activity_level`,
   `goal`, plus the optional fields already on `anthropometrics`
   (`target_weight_kg`, `rate_kg_per_week`, `strength_training`,
   `is_pregnant_or_lactating`, `has_kidney_disease`, `has_type1_diabetes`,
   `uses_glp1`, `tca_screening_positive`).
3. Call `evaluateSafetyGates(input)` from `@fitbrother/shared`.
4. If any gate has `severity: "SOFT_MODE"`: set `profiles.soft_mode = true`.
   This is a safety correction, not a feature the user opted into — apply
   it unconditionally.
5. If any gate has `severity: "BLOCK"`: call `computeTargets(input)` — it
   already forces maintenance-level calories when a `BLOCK` gate fires — and
   carry the result into step 3 below instead of leaving the account on its
   old (unsafe) target.

## 3. Never overwrite goals silently

`nutrition_goals` is append-only: never `UPDATE` a row, always `INSERT` a
new one with `effective_from = today` and the previous row's
`effective_to` closed off. If step 2 produces different targets than what
the account currently has:

- Do **not** insert the new row automatically for the whole user base in
  one batch.
- Surface the comparison to the user first — "your targets are changing
  from X to Y because \<gate message\>" — and only insert the new
  `nutrition_goals` row after explicit confirmation.
- The one exception is a `BLOCK` gate: per the original spec, forcing
  maintenance calories for safety is not optional and does not wait for
  user confirmation, but the user must still be told why (surface
  `block_reason` from `computeTargets`).

## 4. Incremental collection of remaining fields

Migrated accounts never go through the new onboarding — fields like
`target_weight_kg`, `strength_training`, or the TCA screening stay `NULL`
until collected. Do not add a blocking modal on next login to fill these
in. Collect one field at a time, in the natural place a user would already
encounter it (e.g. the first time they open the goal screen in settings,
ask for `target_weight_kg`/`rate_kg_per_week` there; the first time they
touch a training-related screen, ask about `strength_training`). This
mirrors the "progressive profiling" principle from the original onboarding
spec — never a standalone form dump.
