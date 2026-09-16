import { register } from '../registry';
import { demoError, nowIso, paginate, requireAuth, requireRole, today } from '../util';
import { getDb } from '../db';
import type {
  MandiCompareRow,
  MandiListEntry,
  MandiPrice,
  MandiPriceHistory,
  MandiPricePoint,
  ProfileType,
} from '@/api/types';

const ROLES: ProfileType[] = ['farmer', 'seller', 'broker'];

// Mandi directory with geo coordinates; MandiPrice rows reference these by name.
const MANDIS: MandiListEntry[] = [
  { id: 'mnd_nashik', name: 'Nashik APMC', district: 'Nashik', state: 'Maharashtra', lat: 20.0112, lng: 73.7902 },
  { id: 'mnd_pimpalgaon', name: 'Pimpalgaon', district: 'Nashik', state: 'Maharashtra', lat: 20.1702, lng: 73.9847 },
  { id: 'mnd_lasalgaon', name: 'Lasalgaon', district: 'Nashik', state: 'Maharashtra', lat: 20.1435, lng: 74.2353 },
  { id: 'mnd_yeola', name: 'Yeola', district: 'Nashik', state: 'Maharashtra', lat: 20.0426, lng: 74.4899 },
  { id: 'mnd_malegaon', name: 'Malegaon', district: 'Nashik', state: 'Maharashtra', lat: 20.5537, lng: 74.5288 },
  { id: 'mnd_pune', name: 'Pune APMC', district: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  { id: 'mnd_solapur', name: 'Solapur APMC', district: 'Solapur', state: 'Maharashtra', lat: 17.6599, lng: 75.9064 },
];

// Extra price rows so compare/history have coverage beyond the seed's 6 rows.
// Guarded by id so a persisted db (localStorage) never gets duplicates.
const EXTRA_PRICES: MandiPrice[] = [
  { id: 'mp_x1', mandiName: 'Yeola', distanceKm: 52, commodity: 'onion', variety: 'लाल कांदा', minPrice: 1150, maxPrice: 1600, modalPrice: 1380, msp: null, trend: 'down', changePercent: -1.2, arrivalsQuintals: 940, updatedAt: nowIso() },
  { id: 'mp_x2', mandiName: 'Lasalgaon', distanceKm: 45, commodity: 'tomato', variety: 'देशी टमाटर', minPrice: 1550, maxPrice: 2150, modalPrice: 1850, msp: null, trend: 'flat', changePercent: 0.3, arrivalsQuintals: 480, updatedAt: nowIso() },
  { id: 'mp_x3', mandiName: 'Pimpalgaon', distanceKm: 32, commodity: 'wheat', variety: 'लोकवान गेहूं', minPrice: 2350, maxPrice: 2550, modalPrice: 2450, msp: 2275, trend: 'up', changePercent: 1.1, arrivalsQuintals: 360, updatedAt: nowIso() },
  { id: 'mp_x4', mandiName: 'Pune APMC', distanceKm: 210, commodity: 'onion', variety: 'लाल कांदा', minPrice: 1300, maxPrice: 1750, modalPrice: 1560, msp: null, trend: 'up', changePercent: 2.4, arrivalsQuintals: 1600, updatedAt: nowIso() },
];

function allPrices(): MandiPrice[] {
  const db = getDb();
  for (const extra of EXTRA_PRICES) {
    if (!db.mandiPrices.some((p) => p.id === extra.id)) db.mandiPrices.push(extra);
  }
  return db.mandiPrices;
}

function mandiOf(name: string): MandiListEntry | undefined {
  return MANDIS.find((m) => m.name === name);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// When the caller passes lat/lng, distances are recomputed against the mandi directory.
function withDistance(prices: MandiPrice[], query: Record<string, string>): MandiPrice[] {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return prices;
  return prices.map((p) => {
    const m = mandiOf(p.mandiName);
    return m ? { ...p, distanceKm: Math.round(haversineKm(lat, lng, m.lat, m.lng)) } : p;
  });
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

register('GET', '/mandi/prices', ({ headers, query }) => {
  requireRole(requireAuth(headers), ROLES);
  let list = withDistance(allPrices(), query);
  if (query.crop) list = list.filter((p) => p.commodity === query.crop);
  if (query.district) {
    list = list.filter((p) => mandiOf(p.mandiName)?.district === query.district);
  }
  list = [...list].sort((a, b) => a.distanceKm - b.distanceKm);
  return { status: 200, body: paginate(list, query) };
});

register('GET', '/mandi/vyapari-rates', ({ headers, query }) => {
  requireRole(requireAuth(headers), ROLES);
  let list = getDb().vyapariRates;
  if (query.crops) {
    const crops = query.crops.split(',').map((c) => c.trim()).filter(Boolean);
    list = list.filter((r) => crops.includes(r.crop));
  }
  return { status: 200, body: paginate(list, query) };
});

register('GET', '/mandi/compare', ({ headers, query }) => {
  requireRole(requireAuth(headers), ROLES);
  const qty = Number(query.quantityQuintals);
  if (!query.crop || !Number.isFinite(qty) || qty <= 0) {
    throw demoError(422, 'VALIDATION_ERROR', 'पीक आणि quantityQuintals आवश्यक आहेत.', {
      ...(query.crop ? {} : { crop: 'required' }),
      ...(Number.isFinite(qty) && qty > 0 ? {} : { quantityQuintals: 'must be > 0' }),
    });
  }
  const rows: MandiCompareRow[] = withDistance(allPrices(), query)
    .filter((p) => p.commodity === query.crop)
    .map((p) => {
      const transportCost = Math.round(p.distanceKm * 30);
      return {
        mandiName: p.mandiName,
        modalPrice: p.modalPrice,
        transportCost,
        netProfit: Math.round(p.modalPrice * qty - transportCost),
      };
    })
    .sort((a, b) => b.netProfit - a.netProfit);
  return { status: 200, body: paginate(rows, query) };
});

register('GET', '/mandi/list', ({ headers, query }) => {
  requireRole(requireAuth(headers), ROLES);
  return { status: 200, body: paginate(MANDIS, query) };
});

register('GET', '/mandi/prices/history', ({ headers, query }) => {
  requireRole(requireAuth(headers), ROLES);
  if (!query.crop || !query.mandi) {
    throw demoError(422, 'VALIDATION_ERROR', 'crop आणि mandi आवश्यक आहेत.', {
      ...(query.crop ? {} : { crop: 'required' }),
      ...(query.mandi ? {} : { mandi: 'required' }),
    });
  }
  const to = query.to ?? today();
  const from = query.from ?? new Date(Date.parse(to) - 90 * 86400_000).toISOString().slice(0, 10);
  if (from > to) {
    throw demoError(422, 'VALIDATION_ERROR', 'from तारीख to पेक्षा आधी हवी.', { from: 'must be <= to' });
  }
  const current = allPrices().find((p) => p.commodity === query.crop && p.mandiName === query.mandi);
  const base = current?.modalPrice ?? 1500;
  const points: MandiPricePoint[] = [];
  for (let d = Date.parse(from); d <= Date.parse(to) && points.length < 1100; d += 86400_000) {
    const date = new Date(d).toISOString().slice(0, 10);
    const h = hashStr(`${query.crop}|${query.mandi}|${date}`);
    const drift = Math.round(base * 0.12 * ((h % 2000) / 1000 - 1));
    points.push({
      date,
      modalPrice: Math.max(100, base + drift),
      arrivalsQuintals: 150 + (h % 1400),
    });
  }
  const prices = points.map((p) => p.modalPrice);
  const body: MandiPriceHistory = {
    crop: query.crop,
    mandi: query.mandi,
    points,
    msp: current?.msp ?? null,
    summary: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
      avg: prices.length ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length) : 0,
    },
  };
  return { status: 200, body };
});
