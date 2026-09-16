import { register } from '../registry';
import { demoError, nowIso, paginate, requireAuth } from '../util';
import { getDb, saveDb } from '../db';
import type {
  ConsentFlags,
  DashboardPayload,
  FarmerProfile,
  ProfileType,
  UserSettings,
} from '@/api/types';

const HOME_ROUTES: Record<ProfileType, string> = {
  farmer: '/home',
  farmLandlord: '/landlord',
  transport: '/transport',
  seller: '/seller',
  equipmentRental: '/equipment-owner',
  broker: '/broker',
};

const DASHBOARDS: Record<ProfileType, DashboardPayload> = {
  farmer: {
    profileType: 'farmer',
    metrics: [
      { key: 'weather', label: 'मौसम', value: '28°C · 10% बारिश' },
      { key: 'coins', label: 'एग्री कॉइन्स', value: '1,250', trend: 'up' },
      { key: 'urgentTask', label: 'आज का काम', value: '1 ज़रूरी' },
    ],
    quickActions: [
      { route: '/buyers', label: 'परिवहन', icon: 'truck' },
      { route: '/mandi', label: 'मंडी भाव', icon: 'store' },
      { route: '/account/chats', label: 'किसान मित्र', icon: 'chat' },
      { route: '/finance', label: 'कृषि ऋण', icon: 'wallet' },
    ],
    activity: [
      { id: 'act_f1', title: 'टमाटर — मँकोझेब फवारणी', subtitle: 'सकाळी 6–9', status: 'pending', at: '2026-09-14T06:30:00Z' },
    ],
  },
  farmLandlord: {
    profileType: 'farmLandlord',
    metrics: [
      { key: 'acres', label: 'कुल ज़मीन', value: '18.5 एकड़' },
      { key: 'tenants', label: 'किरायेदार', value: '3' },
      { key: 'rent', label: 'किराया/माह', value: '₹42,000' },
    ],
    quickActions: [
      { route: '/land-legal', label: '7/12 रिकॉर्ड', icon: 'file' },
      { route: '/schemes', label: 'योजनाएं', icon: 'landmark' },
      { route: '/landlord/rent', label: 'किराया P&L', icon: 'scale' },
      { route: '/marketplace', label: 'बाज़ार', icon: 'cart' },
    ],
    activity: [
      { id: 'act_l1', title: 'Wagholi North — S. Patil', subtitle: 'किराया ₹14,000/माह', status: 'verified', amountRupees: 14000, at: '2026-09-01T00:00:00Z' },
    ],
  },
  transport: {
    profileType: 'transport',
    metrics: [
      { key: 'vehicles', label: 'वाहन', value: '4' },
      { key: 'tripsToday', label: 'आज की ट्रिप', value: '6' },
      { key: 'freight', label: 'दैनिक भाड़ा', value: '₹28,500' },
    ],
    quickActions: [
      { route: '/post-harvest', label: 'लॉजिस्टिक्स', icon: 'package' },
      { route: '/marketplace/orders', label: 'ऑर्डर', icon: 'cart' },
      { route: '/finance/loans', label: 'वाहन ऋण', icon: 'wallet' },
      { route: '/gyan-hub', label: 'ज्ञान हब', icon: 'graduation' },
    ],
    activity: [
      { id: 'act_t1', title: 'MH15AB1234 — Sinnar → Nashik APMC', subtitle: '18 km', status: 'enRoute', amountRupees: 1500, at: '2026-09-14T05:30:00Z' },
    ],
  },
  seller: {
    profileType: 'seller',
    metrics: [
      { key: 'turnover', label: 'टर्नओवर', value: '₹1.45L' },
      { key: 'stock', label: 'स्टॉक', value: '280 q' },
      { key: 'buyers', label: 'खरीदार', value: '14' },
    ],
    quickActions: [
      { route: '/mandi', label: 'लाइव भाव', icon: 'store' },
      { route: '/buyers', label: 'खरीदार', icon: 'users' },
      { route: '/profit-loss', label: 'P&L', icon: 'scale' },
      { route: '/marketplace', label: 'बाज़ार', icon: 'cart' },
    ],
    activity: [
      { id: 'act_s1', title: 'कांदा खरेदी — 15q @ ₹1,550', subtitle: 'Pimpalgaon', status: 'paid', amountRupees: 23250, at: '2026-09-13T07:00:00Z' },
    ],
  },
  equipmentRental: {
    profileType: 'equipmentRental',
    metrics: [
      { key: 'machines', label: 'मशीनें', value: '6' },
      { key: 'bookedHrs', label: 'बुक्ड घंटे', value: '8' },
      { key: 'weeklyIncome', label: 'साप्ताहिक आय', value: '₹52,000' },
    ],
    quickActions: [
      { route: '/equipment/slots', label: 'स्लॉट हब', icon: 'calendar' },
      { route: '/finance/loans', label: 'मशीनरी ऋण', icon: 'wallet' },
      { route: '/equipment/maintenance', label: 'मेंटेनेंस', icon: 'wrench' },
      { route: '/krishi-ratna', label: 'कृषि रत्न', icon: 'trophy' },
    ],
    activity: [
      { id: 'act_e1', title: 'महिंद्रा ट्रॅक्टर — सकाळ स्लॉट', subtitle: '₹800/4घं', status: 'confirmed', amountRupees: 800, at: '2026-09-15T06:00:00Z' },
    ],
  },
  broker: {
    profileType: 'broker',
    metrics: [
      { key: 'deals', label: 'सक्रिय डील', value: '12' },
      { key: 'leads', label: 'किसान लीड', value: '38' },
      { key: 'commission', label: 'कमीशन', value: '₹34,800' },
    ],
    quickActions: [
      { route: '/buyers', label: 'खरीदार', icon: 'users' },
      { route: '/mandi', label: 'भाव ट्रेंड', icon: 'store' },
      { route: '/broker/commissions', label: 'कमीशन', icon: 'scale' },
      { route: '/finance', label: 'फाइनेंस', icon: 'wallet' },
    ],
    activity: [
      { id: 'act_b1', title: 'गेहूं 200q — Shakti Flour Mill', subtitle: 'कमीशन 1.5%', status: 'negotiating', amountRupees: 7200, at: '2026-09-13T12:00:00Z' },
    ],
  },
};

