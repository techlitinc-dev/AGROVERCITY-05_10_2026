// Demo handlers for endpoints.md §12 (Crop Insurance PMFBY/RWBCIS) + F15 appeal.
// Rate table mirrors docs/days/day-11.md Task A1 seed rows.
import { register } from '../registry';
import { demoError, id, nowIso, requireAuth, requireRole, today, type AuthedUser } from '../util';
import { getDb } from '../db';
import type {
  ClaimAppealBody,
  ClaimAppealRes,
  CropInsurancePolicy,
  CropPremiumRate,
  InsuranceClaimRecord,
  ProfileType,
} from '@/api/types';

const ROLES: ProfileType[] = ['farmer', 'farmLandlord'];

const RATES: CropPremiumRate[] = [
  { id: 'rate_wheat_kharif', cropName: 'wheat', vernacularCropName: 'गेहूं', category: 'kharif-crops', season: 'kharif', sumInsuredPerAcre: 40000, farmerSharePercent: 2.0, totalActuarialRatePercent: 12.5, cutoffDate: '2026-07-31' },
  { id: 'rate_onion_kharif', cropName: 'onion', vernacularCropName: 'प्याज़', category: 'kharif-crops', season: 'kharif', sumInsuredPerAcre: 35000, farmerSharePercent: 2.0, totalActuarialRatePercent: 11.0, cutoffDate: '2026-07-31' },
  { id: 'rate_soybean_kharif', cropName: 'soybean', vernacularCropName: 'सोयाबीन', category: 'kharif-crops', season: 'kharif', sumInsuredPerAcre: 30000, farmerSharePercent: 2.0, totalActuarialRatePercent: 10.0, cutoffDate: '2026-07-31' },
  { id: 'rate_wheat_rabi', cropName: 'wheat', vernacularCropName: 'गेहूं', category: 'rabi-crops', season: 'rabi', sumInsuredPerAcre: 38000, farmerSharePercent: 1.5, totalActuarialRatePercent: 9.5, cutoffDate: '2026-12-15' },
  { id: 'rate_gram_rabi', cropName: 'gram', vernacularCropName: 'चना', category: 'rabi-crops', season: 'rabi', sumInsuredPerAcre: 32000, farmerSharePercent: 1.5, totalActuarialRatePercent: 9.0, cutoffDate: '2026-12-15' },
  { id: 'rate_sugarcane_annual', cropName: 'sugarcane', vernacularCropName: 'गन्ना', category: 'annual', season: 'annual', sumInsuredPerAcre: 90000, farmerSharePercent: 5.0, totalActuarialRatePercent: 14.0, cutoffDate: '2026-03-31' },
];

