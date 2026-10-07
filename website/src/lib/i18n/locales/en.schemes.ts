import { registerLocale } from '../index';

/**
 * Government-schemes ("SchemeFinder") strings — merged into `en`.
 * Key catalog is the contract for every view under views/schemes/.
 */

const enSchemes: Record<string, string> = {
  // ---- Discovery list ----
  schemesTitle: 'Government Schemes',
  schemesIntro: 'Schemes for your farm, matched to your profile first.',
  schemesEligibleOnly: 'Eligible only',
  schemesMatchedFirst: 'Matched to your profile first',
  schemesFitBadge: 'Fit {score}',
  schemesMissingDocs: 'Missing: {docs}',
  schemesNoMissing: 'All documents present',
  schemesEligible: 'Eligible',
  schemesNotEligible: 'Not eligible',
  schemesViewDetail: 'View details',
  schemesEmpty: 'No schemes found',
  schemesEmptyBody: 'Schemes that match your profile appear here.',
  schemesLoadFailed: 'Could not load schemes. Please try again.',
  schemesDeadline: 'Deadline: {date}',
  schemesExplanation: 'Why this matches',
  schemesLoadMore: 'Load more',

  // ---- Detail ----
  schemesDetailEligibility: 'Eligibility checklist',
  schemesCriterionMet: 'Met',
  schemesCriterionUnmet: 'Not met',
  schemesCriteria_maxLandAcres: 'Land up to {max} acres (yours: {actual})',
  schemesCriteria_states: 'Available in: {states}',
  schemesCriteria_requiresKcc: 'Requires a Kisan Credit Card (KCC)',
  schemesRequiredDocs: 'Required documents',
  schemesDocPresent: 'In vault',
  schemesDocMissing: 'Missing',
  schemesUploadToVault: 'Add to document vault',
  schemesApplyInApp: 'Apply in the app (tracked)',
  schemesApplyExternal: 'Apply on the official portal (external)',
  schemesApplySuccess: 'Application submitted',
  schemesAlreadyApplied: 'You have already applied',
  schemesNotEligibleApply: 'You are not eligible to apply',
  schemesNotEligibleHint: 'This scheme does not currently match your profile.',
  schemesVaultHint: 'Upload the missing documents, then apply.',
};

registerLocale('en', enSchemes);
