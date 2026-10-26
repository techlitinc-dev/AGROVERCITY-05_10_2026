/**
 * Shared test data — mirrors the "Test data table" in manual_test/01_farmer.md.
 * Every spec maps to TC-FRM-* cases from that document.
 */
export const API_BASE = process.env.API_BASE_URL || 'http://localhost:8000/v1';

export const FARMER = {
  phone: '+919822000001',
  phoneLocal: '9822000001',
  mpin: '4321',
  name: 'Ramesh Patil',
  vernacularName: 'रमेश पाटील',
  state: 'Maharashtra',
  district: 'Nashik',
  village: 'Pimpalgaon Baswant',
  farmSizeAcres: 3,
  gatNo: '312',
  hissa: '2',
  crops: ['Grapes (Thompson Seedless)', 'Onion (Nashik Red)'],
  bank: {
    holder: 'Ramesh Patil',
    name: 'State Bank of India',
    account: '30012345678',
    ifsc: 'SBIN0001234',
  },
  upi: 'ramesh.patil@upi',
  lotOnion: {
    crop: 'Onion',
    variety: 'Nashik Red',
    grade: 'A',
    quantityQ: 20,
    expectedRate: 1450,
    harvestDate: '2026-10-25',
    village: 'Pimpalgaon Baswant',
    pickup: 'Gate 312',
  },
  lotGrapes: {
    crop: 'Grapes',
    variety: 'Thompson Seedless',
    grade: 'A',
    quantityQ: 10,
    expectedRate: 2800,
    harvestDate: '2026-10-30',
  },
  diaryExpense: {
    title: 'Urea fertiliser',
    category: 'Fertilizers',
    crop: 'Onion',
    party: 'Krushi Kendra Pimpalgaon',
    amount: 2400,
    notes: 'for 1 acre',
  },
};

export const ADMIN = { phone: '+919000000001', mpin: '1234' };

/** Fresh phone for registration tests (TC-FRM-01) — never registered before. */
export function freshPhone(): string {
  return `98220${String(Date.now()).slice(-5).padStart(5, '0')}`;
}
