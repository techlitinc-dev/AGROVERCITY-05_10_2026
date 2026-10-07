import { registerLocale } from '../index';

/**
 * Government-schemes ("SchemeFinder") strings — merged into `hi`.
 * Key catalog is the contract for every view under views/schemes/.
 */

const hiSchemes: Record<string, string> = {
  // ---- Discovery list ----
  schemesTitle: 'सरकारी योजनाएँ',
  schemesIntro: 'आपके खेत के लिए योजनाएँ, पहले आपकी प्रोफ़ाइल से मेल खाती हुई।',
  schemesEligibleOnly: 'केवल पात्र',
  schemesMatchedFirst: 'पहले आपकी प्रोफ़ाइल से मेल',
  schemesFitBadge: 'मेल {score}',
  schemesMissingDocs: 'बाकी: {docs}',
  schemesNoMissing: 'सभी दस्तावेज़ मौजूद',
  schemesEligible: 'पात्र',
  schemesNotEligible: 'अपात्र',
  schemesViewDetail: 'विवरण देखें',
  schemesEmpty: 'कोई योजना नहीं मिली',
  schemesEmptyBody: 'आपकी प्रोफ़ाइल से मेल खाती योजनाएँ यहाँ दिखेंगी।',
  schemesLoadFailed: 'योजनाएँ लोड नहीं हो सकीं। कृपया पुनः प्रयास करें।',
  schemesDeadline: 'अंतिम तिथि: {date}',
  schemesExplanation: 'यह क्यों मेल खाती है',
  schemesLoadMore: 'और दिखाएँ',

  // ---- Detail ----
  schemesDetailEligibility: 'पात्रता चेकलिस्ट',
  schemesCriterionMet: 'पूरा',
  schemesCriterionUnmet: 'अपूर्ण',
  schemesCriteria_maxLandAcres: 'भूमि {max} एकड़ तक (आपकी: {actual})',
  schemesCriteria_states: 'उपलब्ध: {states}',
  schemesCriteria_requiresKcc: 'किसान क्रेडिट कार्ड (KCC) आवश्यक',
  schemesRequiredDocs: 'आवश्यक दस्तावेज़',
  schemesDocPresent: 'वॉल्ट में',
  schemesDocMissing: 'बाकी',
  schemesUploadToVault: 'दस्तावेज़ वॉल्ट में जोड़ें',
  schemesApplyInApp: 'ऐप में आवेदन करें (ट्रैक किया गया)',
  schemesApplyExternal: 'आधिकारिक पोर्टल पर आवेदन करें (बाहरी)',
  schemesApplySuccess: 'आवेदन जमा हुआ',
  schemesAlreadyApplied: 'आप पहले ही आवेदन कर चुके हैं',
  schemesNotEligibleApply: 'आप आवेदन के लिए पात्र नहीं हैं',
  schemesNotEligibleHint: 'यह योजना इस समय आपकी प्रोफ़ाइल से मेल नहीं खाती।',
  schemesVaultHint: 'बाकी दस्तावेज़ अपलोड करें, फिर आवेदन करें।',
};

registerLocale('hi', hiSchemes);
