import { registerLocale } from '../index';

/**
 * Climate & carbon module strings — merged into `hi`. Identical key set to
 * `en.climate.ts`.
 */

const hiClimate: Record<string, string> = {
  climateTitle: 'जलवायु और कार्बन',
  climateHint: 'कृषि-पद्धति आधारित कार्बन क्षमता और जलवायु-सहनशील किस्में।',

  climateCarbonTitle: 'कार्बन क्षमता कैलकुलेटर',
  climateCarbonHint: 'आपके प्लॉट और पद्धतियों से अनुमानित कार्बन क्षमता।',
  climateCo2eLabel: 'कार्बन क्षमता',
  climateIncomeLabel: 'वार्षिक आय संभावना',
  climatePracticesLabel: 'योग्य पद्धतियाँ',
  climatePlantationLabel: 'वृक्षारोपण (शामिल)',
  climateUnitTonnes: 'टन CO₂e/वर्ष',
  climateCarbonLoadFailed: 'कार्बन क्षमता लोड नहीं हो सकी।',
  carbonEstimateNotCredits: 'अनुमान, क्रेडिट नहीं',

  climateVarietiesTitle: 'सहनशील किस्म सूची',
  climateVarietiesHint: 'आपकी फसल के लिए बाढ़-, गर्मी- और सूखा-सहनशील किस्में।',
  climateVarietiesEmpty: 'कोई सहनशील किस्म उपलब्ध नहीं।',
  climateVarietiesLoadFailed: 'किस्म सूची लोड नहीं हो सकी।',
  climateVarietiesCrop: 'फसल',
  climateVarietiesTrait: 'गुण',
  climateVarietiesSource: 'स्रोत',

  climateEnrollTitle: 'कार्बन कार्यक्रम नामांकन',
  climateEnrollHint: 'पार्टनर सत्यापन शुरू होने पर तैयार रहने के लिए प्लॉट नामांकित करें।',
  climateEnrollPlot: 'प्लॉट आईडी',
  climateEnrollPlotPlaceholder: 'जैसे plot-1',
  climateEnrollPractices: 'पद्धतियाँ',
  climateEnrollSubmit: 'प्लॉट नामांकित करें',
  climateEnrollSubmitted: 'नामांकन जमा — पार्टनर सत्यापन की प्रतीक्षा में।',
  climateEnrollEmpty: 'अभी कोई कार्बन नामांकन नहीं।',
  climateEnrollLoadFailed: 'आपके नामांकन लोड नहीं हो सके।',
  climateEnrollStatus: 'स्थिति: {status}',
  carbonMrPartnerPlaceholder: 'पार्टनर MRV से सत्यापन — एकीकरण लंबित',
};

registerLocale('hi', hiClimate);
