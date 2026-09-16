# Day 6 — Marketplace + payments

**Dev A (Backend) goal:** Products (with certificate), cart CRUD, orders, and Razorpay order-create/verify endpoints work with signature verification — plus order cancellation with Razorpay refunds and a saved-address book.
**Dev B (Flutter) goal:** Marketplace screen, product detail with QR certificate dialog, cart bar, Razorpay checkout, and a new order-tracking screen are wired — plus cancel/refund UI and an address picker in checkout.

## Dev A — Backend tasks

### Task A1 — Products + certificate + cart

- **Goal:** Marketplace catalog and cart against Firestore.
- **Depends on:** Day 3 (auth/roles). Roles for all endpoints: farmer, farmLandlord, transport, seller.
- **Files to create/modify:**
  - `backend/app/models/marketplace.py` (new)
  - `backend/app/routers/marketplace.py` (new)
  - `backend/scripts/seed_products.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_marketplace.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/marketplace.py`:
     - `class ProductOut(BaseModel)`: `id`, `title: str`, `vernacularTitle: str`, `category: str`, `brand: str`, `rating: float`, `reviewsCount: int`, `dealerName: str`, `distanceKm: float`, `mrp: float`, `discountedPrice: float`, `bnplAvailable: bool`, `batchNo: str`
     - `class CertificateOut(BaseModel)`: `batchNo: str`, `certifier: str`, `certificateNo: str`, `valid: bool`, `verifiedAt: str`
     - `class CartItemRequest(BaseModel)`: `productId: str`, `quantity: int` (quantity ≥ 1, else 422)
  2. Write `backend/scripts/seed_products.py`: seed collection `products` with the 3+ `InputProduct` records from `flutter-prototype/lib/data/demo_data.dart` (lines ~199–260) — one per category minimum: seeds (e.g. tomato seeds), fertilizer (e.g. urea/NPK), pesticide. Ensure each has a `batchNo`. Also seed collection `certificates` keyed by `batchNo`: `{ batchNo, certifier: "AGMARK / Ministry of Agriculture", certificateNo: "AGM-2026-XXXX", valid: true, verifiedAt: iso }`. Print `seeded N products, N certificates`.
  3. Write `backend/app/routers/marketplace.py` (`router = APIRouter(tags=["marketplace"])`):
     - `GET /products?category=&query=&lat=&lng=&page=&pageSize=`: filter by exact `category` (`seeds|vehicles|fertilizer|pesticide|tools`) and substring `query` on `title`/`vernacularTitle`; pagination envelope.
     - `GET /products/{id}` → product or 404 `PRODUCT_NOT_FOUND`.
     - `GET /products/{id}/certificate` → look up `certificates` by the product's `batchNo`; 404 `CERTIFICATE_NOT_FOUND` if absent.
     - `GET /cart`: read `carts/{uid}` doc → `{ "data": [{ "productId", "quantity", "product": {...} }], "cartTotal": <sum of discountedPrice*quantity> }`; empty cart → `{ "data": [], "cartTotal": 0 }`.
     - `POST /cart/items`: body `CartItemRequest`; upsert into `carts/{uid}.items` (map keyed by productId); validate product exists (404 `PRODUCT_NOT_FOUND`); return updated cart.
     - `PUT /cart/items/{productId}`: set quantity; quantity ≤ 0 removes the item.
     - `DELETE /cart/items/{productId}`: remove; return updated cart.
  4. Include in `app/main.py` under `/v1`.
  5. Write `backend/tests/test_marketplace.py` (in-memory Firestore patch):
     - `test_products_list_and_category_filter`: seeds category filter returns only seeds.
     - `test_products_query_search`: `?query=urea` matches title.
     - `test_product_404`.
     - `test_certificate_by_batch`: returns `valid: true` and `certifier`.
     - `test_cart_add_update_delete`: add qty 2 → cartTotal == 2×price; PUT qty 1 → total halves; DELETE → empty cart.
     - `test_cart_add_unknown_product_404`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_marketplace.py -v && .venv/bin/python scripts/seed_products.py`
- **Expected output:** `6 passed`; seed prints counts; `curl -s -H "Authorization: Bearer <token>" "http://localhost:8000/v1/products?category=seeds"` returns the envelope.

### Task A2 — Orders + Razorpay create/verify

- **Goal:** Place orders from the cart, and create/verify Razorpay payments with HMAC signature checks.
- **Depends on:** Day 6 Task A1
- **Files to create/modify:**
  - `backend/app/models/marketplace.py` (modify)
  - `backend/app/routers/orders.py` (new)
  - `backend/app/services/payments.py` (new)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_orders.py` (new)
