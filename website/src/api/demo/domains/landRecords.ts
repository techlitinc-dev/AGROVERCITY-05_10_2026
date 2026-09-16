import { register } from '../registry';
import { demoError, nowIso, requireAuth, requireRole } from '../util';
import { getDb, saveDb } from '../db';
import type { FarmerProfile, LandRecord712 } from '@/api/types';

// mahabhulekh-style demo records; lazily merged into the shared store on first search
const SEED_RECORDS: LandRecord712[] = [
  {
    id: 'lr_1', gatNumber: '45/1', village: 'Sinnar', district: 'Nashik', ownerName: 'Ram Singh',
    khataNumber: 'K-1187', totalAreaHectares: 2.23, totalAreaAcres: 5.5, landClass: 'jirayat',
    soilType: 'blackCotton', irrigation: 'drip', ferfarNumber: 'F-2024-0451', cropHistory: 'onion (2025), wheat (2024), tomato (2023)',
  },
  {
    id: 'lr_2', gatNumber: '45/2', village: 'Sinnar', district: 'Nashik', ownerName: 'Ram Singh',
    khataNumber: 'K-1187', totalAreaHectares: 0.81, totalAreaAcres: 2.0, landClass: 'bagayat',
    soilType: 'blackCotton', irrigation: 'well', ferfarNumber: 'F-2024-0452', cropHistory: 'tomato (2025), onion (2024)',
  },
  {
    id: 'lr_3', gatNumber: '112/A', village: 'Sinnar', district: 'Nashik', ownerName: 'Savita Patil',
    khataNumber: 'K-0932', totalAreaHectares: 1.62, totalAreaAcres: 4.0, landClass: 'jirayat',
    soilType: 'mediumBlack', irrigation: 'rainfed', ferfarNumber: 'F-2023-1120', cropHistory: 'soybean (2025), wheat (2024)',
  },
  {
    id: 'lr_4', gatNumber: '207', village: 'Wavi', district: 'Nashik', ownerName: 'Dattatray Shinde',
    khataNumber: 'K-2201', totalAreaHectares: 3.44, totalAreaAcres: 8.5, landClass: 'bagayat',
    soilType: 'blackCotton', irrigation: 'canal', ferfarNumber: 'F-2022-0207', cropHistory: 'grape (2025), grape (2024)',
  },
  {
    id: 'lr_5', gatNumber: '88/3B', village: 'Pimpalgaon', district: 'Nashik', ownerName: 'Haribhau More',
    khataNumber: 'K-1544', totalAreaHectares: 1.21, totalAreaAcres: 3.0, landClass: 'jirayat',
    soilType: 'sandyLoam', irrigation: 'borewell', ferfarNumber: 'F-2024-0883', cropHistory: 'onion (2025), maize (2024)',
  },
];

function ensureRecords(): LandRecord712[] {
  const db = getDb();
  if (db.landRecords.length === 0) db.landRecords.push(...SEED_RECORDS);
  return db.landRecords;
}

function stripMpin(u: { mpin: string } & FarmerProfile): FarmerProfile {
  const { mpin: _m, ...profile } = u;
  return profile;
}

register('GET', '/land-records/search', ({ headers, query }) => {
  const user = requireAuth(headers);
  requireRole(user, ['farmer', 'farmLandlord']);
  const { gatNumber, village, district } = query;
  const type = query.type ?? '712';
  if (type !== '712' && type !== '8A') {
    throw demoError(422, 'VALIDATION_ERROR', 'रिकॉर्ड प्रकार 712 किंवा 8A असावा.', { type: 'invalid' });
  }
  if (!gatNumber && !village) {
    throw demoError(422, 'VALIDATION_ERROR', 'गट क्रमांक किंवा गावाचे नाव आवश्यक आहे.', { gatNumber: 'required' });
  }
  let list = ensureRecords();
  if (gatNumber) {
    if (!/^[A-Za-z0-9/]{1,20}$/.test(gatNumber)) {
      throw demoError(422, 'VALIDATION_ERROR', 'गट क्रमांक 1–20 अक्षरांकी असावा.', { gatNumber: 'invalid' });
    }
    list = list.filter((r) => r.gatNumber.toLowerCase() === gatNumber.toLowerCase());
  } else if (village) {
    if (village.trim().length < 3) {
      throw demoError(422, 'VALIDATION_ERROR', 'गावाचे नाव किमान 3 अक्षरे असावे.', { village: 'minLength' });
    }
    const q = village.trim().toLowerCase();
    list = list.filter((r) => r.village.toLowerCase().includes(q));
  }
  if (district) list = list.filter((r) => r.district.toLowerCase() === district.toLowerCase());
  return { status: 200, body: { type, results: list } };
});

register('GET', '/land-records/:id/pdf', ({ headers, params }) => {
  const user = requireAuth(headers);
  requireRole(user, ['farmer', 'farmLandlord']);
  const record = ensureRecords().find((r) => r.id === params.id);
  if (!record) throw demoError(404, 'NOT_FOUND', 'जमीन रिकॉर्ड सापडला नाही.');
  return {
    status: 200,
    body: {
      id: record.id,
      pdfUrl: `https://demo.local/land-records/${record.id}.pdf`,
      fileName: `712-utara-${record.gatNumber.replace(/\//g, '-')}.pdf`,
    },
  };
});

register('POST', '/land-records/:id/import', ({ headers, params }) => {
  const user = requireAuth(headers);
  requireRole(user, ['farmer', 'farmLandlord']);
  const db = getDb();
  const record = ensureRecords().find((r) => r.id === params.id);
  if (!record) throw demoError(404, 'NOT_FOUND', 'जमीन रिकॉर्ड सापडला नाही.');
  const u = db.users[user.uid];
  const alreadyPlotted = db.farmPlots.some((p) => p.khasraNumber === record.gatNumber);
  if (!alreadyPlotted) {
    db.farmPlots.push({
      id: `fplot_${record.id}`,
      farmerId: user.uid,
      name: `${record.village} ${record.gatNumber}`,
      areaAcres: record.totalAreaAcres,
      soilType: record.soilType ?? u.soilType,
      irrigationType: u.irrigationType,
      khasraNumber: record.gatNumber,
      boundaryPoints: [],
      isPrimary: db.farmPlots.length === 0,
      currentCrop: null,
      createdAt: nowIso(),
    });
  }
  u.landAreaAcres = db.farmPlots
    .filter((p) => p.farmerId === user.uid)
    .reduce((sum, p) => sum + p.areaAcres, 0);
  if (record.soilType) u.soilType = record.soilType;
  saveDb();
  return { status: 200, body: { imported: true, record, profile: stripMpin(u) } };
});
