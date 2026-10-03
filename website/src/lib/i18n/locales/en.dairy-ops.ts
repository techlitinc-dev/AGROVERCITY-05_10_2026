import { registerLocale } from '../index';

/**
 * Dairy ops strings — P4 collections + P5 payment batches (manager console).
 * Registered separately from en.dairy so the phases land independently;
 * registerLocale merges into the same `en` dictionary.
 */

const enDairyOps: Record<string, string> = {
  // ---- Collections ledger (P4) ----
  dairyOpsLedgerDate: 'Collection date',
  dairyOpsLedgerEmpty: 'No collections recorded for this date',
  dairyOpsLedgerEmptyBody: 'Pick another date or record the first collection of the day.',

  // ---- Collection entry (P4) ----
  dairyOpsEntryPickMember: 'Select a member to continue',
  dairyOpsEntryLitersRange: 'Enter liters between 0 and 2000',
  dairyOpsEntryFatRange: 'FAT % must be between 2 and 14',
  dairyOpsEntrySnfRange: 'SNF % must be between 6 and 14',
  dairyOpsEntryDuplicateWarn: 'A slip for this member and shift exists today — save anyway?',
  dairyOpsEntrySaveSlip: 'Save slip',
  dairyOpsEntrySaved: 'Slip saved',
  dairyOpsEntrySuccessTitle: 'Slip recorded',
  dairyOpsEntryNextMember: 'Next member',

  // ---- Payment batches (P5) ----
  dairyOpsPayGenerate: 'Generate batch',
  dairyOpsPayPickPeriod: 'Pick a valid period — from date must be before to date',
  dairyOpsPayGenerated: 'Batch generated',
  dairyOpsPayEmpty: 'No payment batches yet',
  dairyOpsPayEmptyBody:
    'A batch adds up each member’s collections for a period (e.g. 1st–15th), applies their deduction, and can then be marked paid in one go.',

  // ---- Batch detail (P5) ----
  dairyOpsBatchNotFound: 'Batch not found',
  dairyOpsBatchNoEntries: 'No collections in this period',
  dairyOpsBatchNoEntriesBody:
    'This batch has no member entries, so there is nothing to pay. Collections recorded in this period appear in the next batch you generate.',
  dairyOpsBatchEntriesTitle: 'Member payouts',
  dairyOpsBatchEntriesNote: 'Entry rows are shown right after generation; reloaded batches show totals only.',
  dairyOpsBatchMarkPaid: 'Mark paid',
  dairyOpsBatchPayoutRef: 'Payout reference (optional)',
  dairyOpsBatchPayoutRefHint: 'Leave it empty and a UTR reference is generated automatically.',
  dairyOpsBatchConfirmTitle: 'Mark batch paid?',
  dairyOpsBatchConfirmBody:
    'Every member entry in this batch will be marked paid and each member gets a notification. This cannot be undone.',
  dairyOpsBatchPaid: 'Batch marked paid',
  dairyOpsBatchAlreadyPaid: 'This batch was already paid',
  dairyOpsBatchPaidAt: 'Paid at',
};

registerLocale('en', enDairyOps);
