import { registerLocale } from '../index';

/**
 * Post-harvest farmer face (cold storage, my bookings, receipts vault, AI
 * grading) strings — merged into `hi`.
 * Same key set as `en.postHarvest.ts` (parity-checked).
 */

const hiPostHarvest: Record<string, string> = {
  // ---- Cold storage directory (live capacity) ----
  coldStorageTitle: 'कोल्ड स्टोरेज व गोदाम',
  coldStorageHint: 'शेष क्षमता संचालक से लाइव आती है।',
  coldStorageEmpty: 'आपके पास कोई कोल्ड स्टोरेज या गोदाम नहीं मिला।',
  coldStorageLoadFailed: 'कोल्ड स्टोरेज लोड नहीं हो सके।',
  coldStorageCapacityLeft: '{available} मीट्रिक टन खाली',
  coldStorageDistance: '{distance} किमी दूर',
  coldStorageTemp: '{range}',
  coldStorageRate: '₹{rate}/क्विंटल/माह',
  coldStorageSupportedCrops: 'फसलें',
  coldStorageWdra: 'WDRA',
  coldStorageBook: 'स्लॉट बुक करें',
  coldStorageBookSubmit: 'बुकिंग पक्की करें',
  coldStorageBooked: 'कक्ष स्लॉट बुक हो गया।',
  coldStorageBookingFailed: 'स्लॉट बुक नहीं हो सका।',
  coldStorageQuantity: 'मात्रा (क्विंटल)',
  coldStorageFrom: 'आरंभ तिथि',
  coldStorageMonths: 'महीने',
  coldStorageEstimatedRent: 'अनुमानित किराया: {amount}',

  // ---- My storage bookings ----
  myBookingsTitle: 'मेरी भंडारण बुकिंग',
  myBookingsEmpty: 'अभी कोई भंडारण बुकिंग नहीं।',
  myBookingsLoadFailed: 'आपकी भंडारण बुकिंग लोड नहीं हो सकीं।',
  myBookingsStatus: 'स्थिति',
  myBookingsQty: '{qty} क्विंटल',
  myBookingsFrom: '{date} से',
  myBookingsMonths: '{months} माह',

  // ---- Warehouse receipts vault ----
  receiptsVaultTitle: 'गोदाम रसीद तिजोरी',
  receiptsVaultHint: 'आपकी भंडारित उपज की सत्यापनीय e-NWR रसीदें।',
  receiptsVaultEmpty: 'अभी कोई गोदाम रसीद नहीं।',
  receiptsVaultLoadFailed: 'आपकी गोदाम रसीदें लोड नहीं हो सकीं।',
  receiptCollateralLabel: 'ऋण के लिए संपार्श्विक रूप में उपयोग योग्य',
  receiptDownload: 'डाउनलोड',
  receiptNumberLabel: 'रसीद सं.',
  receiptCropLabel: 'फसल',
  receiptGradeLabel: 'गुणवत्ता ग्रेड',
  receiptNetLabel: 'शुद्ध (क्विंटल)',
  receiptFacilityLabel: 'सुविधा',
  receiptIssuedLabel: 'जारी',

  // ---- AI produce grading (M10) ----
  gradingTitle: 'AI उपज ग्रेडिंग',
  gradingHint: 'ग्रेड और सुझाया गया मूल्य बैंड पाने के लिए अपनी उपज की फोटो लें।',
  gradingChoosePhotos: '1–3 उपज फोटो चुनें',
  gradingCrop: 'फसल',
  gradingQuantity: 'मात्रा (क्विंटल)',
  gradingMandiModal: 'आज का मंडी भाव (₹/क्विंटल)',
  gradingAnalyze: 'उपज ग्रेड करें',
  gradingAnalyzeFailed: 'फोटो ग्रेड नहीं हो सकीं।',
  gradingAiEstimateLabel: 'AI अनुमान',
  gradingDemoLabel: 'डेमो',
  gradingGrade: 'ग्रेड',
  gradingShelfLife: 'शेल्फ लाइफ: {days} दिन',
  gradingUniformity: 'एकरूपता: {percent}%',
  gradingPriceBand: 'सुझाया मूल्य: {low} – {high} प्रति क्विंटल',
  gradingVsMandi: 'मंडी के मुकाबले {delta}%',
  gradingVsMandiUnavailable: 'तुलना हेतु मंडी भाव उपलब्ध नहीं',
  gradingConfidence: 'विश्वास: {value}%',
  gradingPendingHuman: 'कम विश्वास — मानव ग्रेडर को भेजा गया।',
  gradingListAsLot: 'लॉट के रूप में सूचीबद्ध करें',
};

registerLocale('hi', hiPostHarvest);
