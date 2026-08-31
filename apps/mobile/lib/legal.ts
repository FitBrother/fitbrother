import Constants from "expo-constants";

/**
 * URLs dos documentos legais, publicados a partir de
 * `landing-page/content/legal/`. Definidas em `app.json` → `extra.legal` para
 * poderem mudar por build (staging/produção) sem tocar em componente.
 *
 * Ficam aqui, e não repetidas em cada tela, porque três superfícies as
 * consomem: a tela de consentimento do onboarding, Perfil → Sobre e
 * Perfil → Privacidade.
 */
export type LegalUrls = {
  termsUrl?: string;
  privacyUrl?: string;
  deletionUrl?: string;
  healthUrl?: string;
  cookiesUrl?: string;
};

export const legalUrls = (Constants.expoConfig?.extra?.legal ?? {}) as LegalUrls;
