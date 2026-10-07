import { registerLocale } from '../index';

/**
 * Water module (irrigation schedule, CGWB gauge, canal rotation, PMKSY) strings
 * — merged into `en`. Key catalog is the contract for views/water/.
 */

const enWater: Record<string, string> = {
  waterTitle: 'Water & irrigation',
  waterHint: 'Plot-wise irrigation, groundwater and canal water for your farm.',

  waterScheduleTitle: 'Irrigation schedule',
  waterScheduleHint: 'Recommended irrigation per plot, adjusted for the rain forecast.',
  waterScheduleEmpty: 'No active crops to schedule irrigation for.',
  waterScheduleLoadFailed: 'Could not load the irrigation schedule.',
  waterSchedulePlot: 'Plot',
  waterScheduleMoisture: '{percent}% soil moisture',
  waterScheduleMinutes: '{minutes} min recommended',
  waterScheduleMethod: 'Method: {method}',
  waterScheduleSkipToday: 'Rain forecast today — skip irrigation',
  waterScheduleRainBadge: '🌧️ Rain',

  waterGroundwaterTitle: 'Groundwater gauge (CGWB)',
  waterGroundwaterHint: 'Check the district groundwater level before you invest in a borewell.',
  waterGroundwaterDistrict: 'District',
  waterGroundwaterSearch: 'Check level',
  waterGroundwaterDepth: '{depth} m below ground',
  waterGroundwaterZone: 'Category: {zone}',
  waterGroundwaterMeasuredAt: 'Measured {date}',
  waterGroundwaterNoData: 'Enter a district to see its groundwater level.',
  waterGroundwaterLoadFailed: 'Could not load the groundwater level.',

  waterCanalTitle: 'Canal rotation calendar',
  waterCanalHint: 'Your next canal water turns.',
  waterCanalEmpty: 'No canal rotation data.',
  waterCanalLoadFailed: 'Could not load the canal rotation.',
  waterCanalName: 'Canal',
  waterCanalNext: 'Next turn {date}',
  waterCanalSlot: 'Slot {slot}',

  waterPmksyTitle: 'PMKSY subsidy calculator',
  waterPmksyHint: 'Estimate the 55% micro-irrigation subsidy on your input cost.',
  waterPmksyCost: 'Estimated input cost (₹)',
  waterPmksyCalculate: 'Calculate',
  waterPmksyTotal: 'Total cost',
  waterPmksySubsidy: 'PMKSY subsidy ({percent}%)',
  waterPmksyFarmerShare: 'Your share',
  waterPmksyApplyScheme: 'Open the PMKSY scheme',
  waterPmksyInvalid: 'Enter a valid cost.',
  waterPmksyLoadFailed: 'Could not calculate the subsidy.',
};

registerLocale('en', enWater);
