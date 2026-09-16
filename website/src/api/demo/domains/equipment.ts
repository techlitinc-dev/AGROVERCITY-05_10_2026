// TODO(D2) demo handlers — implement each endpoint below per endpoints.md / overview/03.
// Register with register(method, pattern, handler) from '../registry'; use helpers from '../util'
// (requireAuth, requireRole, paginate, id, nowIso, demoError) and the store from '../db'.
//   GET    /equipment?type=&lat=&lng=
//   POST   /equipment
//   PUT    /equipment/{id}
//   DELETE /equipment/{id} (409 if future bookings)
//   GET    /equipment/{id}/slots?date=&week=
//   PUT    /equipment/{id}/slot-templates
//   POST   /equipment/slots/{id}/book (409 SLOT_LIMIT_REACHED / SLOT_FULL)
//   DELETE /equipment/bookings/{id} (409 CANCEL_WINDOW_PASSED)
//   POST   /equipment/slots/{id}/waitlist
//   GET    /equipment/bookings?status=pending
//   POST   /equipment/bookings/{id}/approve
//   POST   /equipment/bookings/{id}/reject
//   GET    /equipment/owner/fleet
//   GET    /equipment/{id}/maintenance
//   POST   /equipment/{id}/maintenance
//   PUT    /equipment/{id}/maintenance/{mid}
//   DELETE /equipment/{id}/maintenance/{mid}
export {};