const SURVEYORS = [
  { name: 'संदीप कुलकर्णी', phone: '+919811000001' },
  { name: 'मीना जाधव', phone: '+919811000002' },
  { name: 'अजय भोसले', phone: '+919811000003' },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function auth(headers: Record<string, string>): AuthedUser {
  const user = requireAuth(headers);
  requireRole(user, ROLES);
  return user;
}

function coverageWindow(season: string): { start: string; end: string } {
  const y = new Date().getFullYear();
  if (season === 'rabi') return { start: `${y}-10-15`, end: `${y + 1}-03-31` };
  if (season === 'annual') return { start: `${y}-04-01`, end: `${y + 1}-03-31` };
  return { start: `${y}-06-15`, end: `${y}-12-31` };
}

function nextClaimNumber(total: number): string {
  const seq = String(42 + total).padStart(4, '0'); // seed history ends at CLM-2026-MH-0042
  return `CLM-${new Date().getFullYear()}-MH-${seq}`;
}

register('GET', '/insurance/policies', ({ headers }) => {
  auth(headers);
  return { status: 200, body: getDb().policies };
});

register('POST', '/insurance/policies/apply', ({ headers, body }) => {
  auth(headers);
  const b = (body ?? {}) as { cropName?: string; season?: string; landAreaAcres?: number };
  const acres = Number(b.landAreaAcres);
  if (!b.cropName || !b.season || !Number.isFinite(acres) || acres <= 0) {
    throw demoError(422, 'VALIDATION_ERROR', 'फसल, सीज़न और क्षेत्र (एकड़) आवश्यक हैं।', {
      cropName: b.cropName ? undefined : 'required',
      season: b.season ? undefined : 'required',
      landAreaAcres: Number.isFinite(acres) && acres > 0 ? undefined : 'invalid',
    });
  }
  const rate = RATES.find(
    (r) => r.cropName === b.cropName!.toLowerCase() && r.season === b.season!.toLowerCase(),
  );
  if (!rate) throw demoError(404, 'RATE_NOT_FOUND', 'इस फसल और सीज़न के लिए प्रीमियम दर उपलब्ध नहीं है।');
  const db = getDb();
  const year = new Date().getFullYear();
  const sumInsured = Math.round(rate.sumInsuredPerAcre * acres);
  const farmerPremium = Math.round((sumInsured * rate.farmerSharePercent) / 100);
  const govtSubsidy = Math.round((sumInsured * (rate.totalActuarialRatePercent - rate.farmerSharePercent)) / 100);
  const window_ = coverageWindow(rate.season);
  const policyId = id('pol');
  const policy: CropInsurancePolicy = {
    id: policyId,
    policyNumber: `PMFBY-${year}-${String(db.policies.length + 1).padStart(4, '0')}`,
    schemeName: 'PMFBY',
    vernacularSchemeName: 'पीएम फसल बीमा',
    cropName: rate.cropName,
    vernacularCropName: rate.vernacularCropName,
    season: rate.season,
    year,
    landAreaAcres: acres,
    sumInsured,
    farmerPremium,
    govtSubsidy,
    status: 'active',
    insuranceCompany: 'AIC of India',
    coverageStartDate: window_.start,
    coverageEndDate: window_.end,
    bankName: 'HDFC Bank',
    kccAccountNo: '****7890',
    certificateUrl: `https://demo.local/cert/${policyId}.pdf`,
  };
  db.policies.push(policy);
  return { status: 201, body: policy };
});

register('GET', '/insurance/policies/:id/certificate', ({ headers, params }) => {
  auth(headers);
  const policy = getDb().policies.find((p) => p.id === params.id);
  if (!policy) throw demoError(404, 'POLICY_NOT_FOUND', 'पॉलिसी नहीं मिली।');
  return { status: 200, body: { url: policy.certificateUrl } };
});

register('GET', '/insurance/rates', ({ headers, query }) => {
  auth(headers);
  let list = RATES;
  if (query.season) list = list.filter((r) => r.season === query.season.toLowerCase());
  if (query.crop) list = list.filter((r) => r.cropName === query.crop.toLowerCase());
  return { status: 200, body: list };
});

register('POST', '/insurance/claims', ({ headers, files }) => {
  const user = auth(headers);
  if (!files) throw demoError(422, 'VALIDATION_ERROR', 'दावा विवरण आवश्यक हैं।');
  const val = (k: string): string => {
    const v = files.get(k);
    return typeof v === 'string' ? v : '';
  };
  const db = getDb();
  const policy = db.policies.find((p) => p.id === val('policyId'));
  if (!policy) throw demoError(404, 'POLICY_NOT_FOUND', 'पॉलिसी नहीं मिली।');
  const photos = files.getAll('damagePhotos').filter((f): f is File => f instanceof File);
  if (photos.length === 0) {
    throw demoError(422, 'VALIDATION_ERROR', 'नुकसान के कम से कम 1 फोटो आवश्यक हैं।', { damagePhotos: 'required' });
  }
  if (photos.length > 5) {
    throw demoError(422, 'VALIDATION_ERROR', 'अधिकतम 5 फोटो अपलोड करें।', { damagePhotos: 'too_many' });
  }
  const loss = Number(val('estimatedLossPercent'));
  if (!val('calamityType') || !val('dateOfDamage') || !val('cropStage') || !Number.isFinite(loss) || loss < 0 || loss > 100) {
    throw demoError(422, 'VALIDATION_ERROR', 'आपदा, तारीख, फसल अवस्था और नुकसान % सही से भरें।');
  }
  const owner = db.users[user.uid];
  const surveyor = SURVEYORS[hash(owner?.district ?? 'Nashik') % SURVEYORS.length];
  const claimId = id('claim');
  const at = nowIso();
  const record: InsuranceClaimRecord = {
    id: claimId,
    claimNumber: nextClaimNumber(db.claims.length + 1),
    policyId: policy.id,
    cropName: val('cropName') || policy.cropName,
    vernacularCropName: policy.vernacularCropName,
    calamityType: val('calamityType'),
    dateOfDamage: val('dateOfDamage'),
    estimatedLossPercent: loss,
    requestedAmount: Math.round((policy.sumInsured * loss) / 100),
    approvedAmount: null,
    status: 'intimated',
    statusText: 'दावा दर्ज — सर्वेयर नियुक्ति लंबित',
    surveyorName: surveyor.name,
    surveyorPhone: surveyor.phone,
    surveyorVisitDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    gpsCoordinates: val('gpsCoordinates') || '19.9975,73.7898',
    village: val('village') || owner?.village || '',
    damagePhotos: photos.map((p, i) => `https://demo.local/claims/${claimId}/${i + 1}-${p.name || 'photo.jpg'}`),
    submittedAt: at,
    dbtTransactionId: null,
    bankAccountLast4: (owner?.phone ?? '').replace(/\D/g, '').slice(-4) || null,
    timeline: [{ status: 'intimated', at, note: '72 घंटों के भीतर दावा सूचित' }],
    appealOf: null,
    round: 1,
  };
  db.claims.unshift(record);
  return { status: 201, body: record };
});

register('GET', '/insurance/claims', ({ headers }) => {
  auth(headers);
  const list = [...getDb().claims].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return { status: 200, body: list };
});

register('GET', '/insurance/claims/:id', ({ headers, params }) => {
  auth(headers);
  const claim = getDb().claims.find((c) => c.id === params.id);
  if (!claim) throw demoError(404, 'CLAIM_NOT_FOUND', 'दावा नहीं मिला।');
  return { status: 200, body: claim };
});

register('POST', '/insurance/claims/:id/appeal', ({ headers, params, body }) => {
  auth(headers);
  const db = getDb();
  const orig = db.claims.find((c) => c.id === params.id);
  if (!orig) throw demoError(404, 'CLAIM_NOT_FOUND', 'दावा नहीं मिला।');
  if (orig.status !== 'rejected') {
    throw demoError(409, 'CLAIM_NOT_REJECTED', 'केवल अस्वीकृत दावे पर ही अपील की जा सकती है।');
  }
  const round = (orig.round ?? 1) + 1;
  if (round > 3) {
    throw demoError(409, 'APPEAL_LIMIT_REACHED', 'अपील की अधिकतम सीमा (2 बार) पूरी हो चुकी है।');
  }
  const b = (body ?? {}) as ClaimAppealBody;
  const claimId = id('claim');
  const at = nowIso();
  const record: InsuranceClaimRecord = {
    ...orig,
    id: claimId,
    claimNumber: nextClaimNumber(db.claims.length + 1),
    approvedAmount: null,
    status: 'intimated',
    statusText: 'अपील दर्ज — सर्वेयर नियुक्ति लंबित',
    damagePhotos: b.damagePhotos ?? [],
    submittedAt: at,
    dbtTransactionId: null,
    timeline: [{ status: 'intimated', at, note: b.appealNote || 'अपील पुनः दर्ज' }],
    appealOf: orig.id,
    round,
  };
  db.claims.unshift(record);
  const res: ClaimAppealRes = { id: claimId, appealOf: orig.id, status: 'intimated', round, submittedAt: at };
  return { status: 201, body: res };
});

// keep `today` import meaningful for coverageStartDate of applied policies
void today;
