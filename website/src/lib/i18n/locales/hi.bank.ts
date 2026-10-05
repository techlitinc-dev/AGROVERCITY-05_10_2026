import { registerLocale } from '../index';

/**
 * Bank "CreditDesk" module strings — Hindi (merged into `hi`, falls back to en
 * for gaps). Bank vocabulary: disbursal→वितरण, EMI→किस्त, approval→अनुमोदन.
 */

const hiBank: Record<string, string> = {
  // ---- Shared ----
  bankLoadFailed: 'ऋण जानकारी नहीं मिली। फिर कोशिश करें।',
  bankLoading: 'लोड हो रहा है...',
  bankNotAvailable: '—',
  bankActionFailed: 'कार्रवाई नहीं हो सकी। फिर कोशिश करें।',

  // ---- Home board ----
  bankHomeTitle: 'क्रेडिटडेस्क — बैंक होम',
  bankHomeSub: 'आपकी दैनिक ऋण सूची एक नज़र में',
  bankStatPendingReview: 'समीक्षा बाकी',
  bankStatTotalApplications: 'कुल आवेदन',
  bankStatApprovalsToday: 'आज के अनुमोदन',
  bankStatDisbursalsWeek: 'इस सप्ताह के वितरण',
  bankDisbursalUnit: 'वितरण',
  bankStatAtRisk: 'जोखिम वाले खाते',
  bankStatCollectionRate: 'किस्त वसूली दर',
  bankSlaSection: 'SLA के अनुसार सूची गहराई',
  bankSlaBreach: 'समय सीमा टूटी (>48घं)',
  bankSlaDueSoon: 'जल्द देय (24–48घं)',
  bankSlaOnTrack: 'समय पर',
  bankPortfolioSection: 'पोर्टफोलियो कुल',
  bankPortfolioSanctioned: 'स्वीकृत',
  bankPortfolioDisbursed: 'वितरित',
  bankPortfolioOutstanding: 'बकाया',

  // ---- Queue ----
  bankQueueTitle: 'ऋण समीक्षा सूची',
  bankQueueSub: 'स्थिति, राशि और ज़िले से छाँटें',
  bankQueueEmpty: 'इन फ़िल्टरों से कोई आवेदन मेल नहीं खाता',
  bankQueueTotal: '{count} आवेदन',
  bankPrev: 'पिछला',
  bankNext: 'अगला',
  bankFilterStatus: 'स्थिति',
  bankFilterAllStatuses: 'सभी स्थितियाँ',
  bankFilterDistrict: 'ज़िला',
  bankFilterDistrictPlaceholder: 'जैसे पुणे',
  bankFilterMinAmount: 'न्यूनतम राशि (₹)',
  bankFilterMaxAmount: 'अधिकतम राशि (₹)',
  bankColApplication: 'आवेदन',
  bankColFarmer: 'किसान',
  bankColAmount: 'राशि',
  bankColDistrict: 'ज़िला',
  bankColStatus: 'स्थिति',
  bankColAi: 'AI टिप्पणी',
  bankColCreditScore: 'क्रेडिट स्कोर',
  bankColDaysOverdue: 'बकाया दिन',
  bankColInstallment: 'किस्त सं.',
  bankColDueDate: 'देय तिथि',
  bankColEmi: 'किस्त',
  bankColPrincipal: 'मूलधन',
  bankColInterest: 'ब्याज',
  bankColOutstanding: 'शेष',

  // ---- Statuses ----
  bank_status_submitted: 'जमा हुआ',
  bank_status_underReview: 'समीक्षा में',
  bank_status_infoRequested: 'जानकारी मांगी',
  bank_status_approved: 'अनुमोदित',
  bank_status_rejected: 'अस्वीकृत',
  bank_status_disbursed: 'वितरित',
  bank_status_cancelled: 'रद्द',

  // ---- Stage timeline ----
  bankStage_submitted: 'जमा हुआ',
  bankStage_underReview: 'समीक्षा में',
  bankStage_infoRequested: 'जानकारी मांगी',
  bankStage_approved: 'अनुमोदित',
  bankStage_disbursed: 'वितरित',

  // ---- AI annotation badges (WS-07 M14 seam) ----
  bankAiRiskBand: 'जोखिम',
  bankAiMissingDocs: 'छूटे दस्तावेज़',
  bankRisk_low: 'कम',
  bankRisk_medium: 'मध्यम',
  bankRisk_high: 'उच्च',

  // ---- Portfolio ----
  bankPortfolioTitle: 'ऋण पोर्टफोलियो',
  bankPortfolioSub: 'NPA निगरानी सूची और किस्त वसूली दर',
  bankNpaSection: 'NPA निगरानी सूची',
  bankNpaEmpty: 'कोई जोखिम वाला खाता नहीं — पोर्टफोलियो स्वस्थ',

  // ---- Detail action bar ----
  bankBackToQueue: 'सूची पर वापस',
  bankActionBarTitle: 'निर्णय',
  bankActionReview: 'समीक्षा शुरू करें',
  bankActionApprove: 'अनुमोदन',
  bankActionReject: 'अस्वीकार',
  bankActionRequestInfo: 'जानकारी मांगें',
  bankActionDisburse: 'वितरण',
  bankSubmitApprove: 'अनुमोदन पक्का करें',
  bankSubmitReject: 'अस्वीकृति पक्की करें',
  bankSubmitInfo: 'अनुरोध भेजें',
  bankFieldReason: 'कारण / टिप्पणी (आवश्यक)',
  bankFieldRejectReason: 'अस्वीकृति का कारण',
  bankFieldInfoNote: 'क्या जानकारी चाहिए',
  bankFieldSanctioned: 'स्वीकृत राशि (₹)',
  bankFieldInterestRate: 'ब्याज दर (%)',
  bankFieldTenure: 'अवधि (महीने)',
  bankFieldDisbursementRef: 'वितरण संदर्भ (UTR)',
  bankConfirmDisburse: 'वितरण के लिए फिर क्लिक करें',
  bankConfirmDisburseHint: 'वितरण पूर्ववत नहीं हो सकता।',

  // ---- Detail sections ----
  bankSectionLoan: 'आवेदन',
  bankSectionEmiSchedule: 'किस्त अनुसूची',
  bankSectionProfile: 'किसान प्रोफ़ाइल',
  bankSectionCredit: 'क्रेडिट और भूमि',
  bankSectionKcc: 'किसान क्रेडिट कार्ड',
  bankSectionRepayment: 'भुगतान इतिहास',
  bankSectionDocuments: 'दस्तावेज़',
  bankDocumentsEmpty: 'अभी कोई दस्तावेज़ अपलोड नहीं हुआ',
  bankRepaymentEmpty: 'कोई अन्य ऋण रिकॉर्ड नहीं',
  bankFieldPurpose: 'उद्देश्य',
  bankFieldCreated: 'बनाया गया',
  bankFieldName: 'नाम',
  bankFieldPhone: 'फ़ोन',
  bankFieldVillage: 'गाँव',
  bankFieldDistrict: 'ज़िला',
  bankFieldCreditScore: 'क्रेडिट स्कोर',
  bankFieldCreditTier: 'क्रेडिट श्रेणी',
  bankFieldLand: 'भूमि (एकड़)',
  bankFieldCrops: 'मुख्य फ़सलें',
  bankFieldBank: 'बैंक',
  bankFieldCardMasked: 'कार्ड',
  bankFieldKccLimit: 'KCC सीमा',
  bankFieldKccAvailable: 'उपलब्ध सीमा',
  bankKccNone: 'इस किसान से कोई KCC जुड़ा नहीं है',

  // ---- Farmer loan mirror ----
  bankTrackingTitle: 'मेरे ऋण आवेदन',
  bankTrackingSub: 'अपने आवेदन का चरण देखें और दस्तावेज़ अनुरोध का उत्तर दें',
  bankTrackingEmpty: 'आपका अभी कोई ऋण आवेदन नहीं है',
  bankDocRequestTitle: 'दस्तावेज़ मांगे गए',
  bankDocUploadLabel: 'दस्तावेज़ अपलोड करें',
  bankDocsUploadedNote: 'दस्तावेज़ अपलोड हो गए',
  bankShowSchedule: 'किस्त अनुसूची दिखाएँ',
  bankHideSchedule: 'किस्त अनुसूची छिपाएँ',
};

registerLocale('hi', hiBank);
