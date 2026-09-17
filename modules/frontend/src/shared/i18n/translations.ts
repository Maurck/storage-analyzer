import type { en } from "./dictionaries/en";

export type Language = "en" | "es";

export const languages: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;

/**
 * Dictionaries load on demand, each in its own chunk, so they stay out of the
 * initial bundle and only the chosen language is read.
 */
export function loadDictionary(language: Language): Promise<Dictionary> {
  return language === "es"
    ? import(/* webpackChunkName: "i18n-es" */ "./dictionaries/es").then(
        (module) => module.es,
      )
    : import(/* webpackChunkName: "i18n-en" */ "./dictionaries/en").then(
        (module) => module.en,
      );
}
