import { registerLocale } from '../index';

/**
 * Tree plantation, NGO sapling requests and biofuel strings — merged into `en`.
 * Key catalog is the contract for views/trees/.
 *
 * Carbon numbers (a plantation's estimated CO₂e) also render the climate module's
 * `carbonEstimateNotCredits` label — they are estimates, not credits.
 */

const enTree: Record<string, string> = {
  treeTitle: 'Tree plantation',
  treeHint: 'Track plantations, request free saplings and read biofuel economics.',

  treePlantationTitle: 'Plantation tracker',
  treePlantationHint: 'Your plantations with species, count and survival.',
  treePlantationEmpty: 'No plantations registered yet.',
  treePlantationLoadFailed: 'Could not load your plantations.',
  treePlantationSpecies: 'Species',
  treePlantationCount: '{count} trees',
  treePlantationCountLabel: 'Number of trees',
  treePlantationPlantedDate: 'Planted {date}',
  treePlantationPlantedDateLabel: 'Planting date',
  treePlantationParcel: 'Parcel',
  treePlantationLatitude: 'Latitude',
  treePlantationLongitude: 'Longitude',
  treePlantationSurvival: '{percent}% survival',
  treePlantationCarbon: '{kg} kg CO₂e/yr',
  treePlantationRegister: 'Register plantation',
  treePlantationRegisterTitle: 'Add a plantation',
  treePlantationRegistered: 'Plantation registered — survival checks added to your tasks.',
  treePlantationInvalid: 'Fill in species, count and date.',

  treeNgoTitle: 'NGO directory',
  treeNgoHint: 'NGOs that provide free saplings near you.',
  treeNgoEmpty: 'No NGOs found.',
  treeNgoLoadFailed: 'Could not load the NGO directory.',
  treeNgoFree: 'Free saplings',
  treeNgoTreesPlanted: '{count} trees planted',
  treeNgoRating: 'Rating {rating}',

  treeNgoRequest: 'Request saplings',
  treeNgoRequestSpecies: 'Species type',
  treeNgoRequestCount: 'Count',
  treeSaplingTimber: 'Timber',
  treeSaplingBiofuel: 'Biofuel',
  treeSaplingFruit: 'Fruit',
  treeSaplingBamboo: 'Bamboo',
  treeNgoRequestSubmit: 'Send request',
  treeNgoRequested: 'Sapling request sent — status pending approval.',
  treeNgoRequestInvalid: 'Enter a count between 1 and 500.',

  treeNgoRequestsTitle: 'My sapling requests',
  treeNgoRequestsEmpty: 'No sapling requests yet.',
  treeNgoRequestsLoadFailed: 'Could not load your sapling requests.',
  treeNgoStatus: 'Status: {status}',

  treeBiofuelTitle: 'Biofuel economics',
  treeBiofuelHint: 'Biofuel tree species, returns and buyer markets.',
  treeBiofuelEmpty: 'No biofuel data available.',
  treeBiofuelLoadFailed: 'Could not load biofuel data.',
  treeBiofuelReturn: 'Expected return: {value}',
  treeBiofuelGestation: 'Gestation: {value}',
  treeBiofuelOil: 'Oil content: {value}',
  treeBiofuelUses: 'Uses: {value}',
  treeBiofuelMarket: 'Buyer market: {value}',
  treeBiofuelSubsidy: 'Subsidy: {value}',
  treeBiofuelSuitability: 'Suitability: {value}',

  treeCareTitle: 'Care guides',
  treeCareHint: 'Step-by-step care for young trees.',
  treeCareEmpty: 'No care guides available.',
  treeCareLoadFailed: 'Could not load the care guides.',
  treeCareStep: 'Step {step}',
  treeCareStage: 'Stage: {value}',
  treeCareWatering: 'Watering: {value}',
  treeCareFertilizer: 'Fertilizer: {value}',
  treeCarePest: 'Pest protection: {value}',
};

registerLocale('en', enTree);
