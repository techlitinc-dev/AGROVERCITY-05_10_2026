import { registerLocale } from '../index';

/**
 * Water module (irrigation schedule, CGWB gauge, canal rotation, PMKSY) strings
 * — merged into `hi`. Identical key set to `en.water.ts`.
 */

const hiWater: Record<string, string> = {
  waterTitle: 'पानी और सिंचाई',
  waterHint: 'आपके खेत के लिए सिंचाई, भूजल और नहर का पानी।',

  waterScheduleTitle: 'सिंचाई कार्यक्रम',
  waterScheduleHint: 'बारिश के पूर्वानुमान के अनुसार हर प्लॉट की सिंचाई।',
  waterScheduleEmpty: 'सिंचाई कार्यक्रम के लिए कोई सक्रिय फसल नहीं है।',
  waterScheduleLoadFailed: 'सिंचाई कार्यक्रम लोड नहीं हो सका।',
  waterSchedulePlot: 'प्लॉट',
  waterScheduleMoisture: '{percent}% मिट्टी की नमी',
  waterScheduleMinutes: '{minutes} मिनट सुझावित',
  waterScheduleMethod: 'तरीका: {method}',
  waterScheduleSkipToday: 'आज बारिश का अनुमान — सिंचाई टालें',
  waterScheduleRainBadge: '🌧️ बारिश',

  waterGroundwaterTitle: 'भूजल स्तर (CGWB)',
  waterGroundwaterHint: 'बोरवेल में निवेश से पहले जिले का भूजल स्तर देखें।',
  waterGroundwaterDistrict: 'जिला',
  waterGroundwaterSearch: 'स्तर देखें',
  waterGroundwaterDepth: 'ज़मीन से {depth} मीटर नीचे',
  waterGroundwaterZone: 'श्रेणी: {zone}',
  waterGroundwaterMeasuredAt: 'मापा गया {date}',
  waterGroundwaterNoData: 'भूजल स्तर देखने के लिए जिला दर्ज करें।',
  waterGroundwaterLoadFailed: 'भूजल स्तर लोड नहीं हो सका।',

  waterCanalTitle: 'नहर पाली कैलेंडर',
  waterCanalHint: 'आपकी अगली नहर पानी की बारी।',
  waterCanalEmpty: 'नहर पाली का कोई डेटा नहीं।',
  waterCanalLoadFailed: 'नहर पाली लोड नहीं हो सकी।',
  waterCanalName: 'नहर',
  waterCanalNext: 'अगली बारी {date}',
  waterCanalSlot: 'समय {slot}',

  waterPmksyTitle: 'PMKSY अनुदान कैलकुलेटर',
  waterPmksyHint: 'अपनी लागत पर 55% सूक्ष्म-सिंचाई अनुदान का अनुमान लगाएं।',
  waterPmksyCost: 'अनुमानित लागत (₹)',
  waterPmksyCalculate: 'गणना करें',
  waterPmksyTotal: 'कुल लागत',
  waterPmksySubsidy: 'PMKSY अनुदान ({percent}%)',
  waterPmksyFarmerShare: 'आपका हिस्सा',
  waterPmksyApplyScheme: 'PMKSY योजना खोलें',
  waterPmksyInvalid: 'मान्य लागत दर्ज करें।',
  waterPmksyLoadFailed: 'अनुदान की गणना नहीं हो सकी।',
};

registerLocale('hi', hiWater);
