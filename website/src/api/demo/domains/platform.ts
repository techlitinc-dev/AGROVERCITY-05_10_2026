// TODO(D1) demo handlers — implement each endpoint below per endpoints.md / overview/03.
// Register with register(method, pattern, handler) from '../registry'; use helpers from '../util'
// (requireAuth, requireRole, paginate, id, nowIso, demoError) and the store from '../db'.
//   GET    /notifications
//   POST   /notifications/read
//   POST   /sync
//   GET    /search?q=&lang=
//   GET    /addresses
//   POST   /addresses
//   PUT    /addresses/{id}
//   DELETE /addresses/{id}
//   GET    /bank-accounts
//   POST   /bank-accounts
//   POST   /bank-accounts/{id}/verify
//   PUT    /bank-accounts/{id}/primary
//   DELETE /bank-accounts/{id}
//   GET    /chats
//   POST   /chats
//   GET    /chats/{id}/messages?before=
//   POST   /chats/{id}/messages
//   GET    /support/threads
//   GET    /support/threads/{id}/messages
//   POST   /support/threads/{id}/messages
//   POST   /support/threads/{id}/resolve
//   POST   /devices
//   DELETE /devices/{token}
//   GET    /users/me/export
//   GET    /users/me/blocks
//   POST   /users/me/blocks
//   DELETE /users/me/blocks/{uid}
//   POST   /users/{id}/report
//   POST   /ratings
//   GET    /ratings/summary?targetType=&targetId=
//   POST   /speech/stt (multipart)
//   POST   /speech/tts
//   POST   /payments/razorpay/order
//   POST   /payments/razorpay/verify
//   POST   /payments/razorpay/refund
export {};
