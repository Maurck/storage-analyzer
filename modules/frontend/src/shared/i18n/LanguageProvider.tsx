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
  Dictionary,
  Language,
  TranslationKey,
  languages,
  loadDictionary,
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
  dictionary: Dictionary,
  key: TranslationKey,
  values?: Record<string, string | number>,
): string {
  const template = dictionary[key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export type Translate = (
  key: TranslationKey,
  values?: Record<string, string | number>,
) => string;

export interface LanguageContextValue {
  language: Language;
  setLanguage(language: Language): void;
  t: Translate;
  /** Whether a key built at runtime, such as `api.${code}`, exists. */
  has(key: string): key is TranslationKey;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectLanguage);
  // The dictionary on screen. While another one loads, the current language
  // stays visible instead of flashing untranslated keys.
  const [loaded, setLoaded] = useState<{
    language: Language;
    dictionary: Dictionary;
  }>();

  useEffect(() => {
    let active = true;
    loadDictionary(language)
      .catch(() => loadDictionary("en"))
      .then((dictionary) => {
        if (active) setLoaded({ language, dictionary });
      })
      .catch((error) => console.error("Could not load translations:", error));
    return () => {
      active = false;
    };
  }, [language]);

  useEffect(() => {
    // Screen readers switch voice from this attribute, so it has to track the
    // language on screen rather than stay at the value index.html ships with.
    if (loaded) document.documentElement.lang = loaded.language;
  }, [loaded]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // A preference that cannot be stored still applies to this session.
    }
  }, []);

  const value = useMemo<LanguageContextValue | undefined>(
    () =>
      loaded && {
        language,
        setLanguage,
        t: (key, values) => translate(loaded.dictionary, key, values),
        has: (key): key is TranslationKey =>
          Object.prototype.hasOwnProperty.call(loaded.dictionary, key),
      },
    [language, loaded, setLanguage],
  );

  // Dictionaries are local chunks; the first one arrives within a frame.
  if (!value) return null;
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
