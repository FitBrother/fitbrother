// Mobile-side constants that must stay in sync with FEATURES.md / SQL.
// When any of these change, bump the value here and update the matching
// backend reference (commit message should call out both).

/** Version of the terms / privacy / AI-processing policy the user is consenting
    to. Logged into `consent_log.policy_version`. Bump on every legal change. */
export const POLICY_VERSION = "v1.0";

/** Fetch timeout for backend calls — keeps the UI from hanging forever on a
    silent network drop. */
export const API_TIMEOUT_MS = 10_000;

/** Placeholder até existir uma URL publicada de verdade (item de Ops do M6,
    docs/PLAN.md "Política de Privacidade + Termos publicados em URL fixa").
    Trocar antes do lançamento — ver docs/runbook.md. */
export const TERMS_URL = "https://fitbrother.app/termos";
export const PRIVACY_URL = "https://fitbrother.app/privacidade";