function stripMpin(u: { mpin: string } & FarmerProfile): FarmerProfile {
  const { mpin: _m, ...profile } = u;
  return profile;
}

register('GET', '/users/me', ({ headers }) => {
  const { uid } = requireAuth(headers);
  return { status: 200, body: stripMpin(getDb().users[uid]) };
});

register('PUT', '/users/me', ({ headers, body }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const patch = (body ?? {}) as Partial<FarmerProfile>;
  const { id: _i, phone: _p, linkedProfiles: _lp, activeProfile: _ap, agriCoins: _c, mpin: _m, ...allowed } =
    patch as Partial<FarmerProfile> & { mpin?: string };
  Object.assign(db.users[uid], allowed);
  saveDb();
  return { status: 200, body: stripMpin(db.users[uid]) };
});

register('DELETE', '/users/me', ({ headers, body }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const { mpin } = (body ?? {}) as { mpin?: string };
  if (mpin !== db.users[uid].mpin) throw demoError(403, 'MPIN_INCORRECT', 'चुकीचा MPIN.');
  db.users[uid].name = 'Deleted User';
  db.users[uid].vernacularName = 'हटवलेले खाते';
  saveDb();
  return { status: 204 };
});

register('POST', '/users/me/profiles', ({ headers, body }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const { profileType } = (body ?? {}) as { profileType?: ProfileType };
  if (!profileType || !HOME_ROUTES[profileType]) {
    throw demoError(422, 'VALIDATION_ERROR', 'अमान्य प्रोफ़ाइल प्रकार.', { profileType: 'invalid' });
  }
  const user = db.users[uid];
  if (!user.linkedProfiles.includes(profileType)) user.linkedProfiles.push(profileType);
  saveDb();
  return { status: 201, body: stripMpin(user) };
});

register('DELETE', '/users/me/profiles/:type', ({ headers, params }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const user = db.users[uid];
  const type = params.type as ProfileType;
  if (!user.linkedProfiles.includes(type)) throw demoError(404, 'NOT_FOUND', 'प्रोफ़ाइल जोडलेली नाही.');
  if (user.linkedProfiles.length === 1) {
    throw demoError(409, 'PROFILE_LAST_REMAINING', 'कम से कम एक प्रोफ़ाइल आवश्यक है');
  }
  user.linkedProfiles = user.linkedProfiles.filter((p) => p !== type);
  if (user.activeProfile === type) user.activeProfile = user.primaryProfile;
  if (user.primaryProfile === type) user.primaryProfile = user.linkedProfiles[0];
  saveDb();
  return { status: 200, body: stripMpin(user) };
});