- **Subtasks:**
  1. Add models:
     - `class PlaceOrderRequest(BaseModel)`: `items: list[CartItemRequest]`, `paymentMethod: str` (`upi|cod|bnpl`), `deliveryAddress: str`, `idempotencyKey: str`
     - `class RazorpayOrderRequest(BaseModel)`: `orderId: str` (internal order id)
     - `class RazorpayVerifyRequest(BaseModel)`: `orderId: str`, `razorpayOrderId: str`, `razorpayPaymentId: str`, `razorpaySignature: str`
  2. Write `backend/app/services/payments.py`:
     - `def create_razorpay_order(amount_paise: int, receipt: str) -> dict`: if `settings.razorpay_key_id` is empty → return a fake `{ "id": f"order_dev_{receipt}", "amount": amount_paise, "currency": "INR", "status": "created" }` (dev mode). Else POST `https://api.razorpay.com/v1/orders` with basic auth `(key_id, key_secret)` and JSON `{amount, currency: "INR", receipt}` via httpx.
     - `def verify_razorpay_signature(razorpay_order_id: str, razorpay_payment_id: str, signature: str) -> bool`: `hmac.new(settings.razorpay_key_secret.encode(), f"{razorpay_order_id}|{razorpay_payment_id}".encode(), hashlib.sha256).hexdigest() == signature`. Dev mode (empty secret): accept signature `"dev"`.
  3. Write `backend/app/routers/orders.py` (`router = APIRouter(tags=["orders"])`):
     - `POST /orders`: idempotency — store `idempotency_keys/{key}` → orderId; if key seen, return the original response (200, same body). Validate items exist & quantities ≥ 1; compute `total` from current `discountedPrice`; if `paymentMethod == "bnpl"` include `bnplSchedule: [{installment: 1, dueInDays: 30, amount: total/2}, {installment: 2, dueInDays: 60, amount: total/2}]`. Create `orders/{orderId}` doc: `{ id, userId, items, paymentMethod, deliveryAddress, total, status: "placed", createdAt }`. Clear the user's cart. Return `{ orderId, total, bnplSchedule? }`.
     - `GET /orders`: user's orders, newest first, pagination envelope.
     - `GET /orders/{id}`: 404 `ORDER_NOT_FOUND`; 403 if not the owner.
     - `POST /payments/razorpay/order`: load order, `create_razorpay_order(int(total*100), orderId)`, store `razorpayOrderId` on the order, return `{ razorpayOrderId, amount, currency: "INR", keyId: settings.razorpay_key_id or "rzp_test_dev" }`.
     - `POST /payments/razorpay/verify`: verify signature → on success set order `status: "paid"`, store `razorpayPaymentId`; return `{ ok: true, status: "paid" }`. On failure → 400 `PAYMENT_SIGNATURE_INVALID`.
  4. Write `backend/tests/test_orders.py`:
     - `test_place_order_and_clears_cart`: seed cart, place with `paymentMethod: "cod"` → `orderId` returned, cart empty, order status `placed`.
     - `test_order_idempotent`: same `idempotencyKey` twice → same `orderId`, only one order created.
     - `test_bnpl_schedule`: `paymentMethod: "bnpl"` → 2 installments summing to total.
     - `test_orders_list_and_detail`: GET list contains it; GET detail; other user's token on detail → 403.
     - `test_razorpay_order_and_verify_dev_mode`: create razorpay order → `razorpayOrderId` starts with `order_dev_`; verify with signature `"dev"` → `status: "paid"`.
     - `test_razorpay_verify_bad_signature`: signature `"wrong"` → 400 `PAYMENT_SIGNATURE_INVALID`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_orders.py -v`
- **Expected output:** `6 passed`.

## Dev B — Flutter tasks

### Task B1 — Marketplace + product detail + QR certificate + cart

- **Goal:** Port `marketplace_view.dart` onto the live catalog.
- **Depends on:** Day 3 Task B1 (api client). API dependency: Day 6 Task A1.
- **Files to create/modify:**
  - `apps/mobile/lib/api/marketplace_api.dart` (new)
  - `apps/mobile/lib/views/marketplace_view.dart` (modify — port from `flutter-prototype/lib/views/marketplace_view.dart`)
  - `apps/mobile/lib/state/app_state.dart` (modify — cart state delegates to API)
  - `apps/mobile/test/marketplace_test.dart` (new)
- **Subtasks:**
  1. `apps/mobile/lib/api/marketplace_api.dart`: `getProducts({category, query, page})`, `getProduct(id)`, `getCertificate(id)`, `getCart()`, `addToCart(productId, quantity)`, `updateCartItem(productId, quantity)`, `removeCartItem(productId)`.
  2. `marketplace_view.dart`: keep prototype layout — search bar with mic, 5 category chips (Seeds/Vehicles/Fertilizer/Pesticide/Tools), product cards (vernacular title, brand, dealer, distance, batch no., rating + reviews, MRP struck through + discounted price, delivery time, BNPL badge).
  3. Wire: chips + search call `getProducts`; cards render from response.
  4. Product detail sheet + **QR authenticity certificate dialog**: open from card tap → `getCertificate(id)` → show batchNo, certifier `AGMARK / Ministry of Agriculture`, certificateNo, green "Verified" check when `valid`, and an "Add to cart" button (prototype dialog styling kept).
  5. Cart bar (bottom): item count + total from `getCart().cartTotal`, "0% BNPL" label, Confirm button → checkout (Task B2). Keep cart state in `AppState` but every mutation calls the API then re-reads the cart.
  6. `apps/mobile/test/marketplace_test.dart`:
     - `testWidgets('category chips filter products', ...)` — fake api; tap Fertilizer; assert recorded category.
     - `testWidgets('certificate dialog shows verified badge', ...)` — pump product card, tap, expect `AGMARK` text and add-to-cart button.
     - `testWidgets('cart bar shows total', ...)` — fake cart total ₹1,230 → expect `₹1,230` in cart bar.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/marketplace_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: catalog loads from dev backend, certificate dialog opens.

### Task B2 — Checkout with Razorpay + order-tracking screen

- **Goal:** Payment sheet runs Razorpay; new screen shows order status.
- **Depends on:** Day 6 Task B1. API dependency: Day 6 Task A2.
- **Files to create/modify:**
  - `apps/mobile/lib/api/orders_api.dart` (new)
  - `apps/mobile/lib/views/checkout_sheet.dart` (new)
  - `apps/mobile/lib/views/order_tracking_view.dart` (new screen — no prototype equivalent)
  - `apps/mobile/lib/state/app_state.dart` (modify — add route `orderTracking`)
  - `apps/mobile/test/order_flow_test.dart` (new)
- **Subtasks:**
  1. `apps/mobile/lib/api/orders_api.dart`: `placeOrder(items, paymentMethod, deliveryAddress, idempotencyKey)`, `getOrders()`, `getOrder(id)`, `createRazorpayOrder(orderId)`, `verifyRazorpayPayment(orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature)`.
  2. `apps/mobile/lib/views/checkout_sheet.dart`: address field (prefill village + district from profile), payment method radio (UPI / COD / BNPL with the BNPL schedule preview from the order response), Pay button.
     - COD/BNPL: `placeOrder` → success → navigate `orderTracking` with the new order id.
     - UPI: `placeOrder` → `createRazorpayOrder` → open `Razorpay` (`razorpay_flutter`) with `key: keyId`, `order_id`, `amount`; on `PaymentSuccessResponse` → `verifyRazorpayPayment` → on `status: paid` navigate to `orderTracking`; on failure show snackbar `भुगतान विफल — पुनः प्रयास करें`.
     - Generate `idempotencyKey` once per checkout session (uuid v4) so a double-tap or retry can't create two orders.
  3. `apps/mobile/lib/views/order_tracking_view.dart` (new, theme-consistent): header "ऑर्डर ट्रैकिंग / Order Tracking"; list of orders from `getOrders()` — each card: orderId, item count, total, status chip (`placed` amber, `paid` green); tap → detail section listing items + delivery address + status timeline (Placed → Paid → Shipped → Delivered, only real statuses highlighted).
  4. Add route `orderTracking` to `AppState`'s router map; make it reachable from all profiles that can access `marketplace` (add to the ACL map in `lib/state/profile_routes.dart` for farmer, farmLandlord, transport, seller).
  5. `apps/mobile/test/order_flow_test.dart`:
     - `testWidgets('order tracking lists orders with status chips', ...)` — fake `OrdersApi` returns 2 orders (placed, paid); expect both ids and chip colors/text.
     - `testWidgets('idempotency key stable per checkout', ...)` — open checkout sheet, capture the key used by the fake api on two Pay taps; assert identical.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/order_flow_test.dart` + manual with dev backend: add 2 items → checkout COD → order appears in tracking as `placed`; UPI path in dev mode completes with signature `dev` and flips to `paid`.
