const DEFAULT_MEAL_LOCALE = "pt-BR";
const LOCALE_TAG = /^[A-Za-z]{2}(-[A-Za-z]{2})?$/;

export function mealLocale(profileLocale?: string | null): string {
  return profileLocale && LOCALE_TAG.test(profileLocale) ? profileLocale : DEFAULT_MEAL_LOCALE;
}
