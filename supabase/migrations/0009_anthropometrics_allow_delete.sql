-- M1 §database. The DELETE block on `anthropometrics` was too aggressive:
-- it stops ON DELETE CASCADE from auth.users, which is what LGPD §7.4 (account
-- delete) needs. The append-only invariant only requires blocking UPDATE so
-- the historical bmr/tdee snapshots stay immutable; DELETE on user removal
-- is fine because the parent row also disappears.
DROP TRIGGER IF EXISTS anthropometrics_no_delete ON public.anthropometrics;