- **Expected output:** `No issues found!`; 2 tests pass; both manual payment paths reach the tracking screen.

## Additional tasks (from missing.md)

### Task A3 — Order cancel + Razorpay refund

- **Goal:** Buyers can cancel pre-dispatch orders, and paid orders get their money back via Razorpay. Spec: `docs/overview/03 … Part C/D item X5`.
- **Depends on:** Day 6 Task A2
- **Files to create/modify:**
  - `backend/app/routers/orders.py` (modify)
  - `backend/app/services/payments.py` (modify)
  - `backend/tests/test_order_cancel.py` (new)
- **Subtasks:**
  1. Order docs gain `refundStatus: str` — `none|requested|processed`, default `none` (treat missing as `none` when reading old docs). Order lifecycle note: `placed|paid` are the pre-dispatch states; `shipped|delivered` are post-dispatch.
  2. `POST /orders/{id}/cancel` (owner; absent/not owned → 404 `ORDER_NOT_FOUND`):
     - Allowed only while `status` is `placed` or `paid`; `shipped|delivered|cancelled` → 409 `ORDER_NOT_CANCELLABLE`.
     - Set `status: "cancelled"`, `cancelledAt: <utc iso>`. If the order was `paid` (has `razorpayPaymentId`) → set `refundStatus: "requested"`.
     - Return the updated order.
  3. `backend/app/services/payments.py` — add:
     - `async def refund_razorpay_payment(payment_id: str, amount_paise: int) -> dict`: dev mode (empty keys) → `{ "id": f"rfnd_dev_{payment_id}", "status": "processed" }`; else POST `https://api.razorpay.com/v1/payments/{payment_id}/refund` with basic auth and JSON `{"amount": amount_paise}` via httpx.
  4. `POST /payments/razorpay/refund`, body `{ "orderId": str }`:
     - Load order (owner check); must be `cancelled` with `refundStatus == "requested"` and `razorpayPaymentId` set, else 409 `REFUND_NOT_APPLICABLE`.
     - Call `refund_razorpay_payment(razorpayPaymentId, int(total * 100))`; set `refundStatus: "processed"`, store `razorpayRefundId`; return `{ "ok": true, "refundStatus": "processed" }`.
     - Idempotent: if already `processed` → 200 with the same body, no second refund call.
  5. Write `backend/tests/test_order_cancel.py`:
     - `test_cancel_placed_order`: → `status: "cancelled"`, `refundStatus: "none"`.
     - `test_cancel_paid_order_requests_refund`: paid order → `refundStatus: "requested"`.
     - `test_cancel_shipped_order_409`: force `status: "shipped"` → 409 `ORDER_NOT_CANCELLABLE`.
     - `test_cancel_other_users_order_404`.
     - `test_refund_dev_mode_processed`: cancel a paid order → POST refund → `refundStatus: "processed"`, `razorpayRefundId` starts with `rfnd_dev_`; second call → 200 without a new refund id.
     - `test_refund_not_applicable_409`: refund on a non-cancelled order → 409 `REFUND_NOT_APPLICABLE`.
