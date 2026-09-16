import { useSession } from '@/state/SessionContext';

export type Lang = 'hi' | 'mr' | 'en';

export function pickLang(lang: Lang, hi: string, en?: string): string {
  if (lang === 'en') return en ?? hi;
  return hi;
}

export function useT() {
  const { language } = useSession();
  return (hi: string, en?: string) => pickLang(language, hi, en);
}
