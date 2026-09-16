import { register } from '../registry';
import { demoError, id, requireAuth } from '../util';
import { getDb, saveDb, type DemoUser } from '../db';
import { DEMO_PHONE } from '../seed';
import type { AuthTokens, FarmerProfile, ProfileType, RegisterBody } from '@/api/types';

const VALID_REFERRAL_CODES: Record<string, { name: string; village: string }> = {
  RAMSINGH2026: { name: 'Ram Singh', village: 'Sinnar' },
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (phone.startsWith('+')) return `+${digits}`;
  return `+91${digits.slice(-10)}`;
}

function issueTokens(uid: string): AuthTokens {
  const db = getDb();
  const accessToken = `demo-${uid}-${Date.now()}`;
  const refreshToken = `rt_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  db.refreshTokens[refreshToken] = uid;
  saveDb();
  return { accessToken, refreshToken };
}

function publicUser(u: DemoUser): FarmerProfile {
  const { mpin: _mpin, ...profile } = u;
  return profile;
}

function checkOtpSession(otpSessionId: string, phone: string): void {
  const db = getDb();
  const session = db.otpSessions[otpSessionId];
  if (!session || session.phone !== phone) {
    throw demoError(422, 'OTP_INVALID', 'OTP सत्र अमान्य है।');
  }
  if (session.expiresAt < Date.now()) {
    throw demoError(422, 'OTP_EXPIRED', 'OTP कालबाह्य झाला. पुन्हा पाठवा.');
  }
}

function newUserFromPhone(phone: string): DemoUser {
  const uid = id('u');
  const db = getDb();
  const user: DemoUser = {
    id: uid,
    name: 'New Farmer',
    vernacularName: 'नवीन शेतकरी',
    phone,
    village: '',
    tehsil: '',
    district: '',
    state: '',
    landAreaAcres: 0,
    soilType: '',
    irrigationType: '',
    kisanCreditScore: 0,
    creditTier: 'C',
    krishiRatnaLevel: 1,
    krishiRatnaTitle: 'Krishi Naveen',
    streakDays: 0,
    agriCoins: 0,
    bankName: '',
    kccLimit: 0,
    activeCrops: [],
    farmBoundaryPoints: [],
    linkedProfiles: ['farmer'],
    activeProfile: 'farmer',
    primaryProfile: 'farmer',
    mpin: '',
  };
  db.users[uid] = user;
  db.userIdsByPhone[phone] = uid;
  return user;
}

register('POST', '/auth/otp/send', ({ body }) => {
  const { phone } = (body ?? {}) as { phone?: string };
  if (!phone) throw demoError(422, 'VALIDATION_ERROR', 'मोबाइल नंबर आवश्यक आहे.', { phone: 'required' });
  const db = getDb();
  const otpSessionId = id('otp');
  db.otpSessions[otpSessionId] = { phone: normalizePhone(phone), expiresAt: Date.now() + 300_000 };
  saveDb();
  return { status: 200, body: { otpSessionId, expiresInSec: 300, resendAfterSec: 30 } };
});

register('POST', '/auth/otp/verify', ({ body }) => {
  const { phone, otp, otpSessionId } = (body ?? {}) as { phone?: string; otp?: string; otpSessionId?: string };
  if (!phone || !otp || !otpSessionId) {
    throw demoError(422, 'VALIDATION_ERROR', 'phone, otp आणि otpSessionId आवश्यक आहेत.');
  }
  const normalized = normalizePhone(phone);
  checkOtpSession(otpSessionId, normalized);
  if (!/^\d{6}$/.test(otp)) throw demoError(422, 'OTP_INVALID', 'चुकीचा OTP. पुन्हा प्रयत्न करा.');
  const db = getDb();
  const existing = db.userIdsByPhone[normalized];
  const user = existing ? db.users[existing] : newUserFromPhone(normalized);
  delete db.otpSessions[otpSessionId];
  const tokens = issueTokens(user.id);
  saveDb();
  return { status: 200, body: { ...tokens, isNewUser: !existing, user: publicUser(user) } };
});

register('POST', '/auth/login', ({ body }) => {
  const { phone, mpin } = (body ?? {}) as { phone?: string; mpin?: string };
  const db = getDb();
  const uid = phone ? db.userIdsByPhone[normalizePhone(phone)] : undefined;
  const user = uid ? db.users[uid] : undefined;
  if (!user) throw demoError(404, 'NOT_FOUND', 'या नंबरवर खाते सापडले नाही.');
  if (mpin !== user.mpin) throw demoError(403, 'MPIN_INCORRECT', 'चुकीचा MPIN. पुन्हा प्रयत्न करा.');
  return { status: 200, body: { ...issueTokens(user.id), user: publicUser(user) } };
});

register('POST', '/auth/mpin/reset', ({ body }) => {
  const { phone, otp, otpSessionId, newMpin } = (body ?? {}) as {
    phone?: string;
    otp?: string;
    otpSessionId?: string;
    newMpin?: string;
  };
  if (!phone || !otp || !otpSessionId || !/^\d{4}$/.test(newMpin ?? '')) {
    throw demoError(422, 'VALIDATION_ERROR', '4-अंकी MPIN आवश्यक आहे.');
  }
  const normalized = normalizePhone(phone);
  checkOtpSession(otpSessionId, normalized);
  const db = getDb();
  const uid = db.userIdsByPhone[normalized];
  if (!uid) throw demoError(404, 'NOT_FOUND', 'या नंबरवर खाते सापडले नाही.');
  db.users[uid].mpin = newMpin!;
  delete db.otpSessions[otpSessionId];
  saveDb();
  return { status: 200, body: { reset: true } };
});

register('POST', '/auth/mpin/reverify', ({ headers, body }) => {
  const { uid } = requireAuth(headers);
  const { mpin } = (body ?? {}) as { mpin?: string };
  const db = getDb();
  if (mpin !== db.users[uid].mpin) throw demoError(403, 'MPIN_INCORRECT', 'चुकीचा MPIN.');
  return { status: 200, body: { ...issueTokens(uid), user: publicUser(db.users[uid]) } };
});

register('POST', '/auth/biometric', ({ body }) => {
  const { phone } = (body ?? {}) as { phone?: string };
  const db = getDb();
  const uid = phone ? db.userIdsByPhone[normalizePhone(phone)] : db.userIdsByPhone[DEMO_PHONE];
  const user = uid ? db.users[uid] : undefined;
  if (!user) throw demoError(404, 'NOT_FOUND', 'या नंबरवर खाते सापडले नाही.');
  return { status: 200, body: { ...issueTokens(user.id), user: publicUser(user) } };
});

register('POST', '/auth/refresh', ({ body }) => {
  const { refreshToken } = (body ?? {}) as { refreshToken?: string };
  const db = getDb();
  const uid = refreshToken ? db.refreshTokens[refreshToken] : undefined;
  if (!uid) {
    throw demoError(401, 'TOKEN_REUSE_DETECTED', 'सत्र संपले. कृपया पुन्हा लॉगिन करा.');
  }
  delete db.refreshTokens[refreshToken!];
  return { status: 200, body: issueTokens(uid) };
});

register('POST', '/auth/logout', ({ headers }) => {
  const { uid } = requireAuth(headers);
  const db = getDb();
  for (const [token, owner] of Object.entries(db.refreshTokens)) {
    if (owner === uid) delete db.refreshTokens[token];
  }
  saveDb();
  return { status: 204 };
});

register('POST', '/auth/register', ({ body }) => {
  const b = (body ?? {}) as Partial<RegisterBody>;
  if (!b.name || !b.phone || !b.mpin) {
    throw demoError(422, 'VALIDATION_ERROR', 'नाव, फोन आणि MPIN आवश्यक आहेत.', {
      ...(b.name ? {} : { name: 'required' }),
      ...(b.phone ? {} : { phone: 'required' }),
      ...(b.mpin ? {} : { mpin: 'required' }),
    });
  }
  if (b.referralCode && !VALID_REFERRAL_CODES[b.referralCode.toUpperCase()]) {
    throw demoError(422, 'REFERRAL_CODE_INVALID', 'रेफरल कोड अमान्य आहे.', { referralCode: 'unknown code' });
  }
  const db = getDb();
  const phone = normalizePhone(b.phone!);
  const uid = db.userIdsByPhone[phone] ?? id('u');
  const profiles: ProfileType[] = b.profiles?.length ? b.profiles : ['farmer'];
  const primary: ProfileType = b.primaryProfile && profiles.includes(b.primaryProfile) ? b.primaryProfile : profiles[0];
  const user: DemoUser = {
    ...(db.users[uid] ?? ({} as DemoUser)),
    id: uid,
    name: b.name!,
    vernacularName: b.name!,
    phone,
    village: b.village ?? '',
    tehsil: b.tehsil ?? '',
    district: b.district ?? '',
    state: b.state ?? '',
    landAreaAcres: b.landAreaAcres ?? 0,
    soilType: b.soilType ?? '',
    irrigationType: b.irrigationType ?? '',
    kisanCreditScore: db.users[uid]?.kisanCreditScore ?? 650,
    creditTier: db.users[uid]?.creditTier ?? 'B',
    krishiRatnaLevel: 1,
    krishiRatnaTitle: 'Krishi Naveen',
    streakDays: 1,
    agriCoins: db.users[uid]?.agriCoins ?? 0,
    bankName: '',
    kccLimit: 0,
    activeCrops: b.crops ?? [],
    farmBoundaryPoints: [],
    linkedProfiles: profiles,
    activeProfile: primary,
    primaryProfile: primary,
    referralCodeUsed: b.referralCode?.toUpperCase() ?? null,
    mpin: b.mpin!,
  };
  db.users[uid] = user;
  db.userIdsByPhone[phone] = uid;
  db.settings[uid] = db.settings[uid] ?? { language: 'hi', womenMode: false, highContrast: false, darkMode: false };
  const tokens = issueTokens(uid);
  saveDb();
  return { status: 201, body: { ...tokens, isNewUser: true, user: publicUser(user) } };
});

register('GET', '/auth/sessions', ({ headers }) => {
  requireAuth(headers);
  return { status: 200, body: { data: getDb().sessions } };
});

register('DELETE', '/auth/sessions/:id', ({ headers, params }) => {
  requireAuth(headers);
  const db = getDb();
  const before = db.sessions.length;
  db.sessions = db.sessions.filter((s) => s.id !== params.id || s.current);
  if (db.sessions.length === before) throw demoError(404, 'NOT_FOUND', 'सत्र सापडले नाही.');
  saveDb();
  return { status: 204 };
});