- **Test:** `cd backend && .venv/bin/pytest tests/test_order_cancel.py -v`
- **Expected output:** `6 passed`.

### Task A4 — /v1/addresses CRUD + order addressId

- **Goal:** Saved delivery addresses replace free-text address strings at checkout. Spec: `docs/overview/03 … Part C/D item X6`.
- **Depends on:** Day 6 Task A2
- **Files to create/modify:**
  - `backend/app/models/addresses.py` (new)
  - `backend/app/routers/addresses.py` (new)
  - `backend/app/routers/orders.py` (modify — `addressId` on place-order)
  - `backend/app/main.py` (modify)
  - `backend/tests/test_addresses.py` (new)
- **Subtasks:**
  1. Write `backend/app/models/addresses.py`:
     - `class AddressRequest(BaseModel)`: `label: str` (e.g. `घर`, `खेत`), `line1: str`, `village: str`, `district: str`, `state: str`, `pincode: str` (exactly 6 digits, else 422 `VALIDATION_ERROR`), `lat: float | None = None`, `lng: float | None = None`, `isDefault: bool = False`
  2. Write `backend/app/routers/addresses.py` (`router = APIRouter(prefix="/addresses", tags=["addresses"])`, all authenticated roles), collection `addresses`:
     - `GET /addresses` → `{ "data": [...] }`, caller's addresses, default first.
     - `POST /addresses` → 201 with the created doc (`id`, `userId`); if `isDefault`, clear `isDefault` on the user's other addresses; the user's FIRST address is forced `isDefault: true`.
     - `PUT /addresses/{id}` → owner-only, else 404 `ADDRESS_NOT_FOUND`; same default-clearing rule.
     - `DELETE /addresses/{id}` → 204; if the deleted address was default and others remain, promote the oldest remaining one.
  3. In `POST /orders` (`app/routers/orders.py`): `PlaceOrderRequest` gains optional `addressId: str | None = None`; when present, load the address (owner check → 404 `ADDRESS_NOT_FOUND`) and compose the stored `deliveryAddress` string from `line1, village, district, state - pincode`. When absent, the existing `deliveryAddress` string path still works (back-compat, conventions §1).
  4. Write `backend/tests/test_addresses.py`:
     - `test_create_first_address_becomes_default`.
     - `test_second_default_clears_first`: two POSTs with `isDefault: true` → only the second is default; GET lists it first.
     - `test_update_pincode`.
     - `test_delete_default_promotes_next`.
     - `test_other_users_address_404`.
     - `test_bad_pincode_422`; plus `test_place_order_with_address_id`: POST /orders with `addressId` → stored `deliveryAddress` contains the village and pincode.
