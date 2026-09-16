// TODO(D2) demo handlers — implement each endpoint below per endpoints.md / overview/03.
// Register with register(method, pattern, handler) from '../registry'; use helpers from '../util'
// (requireAuth, requireRole, paginate, id, nowIso, demoError) and the store from '../db'.
//   GET    /land/plots
//   POST   /land/plots
//   PUT    /land/plots/{id}
//   DELETE /land/plots/{id} (409 ACTIVE_OBLIGATIONS)
//   GET    /land/leases?status=
//   POST   /land/leases
//   PUT    /land/leases/{id}
//   DELETE /land/leases/{id}
//   GET    /land/leases/{id}/payments?year=
//   POST   /land/leases/{id}/payments (409 PAYMENT_ALREADY_RECORDED)
//   POST   /land/leases/{id}/payments/remind
//   GET    /land/leases/{id}/agreement-pdf
//   POST   /land/leases/{id}/sign
//   GET    /land/listings?lat=&lng=&maxRent=&minAcres=&page=
//   GET    /land/listings/my
//   POST   /land/listings (409 PLOT_NOT_VACANT)
//   PUT    /land/listings/{id}
//   DELETE /land/listings/{id}
//   POST   /land/listings/{id}/lease-requests
//   GET    /land/lease-requests?status=pending
//   GET    /land/lease-requests/my
//   POST   /land/lease-requests/{id}/accept
//   POST   /land/lease-requests/{id}/reject
export {};
