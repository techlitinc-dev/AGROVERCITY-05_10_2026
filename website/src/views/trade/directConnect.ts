/** Direct-connect terms + shared presentation constants for the
 * Farmer ⇄ Industrial Buyer sourcing workflow (spec §10). One wording source
 * used by both personas' screens. */

export const DIRECT_CONNECT_TERMS =
  'Agrovercity only connects farmers and industrial buyers. Sampling, quality inspection, final quantity and price, transport, packaging, delivery, payment, invoices, supply agreements, produce acceptance, and disputes are handled directly between the parties. Agrovercity does not hold payments and does not guarantee quality, payment, delivery, contract performance, or produce acceptance. After confirmation, my contact details will be shared with the other party and their contact details will be shared with me.';

/** Lightweight optional post-unlock negotiation guidance (spec §14). */
export const NEGOTIATION_CHECKLIST = [
  'Exchange samples',
  'Confirm quality and acceptance/rejection conditions',
  'Confirm final quantity and price',
  'Allocate transport responsibility and cost',
  'Confirm packaging and delivery schedule',
  'Agree on payment and invoice requirements',
  'Document recurring-supply expectations where applicable',
];

export const ISSUE_CATEGORIES = [
  'Suspected false requirement',
  'Misrepresented quantity/quality',
  'Business/document concern',
  'Payment/contract dispute reported by user',
  'Farmer/buyer conduct',
  'Other',
];

export const SUPPLY_BASIS_LABEL: Record<string, string> = {
  farmGate: 'Farm gate',
  buyerCollection: 'Buyer collects',
  deliveryToBuyer: 'I deliver to buyer',
};

export const FREQUENCY_LABEL: Record<string, string> = {
  oneTime: 'One-time',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
};

export const REQUIREMENT_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  paused: 'Paused',
  applicationsReceived: 'Applications received',
  closed: 'Closed',
  fulfilled: 'Fulfilled',
};

export const LEAD_STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  contacted: 'In contact',
  dealDone: 'Deal completed',
  dismissed: 'Did not happen',
  withdrawn: 'Withdrawn',
  rejected: 'Rejected',
  new: 'Submitted', // legacy
  sold: 'Deal completed', // legacy
};
