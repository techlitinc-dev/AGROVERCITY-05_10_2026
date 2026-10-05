import { registerLocale } from '../index';

/**
 * Bank "CreditDesk" module strings (manager console + farmer loan mirror).
 * Key catalog is the contract for all views under views/bank/ and
 * views/farmer/LoanTrackingPage.tsx. Common keys (commonSave, retry…) come
 * from the trade locale. Bank vocabulary: disbursal→वितरण, EMI→किस्त,
 * approval→अनुमोदन.
 */

const enBank: Record<string, string> = {
  // ---- Shared ----
  bankLoadFailed: 'Could not load loan data. Please try again.',
  bankLoading: 'Loading...',
  bankNotAvailable: '—',
  bankActionFailed: 'Action failed. Please try again.',

  // ---- Home board ----
  bankHomeTitle: 'CreditDesk — Bank Home',
  bankHomeSub: 'Your daily loan queue at a glance',
  bankStatPendingReview: 'Pending review',
  bankStatTotalApplications: 'Total applications',
  bankStatApprovalsToday: 'Approvals today',
  bankStatDisbursalsWeek: 'Disbursals this week',
  bankDisbursalUnit: 'disbursals',
  bankStatAtRisk: 'At-risk accounts',
  bankStatCollectionRate: 'Emi collection rate',
  bankSlaSection: 'Queue depth by SLA',
  bankSlaBreach: 'Breached (>48h)',
  bankSlaDueSoon: 'Due soon (24–48h)',
  bankSlaOnTrack: 'On track',
  bankPortfolioSection: 'Portfolio totals',
  bankPortfolioSanctioned: 'Sanctioned',
  bankPortfolioDisbursed: 'Disbursed',
  bankPortfolioOutstanding: 'Outstanding',

  // ---- Queue ----
  bankQueueTitle: 'Loan review queue',
  bankQueueSub: 'Filter by status, amount and district',
  bankQueueEmpty: 'No applications match these filters',
  bankQueueTotal: '{count} application(s)',
  bankPrev: 'Previous',
  bankNext: 'Next',
  bankFilterStatus: 'Status',
  bankFilterAllStatuses: 'All statuses',
  bankFilterDistrict: 'District',
  bankFilterDistrictPlaceholder: 'e.g. Pune',
  bankFilterMinAmount: 'Min amount (₹)',
  bankFilterMaxAmount: 'Max amount (₹)',
  bankColApplication: 'Application',
  bankColFarmer: 'Farmer',
  bankColAmount: 'Amount',
  bankColDistrict: 'District',
  bankColStatus: 'Status',
  bankColAi: 'AI note',
  bankColCreditScore: 'Credit score',
  bankColDaysOverdue: 'Days overdue',
  bankColInstallment: 'Installment',
  bankColDueDate: 'Due date',
  bankColEmi: 'Emi',
  bankColPrincipal: 'Principal',
  bankColInterest: 'Interest',
  bankColOutstanding: 'Outstanding',

  // ---- Statuses ----
  bank_status_submitted: 'Submitted',
  bank_status_underReview: 'Under review',
  bank_status_infoRequested: 'Info requested',
  bank_status_approved: 'Approved',
  bank_status_rejected: 'Rejected',
  bank_status_disbursed: 'Disbursed',
  bank_status_cancelled: 'Cancelled',

  // ---- Stage timeline ----
  bankStage_submitted: 'Submitted',
  bankStage_underReview: 'Under review',
  bankStage_infoRequested: 'Info requested',
  bankStage_approved: 'Approved',
  bankStage_disbursed: 'Disbursed',

  // ---- AI annotation badges (WS-07 M14 seam) ----
  bankAiRiskBand: 'Risk',
  bankAiMissingDocs: 'Missing docs',
  bankRisk_low: 'Low',
  bankRisk_medium: 'Medium',
  bankRisk_high: 'High',

  // ---- Portfolio ----
  bankPortfolioTitle: 'Loan portfolio',
  bankPortfolioSub: 'NPA watch list and Emi collection rate',
  bankNpaSection: 'NPA watch list',
  bankNpaEmpty: 'No at-risk accounts — portfolio healthy',

  // ---- Detail action bar ----
  bankBackToQueue: 'Back to queue',
  bankActionBarTitle: 'Decision',
  bankActionReview: 'Start review',
  bankActionApprove: 'Approve',
  bankActionReject: 'Reject',
  bankActionRequestInfo: 'Request info',
  bankActionDisburse: 'Disburse',
  bankSubmitApprove: 'Confirm approval',
  bankSubmitReject: 'Confirm rejection',
  bankSubmitInfo: 'Send request',
  bankFieldReason: 'Reason / note (required)',
  bankFieldRejectReason: 'Rejection reason',
  bankFieldInfoNote: 'Information needed',
  bankFieldSanctioned: 'Sanctioned amount (₹)',
  bankFieldInterestRate: 'Interest rate (%)',
  bankFieldTenure: 'Tenure (months)',
  bankFieldDisbursementRef: 'Disbursement reference (UTR)',
  bankConfirmDisburse: 'Click again to disburse',
  bankConfirmDisburseHint: 'Disbursement cannot be undone.',

  // ---- Detail sections ----
  bankSectionLoan: 'Application',
  bankSectionEmiSchedule: 'Emi schedule',
  bankSectionProfile: 'Farmer profile',
  bankSectionCredit: 'Credit & land',
  bankSectionKcc: 'Kisan Credit Card',
  bankSectionRepayment: 'Repayment history',
  bankSectionDocuments: 'Documents',
  bankDocumentsEmpty: 'No documents uploaded yet',
  bankRepaymentEmpty: 'No other loans on record',
  bankFieldPurpose: 'Purpose',
  bankFieldCreated: 'Created at',
  bankFieldName: 'Name',
  bankFieldPhone: 'Phone',
  bankFieldVillage: 'Village',
  bankFieldDistrict: 'District',
  bankFieldCreditScore: 'Credit score',
  bankFieldCreditTier: 'Credit tier',
  bankFieldLand: 'Land holding (acres)',
  bankFieldCrops: 'Primary crops',
  bankFieldBank: 'Bank',
  bankFieldCardMasked: 'Card',
  bankFieldKccLimit: 'KCC limit',
  bankFieldKccAvailable: 'Available limit',
  bankKccNone: 'No KCC linked to this farmer',

  // ---- Farmer loan mirror ----
  bankTrackingTitle: 'My loan applications',
  bankTrackingSub: 'Track your application stage and answer document requests',
  bankTrackingEmpty: 'You have no loan applications yet',
  bankDocRequestTitle: 'Documents requested',
  bankDocUploadLabel: 'Upload documents',
  bankDocsUploadedNote: 'Documents uploaded',
  bankShowSchedule: 'Show Emi schedule',
  bankHideSchedule: 'Hide Emi schedule',
};

registerLocale('en', enBank);
