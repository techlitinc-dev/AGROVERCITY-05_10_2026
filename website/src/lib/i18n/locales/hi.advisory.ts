import { registerLocale } from '../index';

/**
 * Advisory hub strings (market saturation, disease scan, NPK, pest radar,
 * Kisan Mitra launcher) — merged into `hi`.
 * Key catalog must stay identical to en.advisory.ts.
 */

const hiAdvisory: Record<string, string> = {
  // ---- Hub shell ----
  // (tool_advisoryHub / tool_advisoryHub_sub mirror en.advisory.ts.)
  tool_advisoryHub: 'सलाह केंद्र',
  tool_advisoryHub_sub: 'संतृप्ति · जाँच · पोषक तत्व',
  advisoryTitle: 'फसल सलाह केंद्र',
  advisoryHubIntro: 'आपके खेत की जानकारी — बाज़ार की भीड़, रोग जाँच, पोषक तत्व और कीट अलर्ट।',
  advisoryTabSaturation: 'बाज़ार संतृप्ति',
  advisoryTabDisease: 'रोग जाँच',
  advisoryTabNpk: 'एनपीके कैलकुलेटर',
  advisoryTabPestRadar: 'कीट रडार',
  advisoryTabKisanMitra: 'किसान मित्र',

  // ---- (a) Market Saturation (M13) ----
  advisorySaturationTitle: 'बाज़ार संतृप्ति',
  advisorySaturationConsent:
    'मैं सहमत हूँ कि मेरी फसल और बुवाई की योजना गुमनाम रूप से और समग्र रूप में साझा की जाए, तथा मेरे ज़िले के अन्य किसानों की साझा बुवाई जानकारी से संतृप्ति दिखाई जाए।',
  advisorySaturationCrop: 'फसल',
  advisorySaturationDistrict: 'ज़िला',
  advisorySaturationRadius: 'दायरा (किमी)',
  advisorySaturationRun: 'संतृप्ति देखें',
  advisorySaturationCount: '{count} साझा बुवाई जानकारियों के आधार पर',
  advisorySaturationExpectedIncrease: 'अनुमानित आवक: {value}',
  advisorySaturationPredictedPrice: 'मंडी-आधारित संकेत मूल्य: {price} प्रति क्विंटल',
  advisorySaturationPriceUnavailable: 'इस फसल का मंडी मूल्य डेटा अभी नहीं है',
  advisorySaturationPredictedDate: '{date} तक अनुमानित',
  advisorySaturationAlternatives: 'वैकल्पिक फसलें',
  advisorySaturationAlternativesEmpty: 'किसी वैकल्पिक फसल का मंडी मूल्य डेटा अभी नहीं है।',
  advisorySaturationRiskGreen: 'कम संतृप्ति — और बुवाई सुरक्षित है',
  advisorySaturationRiskYellow: 'मध्यम संतृप्ति — आवक पर नज़र रखें',
  advisorySaturationRiskRed: 'अधिक संतृप्ति — वैकल्पिक फसल सोचें',
  advisoryLocationRequired:
    'संतृप्ति देखने के लिए अपना खेत स्थान जोड़ें (या ब्राउज़र की लोकेशन की अनुमति दें)।',

  // ---- Shared: data-basis citation (M13) ----
  advisoryDataBasis: '{district} में {count} बुवाई जानकारियों के आधार पर',
  advisoryDataBasisUnavailable: 'इस ज़िले की कोई साझा बुवाई जानकारी अभी नहीं है',

  // ---- (c) NPK calculator ----
  advisoryNpkTitle: 'एनपीके कैलकुलेटर',
  advisoryNpkCrop: 'फसल',
  advisoryNpkSoil: 'मिट्टी का प्रकार',
  advisoryNpkN: 'मिट्टी N (किग्रा/हेक्टेयर)',
  advisoryNpkP: 'मिट्टी P (किग्रा/हेक्टेयर)',
  advisoryNpkK: 'मिट्टी K (किग्रा/हेक्टेयर)',
  advisoryNpkRun: 'सिफ़ारिश पाएँ',
  advisoryNpkResults: 'प्रति एकड़ डालने वाली खाद',
  advisoryNpkUrea: 'यूरिया',
  advisoryNpkDap: 'DAP',
  advisoryNpkMop: 'MOP',

  // ---- (d) Pest radar ----
  advisoryPestTitle: 'कीट रडार (5 किमी)',
  advisoryPestRadius: 'दायरा (किमी)',
  advisoryPestRefresh: 'रीफ़्रेश करें',
  advisoryPestEmpty: '{radius} किमी के भीतर कोई कीट रिपोर्ट नहीं।',
  advisoryPestDistance: '{distance} किमी दूर',
  advisoryPestReported: '{date} को रिपोर्ट',

  // ---- (e) Kisan Mitra ----
  advisoryKisanMitraTitle: 'किसान मित्र से पूछें',
  advisoryKisanMitraBody:
    'खेती, बाज़ार और योजना से जुड़े सवालों के लिए किसान मित्र सहायक से बात करें।',
  advisoryKisanMitraLaunch: 'किसान मित्र खोलें',

  // ---- Crop planner (M13) ----
  advisoryCropPlannerOpen: 'फसल योजना खोलें',
  cropPlannerTitle: 'एआई फसल योजना',
  cropPlannerSoil: 'मिट्टी का प्रकार',
  cropPlannerIrrigation: 'सिंचाई',
  cropPlannerSize: 'खेत का आकार (एकड़)',
  cropPlannerHistory: 'हाल की फसलें (कॉमा से अलग)',
  cropPlannerDistrict: 'ज़िला',
  cropPlannerRun: 'फसलें सुझाएँ',
  cropPlannerOptions: 'सुझाई गई फसलें',
  cropPlannerRationale: 'कारण',
  cropPlannerEstRevenue: 'अनुमानित आय: {price}',
  cropPlannerConfirm: 'पुष्टि करें और योजना बनाएँ',
  cropPlannerConfirmed: 'योजना की पुष्टि हुई — फसल चक्र और कार्य बन गए।',
  cropPlannerCached: 'कैश की गई सलाह',

  // ---- Disease scan (M9) ----
  diseaseScanTitle: 'रोग जाँच',
  diseaseScanChoose: 'पत्ती की फोटो चुनें',
  diseaseScanHint: 'एक पत्ती फ्रेम में भरकर, अच्छी रोशनी में साफ़ फोटो लें।',
  diseaseScanPlotId: 'प्लॉट (वैकल्पिक)',
  diseaseScanAnalyze: 'पत्ती जाँचें',
  diseaseScanRetakeNotLeaf:
    'यह पौधे की पत्ती नहीं लगती — कृपया एक पत्ती को फ्रेम में भरकर फोटो लें।',
  diseaseScanRetakeBlurry:
    'फोटो धुंधली या कम रोशनी वाली है — दिन के उजाले में पत्ती पर फोकस करके दोबारा लें।',
  diseaseScanDemoLabel: 'डेमो',
  diseaseScanDiagnosis: 'निदान',
  diseaseScanConfidence: 'विश्वास: {value}',
  diseaseScanSymptoms: 'लक्षण',
  diseaseScanChemical: 'रासायनिक उपचार',
  diseaseScanOrganic: 'जैविक उपचार',
  diseaseScanDosage: 'मात्रा',
  diseaseScanCost: 'अनुमानित लागत: {price}',
  diseaseScanPendingHuman: 'कम विश्वास — किसी विशेषज्ञ को भेजा गया।',
  diseaseScanHistory: 'जाँच इतिहास',
  diseaseScanHistoryEmpty: 'इस प्लॉट की कोई जाँच अभी नहीं है।',
};

registerLocale('hi', hiAdvisory);
