import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

// --- Cold storage provider console (§20 provider surface) ---
const ColdStorageProviderConsole = lazy(() =>
  import('./coldstorage/ColdStorageProviderConsole').then((m) => ({ default: m.ColdStorageProviderConsole }))
);
const FacilitiesManager = lazy(() => import('./coldstorage/FacilitiesManager').then((m) => ({ default: m.FacilitiesManager })));
const BookingsQueueView = lazy(() => import('./coldstorage/BookingsQueueView').then((m) => ({ default: m.BookingsQueueView })));
const BookingDetailView = lazy(() => import('./coldstorage/BookingDetailView').then((m) => ({ default: m.BookingDetailView })));
const RentFeesView = lazy(() => import('./coldstorage/RentFeesView').then((m) => ({ default: m.RentFeesView })));
const ReceiptLookupView = lazy(() => import('./coldstorage/ReceiptLookupView').then((m) => ({ default: m.ReceiptLookupView })));

/** 10. Post-harvest warehousing — cold storage provider console.
 * v2: bank manager desk (/bank*) and insurance provider desk (/insurance*) return here. */
export const FinanceRouteElements = () => (
  <>
    {/* Cold storage provider */}
    <Route path="/coldStorageProvider" element={<ColdStorageProviderConsole />} />
    <Route path="/coldStorageProvider/facilities" element={<FacilitiesManager />} />
    <Route path="/coldStorageProvider/bookings" element={<BookingsQueueView />} />
    <Route path="/coldStorageProvider/bookings/:id" element={<BookingDetailView />} />
    <Route path="/coldStorageProvider/fees" element={<RentFeesView />} />
    <Route path="/coldStorageProvider/receipts/:receiptNumber" element={<ReceiptLookupView />} />
  </>
);
