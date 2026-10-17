import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

const BankManagerDeskView = lazy(() => import('./BankManagerDeskView').then((m) => ({ default: m.BankManagerDeskView })));
const LoanUnderwritingView = lazy(() => import('./LoanUnderwritingView').then((m) => ({ default: m.LoanUnderwritingView })));
const RepaymentLedgerView = lazy(() => import('./RepaymentLedgerView').then((m) => ({ default: m.RepaymentLedgerView })));
const CreditAuditView = lazy(() => import('./CreditAuditView').then((m) => ({ default: m.CreditAuditView })));
const InsuranceClaimsDeskView = lazy(() => import('./InsuranceClaimsDeskView').then((m) => ({ default: m.InsuranceClaimsDeskView })));
const ClaimDetailView = lazy(() => import('./ClaimDetailView').then((m) => ({ default: m.ClaimDetailView })));
const PolicyUnderwritingView = lazy(() => import('./PolicyUnderwritingView').then((m) => ({ default: m.PolicyUnderwritingView })));
const RateCardManager = lazy(() => import('./RateCardManager').then((m) => ({ default: m.RateCardManager })));
const SurveyorRosterView = lazy(() => import('./SurveyorRosterView').then((m) => ({ default: m.SurveyorRosterView })));

// --- Cold storage provider console (§20 provider surface) ---
const ColdStorageProviderConsole = lazy(() =>
  import('./coldstorage/ColdStorageProviderConsole').then((m) => ({ default: m.ColdStorageProviderConsole }))
);
const FacilitiesManager = lazy(() => import('./coldstorage/FacilitiesManager').then((m) => ({ default: m.FacilitiesManager })));
const BookingsQueueView = lazy(() => import('./coldstorage/BookingsQueueView').then((m) => ({ default: m.BookingsQueueView })));
const BookingDetailView = lazy(() => import('./coldstorage/BookingDetailView').then((m) => ({ default: m.BookingDetailView })));
const RentFeesView = lazy(() => import('./coldstorage/RentFeesView').then((m) => ({ default: m.RentFeesView })));
const ReceiptLookupView = lazy(() => import('./coldstorage/ReceiptLookupView').then((m) => ({ default: m.ReceiptLookupView })));

/** 10. Financial Institutions — bank manager + insurance provider desks + cold storage provider console. */
export const FinanceRouteElements = () => (
  <>
    {/* Bank manager */}
    <Route path="/bankManager" element={<BankManagerDeskView />} />
    <Route path="/bank" element={<BankManagerDeskView />} />
    <Route path="/bank/appraisals" element={<BankManagerDeskView />} />
    <Route path="/bank/portfolio" element={<BankManagerDeskView />} />
    <Route path="/bank/applications/:id" element={<LoanUnderwritingView />} />
    <Route path="/bank/repayments" element={<RepaymentLedgerView />} />
    <Route path="/bank/audit" element={<CreditAuditView />} />

    {/* Insurance provider */}
    <Route path="/insuranceProvider" element={<InsuranceClaimsDeskView />} />
    <Route path="/insurance" element={<InsuranceClaimsDeskView />} />
    <Route path="/insurance/dbt" element={<InsuranceClaimsDeskView />} />
    <Route path="/insurance/claims/:id" element={<ClaimDetailView />} />
    <Route path="/insurance/policies" element={<PolicyUnderwritingView />} />
    <Route path="/insurance/rates" element={<RateCardManager />} />
    <Route path="/insurance/surveyors" element={<SurveyorRosterView />} />

    {/* Cold storage provider */}
    <Route path="/coldStorageProvider" element={<ColdStorageProviderConsole />} />
    <Route path="/coldStorageProvider/facilities" element={<FacilitiesManager />} />
    <Route path="/coldStorageProvider/bookings" element={<BookingsQueueView />} />
    <Route path="/coldStorageProvider/bookings/:id" element={<BookingDetailView />} />
    <Route path="/coldStorageProvider/fees" element={<RentFeesView />} />
    <Route path="/coldStorageProvider/receipts/:receiptNumber" element={<ReceiptLookupView />} />
  </>
);
