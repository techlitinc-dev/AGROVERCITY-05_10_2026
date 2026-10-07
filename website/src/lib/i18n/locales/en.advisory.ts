import { registerLocale } from '../index';

/**
 * Advisory hub strings (market saturation, disease scan, NPK, pest radar,
 * Kisan Mitra launcher) — merged into `en`.
 * Key catalog is the contract for every view under views/advisory/.
 */

const enAdvisory: Record<string, string> = {
  // ---- Hub shell ----
  // Tool-tile labels for the advisoryHub tool id (merged into `en`; keeps the
  // label keys inside this module's own locale pair).
  tool_advisoryHub: 'Advisory Hub',
  tool_advisoryHub_sub: 'Saturation · scan · nutrients',
  advisoryTitle: 'Crop Advisory Hub',
  advisoryHubIntro: 'Field intelligence for your plot — saturation, disease scan, nutrients and pest alerts.',
  advisoryTabSaturation: 'Market Saturation',
  advisoryTabDisease: 'Disease Scan',
  advisoryTabNpk: 'NPK Calculator',
  advisoryTabPestRadar: 'Pest Radar',
  advisoryTabKisanMitra: 'Kisan Mitra',

  // ---- (a) Market Saturation (M13) ----
  advisorySaturationTitle: 'Market saturation',
  advisorySaturationConsent:
    'I consent to my crop and planned sowing being shared anonymously and in aggregate, and to seeing saturation computed from other farmers\u2019 shared sowing intents in my district.',
  advisorySaturationCrop: 'Crop',
  advisorySaturationDistrict: 'District',
  advisorySaturationRadius: 'Radius (km)',
  advisorySaturationRun: 'Check saturation',
  advisorySaturationCount: 'Based on {count} shared sowing intents',
  advisorySaturationExpectedIncrease: 'Expected arrivals: {value}',
  advisorySaturationPredictedPrice: 'Mandi-linked indicative price: {price} per quintal',
  advisorySaturationPriceUnavailable: 'No mandi price data for this crop yet',
  advisorySaturationPredictedDate: 'Expected by {date}',
  advisorySaturationAlternatives: 'Alternative crops',
  advisorySaturationAlternativesEmpty: 'No alternative crop has mandi price data yet.',
  advisorySaturationRiskGreen: 'Low saturation — further sowing is safe',
  advisorySaturationRiskYellow: 'Moderate saturation — watch arrivals',
  advisorySaturationRiskRed: 'High saturation — consider an alternative',
  advisoryLocationRequired:
    'Add your farm location (or allow the browser location) to check saturation.',

  // ---- Shared: data-basis citation (M13) ----
  advisoryDataBasis: 'based on {count} sowing intents in {district}',
  advisoryDataBasisUnavailable: 'no shared sowing intents for this district yet',

  // ---- (c) NPK calculator ----
  advisoryNpkTitle: 'NPK calculator',
  advisoryNpkCrop: 'Crop',
  advisoryNpkSoil: 'Soil type',
  advisoryNpkN: 'Soil N (kg/ha)',
  advisoryNpkP: 'Soil P (kg/ha)',
  advisoryNpkK: 'Soil K (kg/ha)',
  advisoryNpkRun: 'Get recommendation',
  advisoryNpkResults: 'Fertiliser to apply (per acre)',
  advisoryNpkUrea: 'Urea',
  advisoryNpkDap: 'DAP',
  advisoryNpkMop: 'MOP',

  // ---- (d) Pest radar ----
  advisoryPestTitle: 'Pest radar (5 km)',
  advisoryPestRadius: 'Radius (km)',
  advisoryPestRefresh: 'Refresh',
  advisoryPestEmpty: 'No pest reports within {radius} km.',
  advisoryPestDistance: '{distance} km away',
  advisoryPestReported: 'Reported {date}',

  // ---- (e) Kisan Mitra ----
  advisoryKisanMitraTitle: 'Ask Kisan Mitra',
  advisoryKisanMitraBody:
    'Chat with the Kisan Mitra assistant for agronomy, market and scheme questions.',
  advisoryKisanMitraLaunch: 'Open Kisan Mitra',

  // ---- Crop planner (M13) ----
  advisoryCropPlannerOpen: 'Open crop planner',
  cropPlannerTitle: 'AI crop planner',
  cropPlannerSoil: 'Soil type',
  cropPlannerIrrigation: 'Irrigation',
  cropPlannerSize: 'Plot size (acres)',
  cropPlannerHistory: 'Recent crops (comma separated)',
  cropPlannerDistrict: 'District',
  cropPlannerRun: 'Suggest crops',
  cropPlannerOptions: 'Suggested crops',
  cropPlannerRationale: 'Why',
  cropPlannerEstRevenue: 'Indicative revenue: {price}',
  cropPlannerConfirm: 'Confirm and create plan',
  cropPlannerConfirmed: 'Plan confirmed — the crop cycle and tasks were created.',
  cropPlannerCached: 'Cached suggestion',

  // ---- Disease scan (M9) ----
  diseaseScanTitle: 'Disease scan',
  diseaseScanChoose: 'Choose a leaf photo',
  diseaseScanHint: 'Take a sharp, well-lit photo with a single leaf filling the frame.',
  diseaseScanPlotId: 'Plot (optional)',
  diseaseScanAnalyze: 'Scan leaf',
  diseaseScanRetakeNotLeaf:
    'This does not look like a plant leaf — please photograph a single leaf filling the frame.',
  diseaseScanRetakeBlurry:
    'The photo is too blurry or poorly lit — retake it in daylight with the leaf in focus.',
  diseaseScanDemoLabel: 'demo',
  diseaseScanDiagnosis: 'Diagnosis',
  diseaseScanConfidence: 'Confidence: {value}',
  diseaseScanSymptoms: 'Symptoms',
  diseaseScanChemical: 'Chemical treatment',
  diseaseScanOrganic: 'Organic treatment',
  diseaseScanDosage: 'Dosage',
  diseaseScanCost: 'Estimated cost: {price}',
  diseaseScanPendingHuman: 'Low confidence — sent to a human expert.',
  diseaseScanHistory: 'Scan history',
  diseaseScanHistoryEmpty: 'No scans for this plot yet.',
};

registerLocale('en', enAdvisory);
