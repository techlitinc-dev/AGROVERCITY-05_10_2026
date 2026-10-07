import { registerLocale } from '../index';

/**
 * Climate & carbon module strings — merged into `en`. Key catalog is the contract
 * for views/climate/.
 *
 * `carbonEstimateNotCredits` is mandatory on every carbon number rendered by the
 * module (task 7.10): the values are estimates, not verified credits.
 */

const enClimate: Record<string, string> = {
  climateTitle: 'Climate & carbon',
  climateHint: 'Practice-based carbon potential and climate-resilient varieties.',

  climateCarbonTitle: 'Carbon-potential calculator',
  climateCarbonHint: 'Estimated carbon potential from your plot and practices.',
  climateCo2eLabel: 'Carbon potential',
  climateIncomeLabel: 'Annual income potential',
  climatePracticesLabel: 'Eligible practices',
  climatePlantationLabel: 'Plantation trees (joined)',
  climateUnitTonnes: 'tCO2e/yr',
  climateCarbonLoadFailed: 'Could not load the carbon potential.',
  carbonEstimateNotCredits: 'estimate, not credits',

  climateVarietiesTitle: 'Resilient variety catalog',
  climateVarietiesHint: 'Flood-, heat- and drought-tolerant varieties for your crop.',
  climateVarietiesEmpty: 'No resilient varieties available.',
  climateVarietiesLoadFailed: 'Could not load the variety catalog.',
  climateVarietiesCrop: 'Crop',
  climateVarietiesTrait: 'Trait',
  climateVarietiesSource: 'Source',

  climateEnrollTitle: 'Carbon-program enrollment',
  climateEnrollHint: 'Enroll a plot to be ready when partner verification goes live.',
  climateEnrollPlot: 'Plot id',
  climateEnrollPlotPlaceholder: 'e.g. plot-1',
  climateEnrollPractices: 'Practices',
  climateEnrollSubmit: 'Enroll plot',
  climateEnrollSubmitted: 'Enrollment submitted — awaiting partner verification.',
  climateEnrollEmpty: 'No carbon-program enrollments yet.',
  climateEnrollLoadFailed: 'Could not load your enrollments.',
  climateEnrollStatus: 'Status: {status}',
  carbonMrPartnerPlaceholder: 'Verification via partner MRV — integration pending',
};

registerLocale('en', enClimate);
