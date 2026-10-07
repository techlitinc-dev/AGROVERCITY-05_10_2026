import { registerLocale } from '../index';

/**
 * Post-harvest farmer face (cold storage, my bookings, receipts vault, AI
 * grading) strings — merged into `en`.
 * Key catalog is the contract for every view under views/postharvest/.
 */

const enPostHarvest: Record<string, string> = {
  // ---- Cold storage directory (live capacity) ----
  coldStorageTitle: 'Cold storage & godowns',
  coldStorageHint: 'Remaining capacity is live from the provider.',
  coldStorageEmpty: 'No cold storage or godown found near you.',
  coldStorageLoadFailed: 'Could not load cold storages.',
  coldStorageCapacityLeft: '{available} MT free',
  coldStorageDistance: '{distance} km away',
  coldStorageTemp: '{range}',
  coldStorageRate: '₹{rate}/quintal/month',
  coldStorageSupportedCrops: 'Crops',
  coldStorageWdra: 'WDRA',
  coldStorageBook: 'Book a slot',
  coldStorageBookSubmit: 'Confirm booking',
  coldStorageBooked: 'Chamber slot booked.',
  coldStorageBookingFailed: 'Could not book the slot.',
  coldStorageQuantity: 'Quantity (quintals)',
  coldStorageFrom: 'From date',
  coldStorageMonths: 'Months',
  coldStorageEstimatedRent: 'Estimated rent: {amount}',

  // ---- My storage bookings ----
  myBookingsTitle: 'My storage bookings',
  myBookingsEmpty: 'No storage bookings yet.',
  myBookingsLoadFailed: 'Could not load your storage bookings.',
  myBookingsStatus: 'Status',
  myBookingsQty: '{qty} quintals',
  myBookingsFrom: 'From {date}',
  myBookingsMonths: '{months} month(s)',

  // ---- Warehouse receipts vault ----
  receiptsVaultTitle: 'Warehouse receipts vault',
  receiptsVaultHint: 'Verifiable e-NWR documents for your stored produce.',
  receiptsVaultEmpty: 'No warehouse receipts yet.',
  receiptsVaultLoadFailed: 'Could not load your warehouse receipts.',
  receiptCollateralLabel: 'Usable as loan collateral',
  receiptDownload: 'Download',
  receiptNumberLabel: 'Receipt no.',
  receiptCropLabel: 'Crop',
  receiptGradeLabel: 'QC grade',
  receiptNetLabel: 'Net (quintals)',
  receiptFacilityLabel: 'Facility',
  receiptIssuedLabel: 'Issued',

  // ---- AI produce grading (M10) ----
  gradingTitle: 'AI produce grading',
  gradingHint: 'Photograph your produce to get a grade and a recommended price band.',
  gradingChoosePhotos: 'Choose 1–3 produce photos',
  gradingCrop: 'Crop',
  gradingQuantity: 'Quantity (quintals)',
  gradingMandiModal: "Today's mandi rate (₹/quintal)",
  gradingAnalyze: 'Grade produce',
  gradingAnalyzeFailed: 'Could not grade the photos.',
  gradingAiEstimateLabel: 'AI estimate',
  gradingDemoLabel: 'demo',
  gradingGrade: 'Grade',
  gradingShelfLife: 'Shelf life: {days} days',
  gradingUniformity: 'Uniformity: {percent}%',
  gradingPriceBand: 'Recommended price: {low} – {high} per quintal',
  gradingVsMandi: '{delta}% vs mandi',
  gradingVsMandiUnavailable: 'No mandi rate to compare',
  gradingConfidence: 'Confidence: {value}%',
  gradingPendingHuman: 'Low confidence — sent to a human grader.',
  gradingListAsLot: 'List as a lot',
};

registerLocale('en', enPostHarvest);
