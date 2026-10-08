import { useEffect, useState } from 'react';
import { useOnboardingStore } from '../../stores/onboarding';

/**
 * i18n mirroring the mobile tr(): fallback chain lang -> en -> hi -> key.
 * Locales register their dictionary via registerLocale() from locale files.
 * Non-English dictionaries may be partial (and may be lazy-loaded), so missing
 * keys fall through to en.
 */

const dictionaries: Record<string, Record<string, string>> = {};

const versionListeners = new Set<() => void>();

/** Notify subscribers that a locale dictionary changed (e.g. lazy load). */
function bumpVersion(): void {
  versionListeners.forEach((listener) => listener());
}

export function registerLocale(code: string, dict: Record<string, string>): void {
  // Merge so feature modules (e.g. trade) can register additional keys for an
  // existing locale without owning the whole dictionary.
  dictionaries[code] = { ...dictionaries[code], ...dict };
  bumpVersion();
}

export function currentLanguage(): string {
  return useOnboardingStore.getState().language || 'en';
}

export function t(key: string, params?: Record<string, string | number>): string {
  const lang = currentLanguage();
  let value: string | undefined =
    dictionaries[lang]?.[key] ?? dictionaries.en?.[key] ?? dictionaries.hi?.[key];
  if (value === undefined) return key;
  if (params) {
    for (const [name, val] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(val));
    }
  }
  return value;
}

/** Re-render on dictionary changes (lazy locale load). */
function useLocaleVersion(): void {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    versionListeners.add(listener);
    return () => {
      versionListeners.delete(listener);
    };
  }, []);
}

/** React hook re-rendering on language change or dictionary load. */
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const language = useOnboardingStore((s) => s.language);
  useLocaleVersion();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return t;
}
