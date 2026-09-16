import type { TrendDir } from '@/api/client';
import { formatDate } from '@/lib/format';

export const CROP_LABELS: Record<string, { hi: string; en: string }> = {
  tomato: { hi: 'टमाटर', en: 'Tomato' },
  onion: { hi: 'कांदा', en: 'Onion' },
  wheat: { hi: 'गेहूं', en: 'Wheat' },
  soybean: { hi: 'सोयाबीन', en: 'Soybean' },
  cotton: { hi: 'कपास', en: 'Cotton' },
  potato: { hi: 'आलू', en: 'Potato' },
  rice: { hi: 'चावल', en: 'Rice' },
  maize: { hi: 'मक्का', en: 'Maize' },
  chana: { hi: 'चना', en: 'Chana' },
  mustard: { hi: 'सरसों', en: 'Mustard' },
  grape: { hi: 'अंगूर', en: 'Grapes' },
  sugarcane: { hi: 'गन्ना', en: 'Sugarcane' },
  banana: { hi: 'केला', en: 'Banana' },
  orange: { hi: 'संतरा', en: 'Orange' },
  bajra: { hi: 'बाजरा', en: 'Bajra' },
  paddy: { hi: 'धान', en: 'Paddy' },
};

type TFn = (hi: string, en?: string) => string;

export function cropLabel(t: TFn, crop: string): string {
  const known = CROP_LABELS[crop.toLowerCase()];
  if (known) return t(known.hi, known.en);
  return crop.charAt(0).toUpperCase() + crop.slice(1);
}

export function timeAgo(iso: string, t: TFn): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return formatDate(iso);
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return t('अभी-अभी', 'just now');
  if (mins < 60) return t(`${mins} मिनट पहले`, `${mins} min ago`);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t(`${hours} घंटे पहले`, `${hours} hr ago`);
  return formatDate(iso);
}

export const TREND_META: Record<TrendDir, { tone: 'success' | 'danger' | 'neutral'; sign: string }> = {
  up: { tone: 'success', sign: '+' },
  down: { tone: 'danger', sign: '' },
  flat: { tone: 'neutral', sign: '' },
};
