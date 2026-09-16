import { register } from '../registry';
import { demoError, id, nowIso, requireAuth, requireRole } from '../util';
import type { DairyProductItem, GaushalaItem, PlantNursery, VetDoctor } from '@/api/types';

const GAUSHALAS: GaushalaItem[] = [
  { id: 'ga_1', name: 'Shree Gopal Gaushala', vernacularName: 'श्री गोपाल गौशाळा', trustName: 'Gopal Charitable Trust', address: 'Nashik Road, near MIDC', district: 'Nashik', distanceKm: 9.5, cowCount: 210, breeds: ['Gir', 'Sahiwal'], phone: '+919822200111', providesOrganicManure: true, offersCowAdoption: true, rating: 4.6, facilities: 'शेणखत, गोमूत्र, दत्तक योजना' },
  { id: 'ga_2', name: 'Sant Tukaram Goseva Kendra', vernacularName: 'संत तुकाराम गोसेवा केंद्र', trustName: 'Tukaram Goseva Sanstha', address: 'Sinnar–Pune highway', district: 'Nashik', distanceKm: 14.2, cowCount: 140, breeds: ['Gir', 'Khillar'], phone: '+919833300222', providesOrganicManure: true, offersCowAdoption: false, rating: 4.3, facilities: 'गांठे खत, वर्मीकंपोस्ट' },
  { id: 'ga_3', name: 'Ma Bhagwati Gaushala', vernacularName: 'मा भगवती गौशाळा', trustName: 'Bhagwati Seva Trust', address: 'Ozar, Nashik', district: 'Nashik', distanceKm: 22.8, cowCount: 320, breeds: ['Sahiwal', 'Red Sindhi'], phone: '+919844400333', providesOrganicManure: false, offersCowAdoption: true, rating: 4.1, facilities: 'दत्तक योजना, गौ-आधारित उत्पादने' },
];

const MANURE_PRODUCTS: Record<string, { label: string; ratePerUnit: number; unit: string }> = {
  cowDungManure: { label: 'शेणखत', ratePerUnit: 120, unit: 'quintal' },
  slurry: { label: 'गोमूत्र/स्लरी', ratePerUnit: 4, unit: 'litre' },
  vermicompost: { label: 'वर्मीकंपोस्ट', ratePerUnit: 350, unit: 'quintal' },
};

const NURSERIES: PlantNursery[] = [
  { id: 'nu_1', name: 'Sahyadri Plant Nursery', vernacularName: 'सह्याद्री रोपवाटिका', ownerName: 'Prakash Aher', location: 'Sinnar', distanceKm: 3.4, phone: '+919855500444', rating: 4.5, isGovtCertified: true, availableSaplings: ['mango', 'guava', 'neem', 'bamboo'], priceRange: '₹40–₹180' },
  { id: 'nu_2', name: 'GreenGold Nursery', vernacularName: 'ग्रीनगोल्ड नर्सरी', ownerName: 'Manisha Jadhav', location: 'Nashik Road', distanceKm: 11.0, phone: '+919866600555', rating: 4.2, isGovtCertified: false, availableSaplings: ['teak', 'custardApple', 'drumstick'], priceRange: '₹60–₹250' },
  { id: 'nu_3', name: 'Zilla Udyan Dept Nursery', vernacularName: 'जिल्हा उद्यान विभाग रोपवाटिका', ownerName: 'Govt of Maharashtra', location: 'Nashik', distanceKm: 18.5, phone: '+919877700666', rating: 4.0, isGovtCertified: true, availableSaplings: ['mango', 'amla', 'tamarind', 'karanj'], priceRange: '₹10–₹60' },
];

