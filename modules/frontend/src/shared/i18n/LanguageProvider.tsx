import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Language,
  TranslationKey,
  languages,
  translations,
} from "./translations";

const storageKey = "storage-analyzer:language";

export function isLanguage(value: unknown): value is Language {
  return languages.some((entry) => entry.code === value);
}

function storedLanguage(): Language | null {
  // Private windows and blocked site data make localStorage throw rather than
  // return null, so every access here is guarded.
  try {
    const stored = window.localStorage.getItem(storageKey);
    return isLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Falls back to the browser's language, then English. */
export function detectLanguage(): Language {
  const stored = storedLanguage();
  if (stored) return stored;
  const preferred =
    typeof navigator === "undefined" ? [] : (navigator.languages ?? []);
  for (const tag of [...preferred, navigator?.language]) {
    const base = typeof tag === "string" ? tag.split("-")[0] : undefined;
    if (isLanguage(base)) return base;
  }
  return "en";
}

/**
 * Replaces `{name}` placeholders. Values are already-formatted strings, so
 * numbers keep the size and count formatting the rest of the app applies.
 */
export function translate(
  language: Language,
  key: TranslationKey,
  values?: Record<string, string | number>,
): string {
  const template = translations[language][key] ?? translations.en[key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export type Translate = (
  key: TranslationKey,
  values?: Record<string, string | number>,
) => string;

interface LanguageContextValue {
  language: Language;
  setLanguage(language: Language): void;
  t: Translate;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectLanguage);

  useEffect(() => {
    // Screen readers switch voice from this attribute, so it has to track the
    // chosen language rather than stay at the value index.html ships with.
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // A preference that cannot be stored still applies to this session.
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, values) => translate(language, key, values),
    }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useTranslation must be used inside a LanguageProvider.");
  }
  return value;
}
