import { registerLocale } from '../index';

/**
 * Farmer finance ("KisanCredit") strings — merged into `hi`.
 * Key catalog is the contract for every view under views/finance/.
 */

const hiFinance: Record<string, string> = {
  // ---- Tool-tile labels for the finance sub-pages ----
  tool_creditScore: 'क्रेडिट स्कोर',
  tool_creditScore_sub: 'किसान क्रेडिट रेटिंग',
  tool_loanMarketplace: 'ऋण बाज़ार',
  tool_loanMarketplace_sub: 'अपने ऑफ़र तुलना करें',
  tool_emiCalculator: 'EMI कैलकुलेटर',
  tool_emiCalculator_sub: 'भुगतान की योजना',
  tool_loanWizard: 'ऋण के लिए आवेदन',
  tool_loanWizard_sub: 'बहु-चरण आवेदन',
  tool_loanStatus: 'ऋण स्थिति',
  tool_loanStatus_sub: 'आवेदन ट्रैक करें',

  // ---- Credit score ----
  financeTitle: 'किसान क्रेडिट',
  financeIntro: 'आपका क्रेडिट स्कोर, KCC, ऋण बाज़ार और आवेदन ट्रैकर।',
  financeCreditTitle: 'किसान क्रेडिट स्कोर',
  financeScoreLabel: 'स्कोर',
  financeTierLabel: 'श्रेणी',
  financeLimitLabel: 'क्रेडिट सीमा',
  financeFactors: 'कारक',
  financeNoScore: 'अभी कोई स्कोर नहीं',
  financeNoScoreBody: 'ब्यूरो रिपोर्ट करने पर आपका किसान क्रेडिट स्कोर यहाँ दिखेगा।',
  financeLoadFailed: 'वित्त डेटा लोड नहीं हो सका। कृपया पुनः प्रयास करें।',

  // ---- KCC card ----
  financeKccTitle: 'किसान क्रेडिट कार्ड',
  financeKccBank: 'बैंक',
  financeKccCard: 'कार्ड',
  financeKccLimit: 'सीमा',
  financeKccAvailable: 'उपलब्ध',
  financeKccNotLinked: 'कोई KCC जुड़ा नहीं',
  financeKccNotLinkedBody: 'आपके खाते से जुड़ा किसान क्रेडिट कार्ड यहाँ दिखेगा।',

  // ---- Loan marketplace ----
  financeMarketTitle: 'ऋण बाज़ार',
  financeMarketIntro: 'अपने ऋण आवेदनों की तुलना करें।',
  financeMarketEmpty: 'अभी कोई ऋण आवेदन नहीं',
  financeMarketEmptyBody: 'ऋण के लिए आवेदन करें और तुलना हेतु आपके ऑफ़र यहाँ दिखेंगे।',
  financeOfferAmount: 'राशि',
  financeOfferRate: 'ब्याज दर',
  financeOfferTenure: 'अवधि',
  financeOfferEmi: 'EMI',

  // ---- EMI calculator ----
  financeEmiTitle: 'EMI कैलकुलेटर',
  financeEmiPrincipal: 'मूलधन (₹)',
  financeEmiRate: 'ब्याज दर (% / वर्ष)',
  financeEmiTenure: 'अवधि (महीने)',
  financeEmiResult: 'परिणाम',
  financeEmiMonthly: 'मासिक EMI',
  financeEmiTotalInterest: 'कुल ब्याज',
  financeEmiTotalPayable: 'कुल देय',
  financeEmiInvalid: 'मूलधन, दर और अवधि दर्ज करें',

  // ---- Loan wizard ----
  financeWizardTitle: 'ऋण के लिए आवेदन',
  financeWizardIntro: 'तीन त्वरित चरण: राशि, उद्देश्य, समीक्षा।',
  financeWizardAmount: 'ऋण राशि (₹)',
  financeWizardTenure: 'अवधि (महीने)',
  financeWizardPurpose: 'उद्देश्य',
  financeWizardSubmit: 'आवेदन जमा करें',
  financeWizardSuccess: 'आवेदन जमा हुआ',
  financeWizardInvalid: 'राशि, अवधि और उद्देश्य भरें',
  financeWizardViewStatus: 'स्थिति देखें',

  // ---- Loan status ----
  financeStatusTitle: 'ऋण स्थिति',
  financeStatusEmpty: 'अभी कोई ऋण आवेदन नहीं',
  financeStatusEmptyBody: 'आपके जमा किए आवेदन यहाँ स्थिति टाइमलाइन के साथ दिखेंगे।',
  financeStatusTimeline: 'स्थिति टाइमलाइन',
  financeStatusApplication: 'आवेदन',
};

registerLocale('hi', hiFinance);