const VETS: VetDoctor[] = [
  { id: 'vet_1', name: 'Dr. Sanjay Pawar', qualification: 'BVSc & AH', specialization: 'largeAnimals', clinicAddress: 'Main Road, Sinnar', distanceKm: 2.8, phone: '+919888800777', experienceYears: 14, consultationFeeRupees: 300, rating: 4.7, availableForFarmVisit: true, nextAvailableSlot: '2026-09-14T10:00:00Z' },
  { id: 'vet_2', name: 'Dr. Meena Kulkarni', qualification: 'MVSc (Medicine)', specialization: 'dairyCattle', clinicAddress: 'Nashik Road Pet hospital', distanceKm: 10.6, phone: '+919899900888', experienceYears: 9, consultationFeeRupees: 450, rating: 4.5, availableForFarmVisit: true, nextAvailableSlot: '2026-09-14T12:30:00Z' },
  { id: 'vet_3', name: 'Dr. Arif Sheikh', qualification: 'BVSc & AH', specialization: 'poultry', clinicAddress: 'Ozar camp', distanceKm: 21.3, phone: '+919800000999', experienceYears: 7, consultationFeeRupees: 250, rating: 4.1, availableForFarmVisit: false, nextAvailableSlot: '2026-09-15T06:00:00Z' },
];

const DAIRY_PRODUCTS: DairyProductItem[] = [
  { id: 'dp_1', title: 'Desi Gir Cow Ghee', vernacularTitle: 'देशी गिर गायीचे तूप', farmName: 'Shree Gopal Gaushala', category: 'ghee', price: 1150, rating: 4.8, unit: '500ml', reviewsCount: 164, purityCertification: 'AGMARK', inStock: true, description: 'बिलोना पद्धतीने बनवलेले शुद्ध तूप' },
  { id: 'dp_2', title: 'A2 Cow Milk', vernacularTitle: 'A2 गायीचे दूध', farmName: 'Sahyadri Dairy Farm', category: 'milk', price: 78, rating: 4.5, unit: 'litre', reviewsCount: 322, purityCertification: 'FSSAI', inStock: true, description: 'रोज सकाळी घरपोच A2 दूध' },
  { id: 'dp_3', title: 'Fresh Paneer', vernacularTitle: 'ताजा पनीर', farmName: 'Sahyadri Dairy Farm', category: 'paneer', price: 380, rating: 4.4, unit: 'kg', reviewsCount: 98, purityCertification: 'FSSAI', inStock: false, description: 'गायीच्या दुधापासून बनवलेले पनीर' },
  { id: 'dp_4', title: 'Buffalo Curd', vernacularTitle: 'म्हशीचे दही', farmName: 'Wavi Mahila Dairy', category: 'curd', price: 60, rating: 4.3, unit: '500g', reviewsCount: 141, purityCertification: 'FSSAI', inStock: true, description: 'घट्ट दही, रोज ताजे' },
];

register('GET', '/gaushalas', ({ headers, query }) => {
  const user = requireAuth(headers);
  requireRole(user, ['farmer', 'seller']);
  let list = GAUSHALAS;
  if (query.district) list = list.filter((g) => g.district.toLowerCase() === query.district.toLowerCase());
  return { status: 200, body: [...list].sort((a, b) => a.distanceKm - b.distanceKm) };
});

register('POST', '/gaushalas/:id/manure-order', ({ headers, params, body }) => {
  const user = requireAuth(headers);
  requireRole(user, ['farmer']);
  const ga = GAUSHALAS.find((g) => g.id === params.id);
  if (!ga) throw demoError(404, 'NOT_FOUND', 'गौशाळा सापडली नाही.');
  if (!ga.providesOrganicManure) {
    throw demoError(409, 'MANURE_UNAVAILABLE', 'ही गौशाळा सध्या सेंद्रिय खत पुरवत नाही.');
  }
  const { product, quantity } = (body ?? {}) as { product?: string; quantity?: number };
  const opt = product ? MANURE_PRODUCTS[product] : undefined;
  if (!opt) throw demoError(422, 'VALIDATION_ERROR', 'अमान्य खत उत्पादन.', { product: 'invalid' });
  if (!quantity || quantity <= 0) {
    throw demoError(422, 'VALIDATION_ERROR', 'प्रमाण 0 पेक्षा जास्त असावे.', { quantity: 'min' });
  }
  return {
    status: 201,
    body: {
      id: id('mo'), gaushalaId: ga.id, product, productLabel: opt.label, quantity, unit: opt.unit,
      amountRupees: opt.ratePerUnit * quantity, status: 'requested', createdAt: nowIso(),
    },
  };
});