register('POST', '/users/me/profiles/:type/activate', ({ headers, params }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const user = db.users[uid];
  const type = params.type as ProfileType;
  if (!user.linkedProfiles.includes(type)) {
    throw demoError(404, 'NOT_FOUND', 'प्रोफ़ाइल जोडलेली नाही.');
  }
  user.activeProfile = type;
  saveDb();
  return { status: 200, body: { activeProfile: type, defaultHomeRoute: HOME_ROUTES[type] } };
});

register('PUT', '/users/me/profiles/:type/primary', ({ headers, params }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const user = db.users[uid];
  const type = params.type as ProfileType;
  if (!user.linkedProfiles.includes(type)) {
    throw demoError(404, 'NOT_FOUND', 'प्रोफ़ाइल जोडलेली नाही.');
  }
  user.primaryProfile = type;
  saveDb();
  return { status: 200, body: stripMpin(user) };
});

register('PUT', '/users/me/settings', ({ headers, body }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const current = db.settings[uid] ?? { language: 'hi', womenMode: false, highContrast: false, darkMode: false };
  db.settings[uid] = { ...current, ...((body ?? {}) as Partial<UserSettings>) };
  saveDb();
  return { status: 200, body: db.settings[uid] };
});

register('GET', '/users/me/consents', ({ headers }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const c = db.consents[uid] ?? {
    saturationShare: false,
    locationForAdvisory: false,
    marketingPush: false,
    voiceDataProcessing: false,
    updatedAt: nowIso(),
  };
  return { status: 200, body: { consents: { saturationShare: c.saturationShare, locationForAdvisory: c.locationForAdvisory, marketingPush: c.marketingPush, voiceDataProcessing: c.voiceDataProcessing }, updatedAt: c.updatedAt } };
});

register('PUT', '/users/me/consents', ({ headers, body }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const current = db.consents[uid] ?? {
    saturationShare: false,
    locationForAdvisory: false,
    marketingPush: false,
    voiceDataProcessing: false,
    updatedAt: nowIso(),
  };
  db.consents[uid] = { ...current, ...((body ?? {}) as Partial<ConsentFlags>), updatedAt: nowIso() };
  saveDb();
  const c = db.consents[uid];
  return {
    status: 200,
    body: {
      consents: {
        saturationShare: c.saturationShare,
        locationForAdvisory: c.locationForAdvisory,
        marketingPush: c.marketingPush,
        voiceDataProcessing: c.voiceDataProcessing,
      },
      updatedAt: c.updatedAt,
    },
  };
});

register('GET', '/users/me/dashboard/:profileType', ({ params }) => {
  const payload = DASHBOARDS[params.profileType as ProfileType];
  if (!payload) throw demoError(404, 'NOT_FOUND', 'अमान्य प्रोफ़ाइल प्रकार.');
  return { status: 200, body: payload };
});

register('GET', '/users/me/bookings', ({ headers, query }) => {
  requireAuth(headers);
  let list = getDb().aggregatedBookings;
  if (query.type) list = list.filter((b) => b.type === query.type);
  if (query.status) list = list.filter((b) => b.status === query.status);
  return { status: 200, body: paginate(list, query) };
});

register('PUT', '/users/me/farm-boundary', ({ headers, body }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  const b = (body ?? {}) as { farmBoundaryPoints?: { lat: number; lng: number }[]; landAreaAcres?: number; khasraNumber?: string };
  if (!b.farmBoundaryPoints?.length) {
    throw demoError(422, 'VALIDATION_ERROR', 'सीमा बिंदू आवश्यक आहेत.', { farmBoundaryPoints: 'required' });
  }
  Object.assign(db.users[uid], {
    farmBoundaryPoints: b.farmBoundaryPoints,
    ...(b.landAreaAcres !== undefined ? { landAreaAcres: b.landAreaAcres } : {}),
    ...(b.khasraNumber ? { khasraNumber: b.khasraNumber } : {}),
  });
  saveDb();
  return { status: 200, body: stripMpin(db.users[uid]) };
});
