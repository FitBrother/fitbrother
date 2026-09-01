import Constants from "expo-constants";

/**
 * URL da landing page. O app roda em `www.fitbrother.app` e a landing no ápice
 * `fitbrother.app` — são superfícies separadas, então o caminho de volta é uma
 * navegação externa, não uma rota.
 *
 * Fica em `app.json` → `extra.landingUrl` pelo mesmo motivo que as URLs legais
 * (ver `lib/legal.ts`): poder apontar para staging sem tocar em componente.
 */
export const landingUrl = (Constants.expoConfig?.extra?.landingUrl ??
  "https://fitbrother.app") as string;