register('GET', '/nurseries', ({ headers }) => {
  const user = requireAuth(headers);
  requireRole(user, ['farmer', 'seller']);
  return { status: 200, body: [...NURSERIES].sort((a, b) => a.distanceKm - b.distanceKm) };
});

register('GET', '/vets', ({ headers, query }) => {
  const user = requireAuth(headers);
  requireRole(user, ['farmer']);
  let list = VETS;
  if (query.emergency === 'true') list = list.filter((v) => v.availableForFarmVisit);
  return { status: 200, body: [...list].sort((a, b) => a.distanceKm - b.distanceKm) };
});

register('POST', '/vets/:id/book', ({ headers, params, body }) => {
  const user = requireAuth(headers);
  requireRole(user, ['farmer']);
  const vet = VETS.find((v) => v.id === params.id);
  if (!vet) throw demoError(404, 'NOT_FOUND', 'पशुवैद्य सापडले नाहीत.');
  const { visitType, slot, animalType } = (body ?? {}) as { visitType?: string; slot?: string; animalType?: string };
  if (visitType !== 'farm' && visitType !== 'clinic') {
    throw demoError(422, 'VALIDATION_ERROR', 'भेट प्रकार farm किंवा clinic असावा.', { visitType: 'invalid' });
  }
  if (visitType === 'farm' && !vet.availableForFarmVisit) {
    throw demoError(409, 'FARM_VISIT_UNAVAILABLE', 'हे पशुवैद्य शेतभेटीसाठी उपलब्ध नाहीत.');
  }
  if (!slot) throw demoError(422, 'VALIDATION_ERROR', 'स्लॉट आवश्यक आहे.', { slot: 'required' });
  const feeRupees = vet.consultationFeeRupees + (visitType === 'farm' ? 200 : 0);
  return {
    status: 201,
    body: {
      id: id('vbk'), vetId: vet.id, vetName: vet.name, visitType, slot,
      animalType: animalType ?? 'cow', feeRupees, status: 'confirmed', createdAt: nowIso(),
    },
  };
});

register('GET', '/dairy-products', ({ headers, query }) => {
  const user = requireAuth(headers);
  requireRole(user, ['farmer', 'seller']);
  let list = DAIRY_PRODUCTS;
  if (query.category) list = list.filter((d) => d.category === query.category);
  return { status: 200, body: list };
});

register('POST', '/dairy-products/:id/order', ({ headers, params, body }) => {
  const user = requireAuth(headers);
  requireRole(user, ['farmer', 'seller']);
  const product = DAIRY_PRODUCTS.find((d) => d.id === params.id);
  if (!product) throw demoError(404, 'NOT_FOUND', 'उत्पादन सापडले नाही.');
  if (!product.inStock) throw demoError(409, 'OUT_OF_STOCK', 'हे उत्पादन सध्या स्टॉकमध्ये नाही.');
  const { quantity } = (body ?? {}) as { quantity?: number };
  if (!quantity || quantity <= 0) {
    throw demoError(422, 'VALIDATION_ERROR', 'प्रमाण 0 पेक्षा जास्त असावे.', { quantity: 'min' });
  }
  return {
    status: 201,
    body: {
      id: id('dpo'), productId: product.id, title: product.vernacularTitle, quantity, unit: product.unit,
      amountRupees: product.price * quantity, status: 'placed', createdAt: nowIso(),
    },
  };
});
