// TODO(D2) demo handlers — implement each endpoint below per endpoints.md / overview/03.
// Register with register(method, pattern, handler) from '../registry'; use helpers from '../util'
// (requireAuth, requireRole, paginate, id, nowIso, demoError) and the store from '../db'.
//   POST   /seller/rates (409 RATE_ALREADY_POSTED, 422 RATE_OUT_OF_BAND)
//   GET    /seller/rates/my?date=
//   PUT    /seller/rates/{id} (409 RATE_EDIT_WINDOW_PASSED)
//   DELETE /seller/rates/{id}
//   GET    /seller/inventory?crop=
//   POST   /seller/inventory
//   PUT    /seller/inventory/{id} (422 INSUFFICIENT_STOCK)
//   DELETE /seller/inventory/{id}
//   POST   /seller/sales
//   GET    /seller/sales?from=&to=&page=
//   POST   /seller/procurements
//   GET    /seller/procurements?from=&to=&paymentStatus=
//   POST   /seller/procurements/{id}/mark-paid (409 ALREADY_PAID)
//   GET    /seller/ledgers
//   GET    /seller/ledgers/{buyerKey}
//   POST   /seller/ledgers/{buyerKey}/payments (422 PAYMENT_EXCEEDS_BALANCE)
export {};