- **Test:** `cd backend && .venv/bin/pytest tests/test_addresses.py -v`
- **Expected output:** `7 passed`.

### Task B3 — Cancel button + refund status chip on order tracking

- **Goal:** Buyers can cancel a cancellable order and see where their refund stands. Spec: `docs/overview/03 … Part C/D item X5`.
- **Depends on:** Day 6 Task B2. API dependency: Day 6 Task A3 (same day).
- **Files to create/modify:**
  - `apps/mobile/lib/api/orders_api.dart` (modify — `cancelOrder(id)`)
  - `apps/mobile/lib/views/order_tracking_view.dart` (modify)
  - `apps/mobile/test/order_flow_test.dart` (modify — add tests)
- **Subtasks:**
  1. `orders_api.dart`: `cancelOrder(String id)` → POST `/orders/{id}/cancel`.
  2. `order_tracking_view.dart` detail section: `ऑर्डर रद्द करें` button visible ONLY when status is `placed` or `paid`; tap → confirm dialog (`ऑर्डर रद्द करें?` + warning that paid orders are refunded) → `cancelOrder` → refresh list. On 409 `ORDER_NOT_CANCELLABLE` show the server message and hide the button.
  3. Refund chip: when `refundStatus != 'none'` render a chip on the order card — `requested` → amber `रिफंड प्रक्रिया में`; `processed` → green `रिफंड हो गया`.
  4. Add to `apps/mobile/test/order_flow_test.dart`:
     - `testWidgets('cancel button hidden for shipped order', ...)`.
     - `testWidgets('cancel button visible for placed, confirm calls api', ...)`.
     - `testWidgets('refund chip renders requested/processed states', ...)`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/order_flow_test.dart`
- **Expected output:** `No issues found!`; all order-flow tests pass (2 existing + 3 new).

### Task B4 — Address book screen + checkout picker

- **Goal:** Saved addresses managed in one screen; checkout picks instead of typing. Spec: `docs/overview/03 … Part C/D item X6`.
- **Depends on:** Day 6 Task B2. API dependency: Day 6 Task A4 (same day).
- **Files to create/modify:**
  - `apps/mobile/lib/api/addresses_api.dart` (new)
  - `apps/mobile/lib/views/common/address_book_view.dart` (new screen)
  - `apps/mobile/lib/views/checkout_sheet.dart` (modify — picker replaces free-text)
  - `apps/mobile/lib/state/profile_routes.dart` (modify — route `addressBook` for marketplace roles)
  - `apps/mobile/test/address_book_test.dart` (new)
- **Subtasks:**
  1. `addresses_api.dart`: `getAddresses()`, `createAddress(Map fields)`, `updateAddress(id, Map fields)`, `deleteAddress(id)`.
  2. `address_book_view.dart`: list of address cards (label, line1, village/district/state, pincode, default star); actions: set-default, edit, delete (confirm dialog); FAB `पता जोड़ें` → form sheet with all fields, pincode field validated to 6 digits inline. Reachable from settings/profile and from checkout.
  3. `checkout_sheet.dart`: replace the free-text address field with a selected-address card — default address preselected; tap opens a picker sheet (radio list from `getAddresses()` + `नया पता जोड़ें` row → address form). `placeOrder` now sends `addressId`; if the user has no addresses yet, the picker opens the add form first (no dead end).
  4. `apps/mobile/test/address_book_test.dart`:
     - `testWidgets('address list renders with default first', ...)`.
     - `testWidgets('add form validates 6-digit pincode', ...)`.
     - `testWidgets('checkout picker selection fills address card and sends addressId', ...)` — fake api, pick second address; assert fake `placeOrder` recorded that `addressId`.
- **Test:** `cd apps/mobile && flutter analyze && flutter test test/address_book_test.dart`
- **Expected output:** `No issues found!`; 3 tests pass; manual: add address → checkout preselects it → order placed with `addressId`.

## Done-when checklist (end of day)

- [ ] `scripts/seed_products.py` seeds ≥3 products across categories with certificates.
- [ ] Products list/detail/certificate endpoints + cart CRUD pass pytest (6 tests).
- [ ] Orders: idempotent POST, BNPL schedule, owner-only detail, cart cleared.
- [ ] Razorpay dev-mode create/verify passes; bad signature → 400 `PAYMENT_SIGNATURE_INVALID`.
- [ ] `cd backend && .venv/bin/pytest -v` → full suite green.
- [ ] Marketplace screen live with category filter, search, certificate dialog with AGMARK badge.
- [ ] Checkout: COD/BNPL places order; UPI opens Razorpay sheet and verifies; idempotency key stable.
- [ ] New `order_tracking_view.dart` reachable and shows status chips; route ACL updated.
- [ ] `flutter analyze` 0 issues; marketplace + order tests pass.
- [ ] `POST /v1/orders/{id}/cancel`: placed/paid → cancelled; shipped → 409 `ORDER_NOT_CANCELLABLE`; paid orders set `refundStatus: requested` (X5).
- [ ] `POST /v1/payments/razorpay/refund` dev-mode → `processed` with `rfnd_dev_*` id; repeat call idempotent; pytest 6 passed (X5).
- [ ] `/v1/addresses` CRUD with default handling passes pytest (7 tests); `POST /orders` accepts `addressId` and composes `deliveryAddress` (X6).
- [ ] Order tracking: cancel button visible only for placed/paid, refund chip shows `requested`/`processed` states (X5).
- [ ] `address_book_view.dart` + checkout address picker replace the free-text address field (X6).
