import { api } from './client';

/**
 * Marketplace (mall) API wrappers — phase-05 WS-03.
 * Verified against backend/app/routers/{marketplace,orders,order_tracking,wishlist,
 * coupons,addresses,ratings,seller_products,user_products}.py and
 * backend/app/services/payments.py.
 *
 * ## Backend quirks (read before touching a view)
 *
 * 1. **Pagination.** The catalog / orders / reviews routes paginate with
 *    `page` + `pageSize` and return `{data, page, pageSize, total}` — there is no
 *    server-side cursor. The wrappers below expose an OPAQUE `nextCursor` (a
 *    base64 token that carries the next page index) and never surface a page
 *    number to the UI (rule 7). `nextCursor === null` means "last page".
 * 2. **Money unit.** Product money fields (`mrp`, `discountedPrice`) and the
 *    order/cart/coupon totals are stored and returned as plain numbers in the
 *    unit the seeded catalog uses (rupees); the routers convert to paisa only on
 *    the way out to Razorpay (`int(total * 100)`). Every wrapper here converts
 *    ONCE via `toPaisa()` and exposes `*Paisa` fields, so views work in integer
 *    paisa only (rule 6). Server-computed values stay authoritative.
 * 3. **Order idempotency.** `POST /orders` takes the key in the BODY
 *    (`idempotencyKey`) *and* in the `Idempotency-Key` header — `placeOrder`
 *    sends the same value in both so a replay returns the original order.
 * 4. **Idempotency-Key on writes.** Cart / wishlist / review / address / coupon /
 *    refund / seller writes have no body-level key: they carry the
 *    `Idempotency-Key` header only. `client.ts` also attaches one to every
 *    non-GET request, so the header is always present (rule 7).
 * 5. **BNPL.** `POST /orders` still accepts `paymentMethod: "bnpl"` and answers
 *    with a two-instalment `bnplSchedule`. WS-03 never calls it: BNPL renders as
 *    the labelled partner placeholder (`marketplaceBnplComingPartner`) instead of
 *    a fake flow (instructions §WS-03 step 4).
 * 6. **Payments.** Razorpay order create/verify/refund live on
 *    `/payments/razorpay/*` and use the phase-00 rails in `services/payments.py`.
 *    `createRazorpayOrder` returns the server-computed `amountPaisa` — the
 *    checkout passes that value to `openRazorpayCheckout` verbatim.
 * 7. **Review eligibility.** `GET /products/{id}/reviews/eligibility` (added in
 *    WS-03 task 3.7) is the only gate for the review form: it confirms a
 *    delivered order for this buyer + product.
 * 8. **Product deletion.** Only `/my-products/{id}` supports DELETE (and the
 *    backend refuses when the product has live orders); the seller route
 *    (`/seller/products`) has no delete.
 */

/* ------------------------------------------------------------------ cursor -- */

const CURSOR_PREFIX = 'mkt-page';

/** Opaque cursor token for the next page (see quirk 1). */
function encodeCursor(page: number): string {
  return btoa(`${CURSOR_PREFIX}:${page}`);
}

function cursorToPage(cursor: string | null | undefined): number {
  if (!cursor) return 1;
  let decoded: string;
  try {
    decoded = atob(cursor);
  } catch {
    throw new Error('MARKETPLACE_CURSOR_INVALID');
  }
  const [prefix, rawPage] = decoded.split(':');
  const page = Number(rawPage);
  if (prefix !== CURSOR_PREFIX || !Number.isInteger(page) || page < 1) {
    throw new Error('MARKETPLACE_CURSOR_INVALID');
  }
  return page;
}

function nextCursorFor(page: number, pageSize: number, total: number): string | null {
  return page * pageSize < total ? encodeCursor(page + 1) : null;
}

export interface CursorPage<T> {
  data: T[];
  /** Opaque cursor for the next page — `null` on the last page. */
  nextCursor: string | null;
  total: number;
}

interface RawPaged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

function toCursorPage<T>(raw: RawPaged<T>): CursorPage<T> {
  return {
    data: raw.data,
    total: raw.total,
    nextCursor: nextCursorFor(raw.page, raw.pageSize, raw.total),
  };
}

/* ------------------------------------------------------------------- money -- */

/** Single rupees→integer-paisa conversion point (quirk 2, rule 6). */
export function toPaisa(amount: number): number {
  return Math.round(amount * 100);
}

/** Render integer paisa as ₹ with exactly two decimals (display only). */
export function formatPaisa(paisa: number): string {
  const sign = paisa < 0 ? '-' : '';
  const abs = Math.abs(paisa);
  const rupees = Math.floor(abs / 100);
  const coins = abs % 100;
  return `${sign}₹${rupees.toLocaleString('en-IN')}.${coins.toString().padStart(2, '0')}`;
}

/* ----------------------------------------------------------------- product -- */

export interface MarketplaceProduct {
  id: string;
  title: string;
  vernacularTitle?: string;
  category: string;
  brand?: string;
  rating?: number;
  reviewsCount?: number;
  ratingCount?: number;
  ratingAvg?: number;
  dealerName?: string;
  sellerId?: string;
  sellerName?: string;
  distanceKm?: number;
  /** Plain number in the catalog unit — use `productPricePaisa()` / `productMrpPaisa()`. */
  mrp: number;
  discountedPrice: number;
  bnplAvailable?: boolean;
  batchNo?: string;
  unit?: string;
  description?: string;
  imageUrl?: string;
  inStock: boolean;
}

export function productPricePaisa(product: MarketplaceProduct): number {
  return toPaisa(product.discountedPrice);
}

export function productMrpPaisa(product: MarketplaceProduct): number {
  return toPaisa(product.mrp);
}

export interface Certificate {
  batchNo: string;
  certifier: string;
  certificateNo: string;
  valid: boolean;
  verifiedAt: string;
}

/* --------------------------------------------------------------- catalog ---- */

export interface CatalogQuery {
  /** Category slug the backend matches as a case-insensitive substring. */
  category?: string;
  /** Free-text search across the title + vernacular title. */
  query?: string;
  cursor?: string | null;
  pageSize?: number;
}

export async function listCatalog(
  params: CatalogQuery = {}
): Promise<CursorPage<MarketplaceProduct>> {
  const pageSize = params.pageSize ?? 20;
  const { data } = await api.get<RawPaged<MarketplaceProduct>>('/products', {
    params: {
      page: cursorToPage(params.cursor),
      pageSize,
      ...(params.category ? { category: params.category } : {}),
      ...(params.query ? { query: params.query } : {}),
    },
  });
  return toCursorPage(data);
}

export async function getProduct(productId: string): Promise<MarketplaceProduct> {
  const { data } = await api.get<MarketplaceProduct>(`/products/${productId}`);
  return data;
}

/** QR authenticity certificate for the product's batch (`certificates/<batchNo>`). */
export async function getCertificate(productId: string): Promise<Certificate> {
  const { data } = await api.get<Certificate>(`/products/${productId}/certificate`);
  return data;
}

/* -------------------------------------------------------------------- cart -- */

export interface CartLine {
  productId: string;
  quantity: number;
  product: MarketplaceProduct;
}

export interface Cart {
  lines: CartLine[];
  /** Server cart total in integer paisa (authoritative). */
  serverTotalPaisa: number;
}

interface RawCart {
  data: Array<{ productId: string; quantity: number; product: MarketplaceProduct }>;
  cartTotal: number;
}

function toCart(raw: RawCart): Cart {
  return { lines: raw.data, serverTotalPaisa: toPaisa(raw.cartTotal) };
}

export async function getCart(): Promise<Cart> {
  const { data } = await api.get<RawCart>('/cart');
  return toCart(data);
}

export async function addCartItem(productId: string, quantity: number): Promise<Cart> {
  const { data } = await api.post<RawCart>(
    '/cart/items',
    { productId, quantity },
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return toCart(data);
}

/** `quantity <= 0` removes the line (backend semantics). */
export async function updateCartItem(productId: string, quantity: number): Promise<Cart> {
  const { data } = await api.put<RawCart>(
    `/cart/items/${productId}`,
    { quantity },
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return toCart(data);
}

export async function removeCartItem(productId: string): Promise<Cart> {
  const { data } = await api.delete<RawCart>(`/cart/items/${productId}`, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  return toCart(data);
}

/* ------------------------------------------------------------------ orders -- */

export type OrderStatus =
  | 'placed'
  | 'paid'
  | 'confirmed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'closed'
  | 'returned'
  | 'cancelled';

export interface OrderEvent {
  status: string;
  at: string;
  note?: string;
}

export interface MarketplaceOrder {
  id: string;
  status: OrderStatus;
  paymentMethod: string;
  items: Array<{ productId: string; quantity: number }>;
  deliveryAddress?: string;
  totalPaisa: number;
  discountPaisa: number | null;
  finalTotalPaisa: number;
  couponCode?: string | null;
  refundStatus: string;
  returnStatus?: string | null;
  returnReason?: string | null;
  razorpayPaymentId?: string | null;
  cancelledAt?: string | null;
  events: OrderEvent[];
  createdAt: string;
}

interface RawOrder {
  id: string;
  status: OrderStatus;
  paymentMethod: string;
  items: Array<{ productId: string; quantity: number }>;
  deliveryAddress?: string;
  total: number;
  discount?: number;
  finalTotal?: number;
  couponCode?: string | null;
  refundStatus?: string;
  returnStatus?: string | null;
  returnReason?: string | null;
  razorpayPaymentId?: string | null;
  cancelledAt?: string | null;
  events?: OrderEvent[];
  createdAt: string;
}

function toOrder(raw: RawOrder): MarketplaceOrder {
  const totalPaisa = toPaisa(raw.total);
  return {
    id: raw.id,
    status: raw.status,
    paymentMethod: raw.paymentMethod,
    items: raw.items ?? [],
    deliveryAddress: raw.deliveryAddress,
    totalPaisa,
    discountPaisa: raw.discount === undefined ? null : toPaisa(raw.discount),
    finalTotalPaisa: raw.finalTotal === undefined ? totalPaisa : toPaisa(raw.finalTotal),
    couponCode: raw.couponCode ?? null,
    refundStatus: raw.refundStatus ?? 'none',
    returnStatus: raw.returnStatus ?? null,
    returnReason: raw.returnReason ?? null,
    razorpayPaymentId: raw.razorpayPaymentId ?? null,
    cancelledAt: raw.cancelledAt ?? null,
    events: raw.events ?? [],
    createdAt: raw.createdAt,
  };
}

export async function listOrders(
  params: { cursor?: string | null; pageSize?: number } = {}
): Promise<CursorPage<MarketplaceOrder>> {
  const pageSize = params.pageSize ?? 20;
  const { data } = await api.get<RawPaged<RawOrder>>('/orders', {
    params: { page: cursorToPage(params.cursor), pageSize },
  });
  return { ...toCursorPage(data), data: data.data.map(toOrder) };
}

export async function getOrder(orderId: string): Promise<MarketplaceOrder> {
  const { data } = await api.get<RawOrder>(`/orders/${orderId}`);
  return toOrder(data);
}

export async function getOrderTimeline(orderId: string): Promise<OrderEvent[]> {
  const { data } = await api.get<{ orderId: string; data: OrderEvent[]; total: number }>(
    `/orders/${orderId}/timeline`
  );
  return data.data;
}

export interface PlaceOrderPayload {
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: string;
  addressId?: string;
  deliveryAddress?: string;
  couponCode?: string;
  /** Optional pre-generated key; a fresh uuid is used when omitted. */
  idempotencyKey?: string;
}

export interface PlaceOrderResult {
  orderId: string;
  totalPaisa: number;
  discountPaisa: number | null;
  finalTotalPaisa: number;
}

/**
 * `POST /orders`. The same idempotency value travels in the body and the header
 * (quirk 3). The cart is cleared server-side on success.
 */
export async function placeOrder(payload: PlaceOrderPayload): Promise<PlaceOrderResult> {
  const idempotencyKey = payload.idempotencyKey ?? crypto.randomUUID();
  const { data } = await api.post<{
    orderId: string;
    total: number;
    discount?: number;
    finalTotal?: number;
  }>(
    '/orders',
    { ...payload, idempotencyKey },
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return {
    orderId: data.orderId,
    totalPaisa: toPaisa(data.total),
    discountPaisa: data.discount === undefined ? null : toPaisa(data.discount),
    finalTotalPaisa: data.finalTotal === undefined ? toPaisa(data.total) : toPaisa(data.finalTotal),
  };
}

export async function cancelOrder(orderId: string): Promise<MarketplaceOrder> {
  const { data } = await api.post<RawOrder>(
    `/orders/${orderId}/cancel`,
    {},
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return toOrder(data);
}

/** Return request — allowed only for `delivered` / `paid` orders (backend rule). */
export async function requestReturn(orderId: string, reason: string): Promise<MarketplaceOrder> {
  const { data } = await api.post<RawOrder>(
    `/orders/${orderId}/return`,
    { reason },
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return toOrder(data);
}

/* --------------------------------------------------------------- payments --- */

export interface RazorpayOrderHandle {
  razorpayOrderId: string;
  /** Integer paisa, computed server-side. Pass it to `openRazorpayCheckout`. */
  amountPaisa: number;
  currency: string;
  keyId: string;
}

export async function createRazorpayOrder(orderId: string): Promise<RazorpayOrderHandle> {
  const { data } = await api.post<{
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId: string;
  }>('/payments/razorpay/order', { orderId }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
  return {
    razorpayOrderId: data.razorpayOrderId,
    amountPaisa: data.amount,
    currency: data.currency,
    keyId: data.keyId,
  };
}

export async function verifyRazorpayPayment(payload: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<{ ok: boolean; status: string }> {
  const { data } = await api.post<{ ok: boolean; status: string }>(
    '/payments/razorpay/verify',
    payload,
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return data;
}

/**
 * Refund rail. The backend only refunds a cancelled order whose `refundStatus`
 * is `requested` and that carries a `razorpayPaymentId`; it answers
 * `409 REFUND_NOT_APPLICABLE` otherwise (surfaced as an ApiError).
 */
export async function requestRefund(orderId: string): Promise<{ ok: boolean; refundStatus: string }> {
  const { data } = await api.post<{ ok: boolean; refundStatus: string }>(
    '/payments/razorpay/refund',
    { orderId },
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return data;
}

/* --------------------------------------------------------------- wishlist --- */

export async function listWishlist(): Promise<MarketplaceProduct[]> {
  const { data } = await api.get<{ data: MarketplaceProduct[]; total: number }>('/wishlist');
  return data.data;
}

export async function addWishlistItem(productId: string): Promise<MarketplaceProduct[]> {
  const { data } = await api.post<{ data: MarketplaceProduct[]; total: number }>(
    '/wishlist/items',
    { productId },
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return data.data;
}

export async function removeWishlistItem(productId: string): Promise<void> {
  await api.delete(`/wishlist/items/${productId}`, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
}

/* ---------------------------------------------------------------- coupons --- */

export interface CouponValidation {
  valid: boolean;
  /** Integer paisa, computed server-side. */
  discountPaisa: number;
  /** Integer paisa, computed server-side. */
  finalTotalPaisa: number;
  message: string;
}

export interface CouponSummary {
  code: string;
  type: 'percentage' | 'flat';
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  validUntil?: string | null;
  description: string;
  applicable?: boolean;
}

/**
 * `POST /coupons/validate`. `cartTotalLegacy` must be the server cart total in
 * the catalog unit (see quirk 2) — views should pass `cart.serverTotalPaisa`
 * converted back, which `validateCouponForCart` does.
 */
export async function validateCoupon(
  code: string,
  cartTotalLegacy: number
): Promise<CouponValidation> {
  const { data } = await api.post<{
    valid: boolean;
    discount: number;
    finalTotal: number;
    message: string;
  }>(
    '/coupons/validate',
    { code, cartTotal: cartTotalLegacy },
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return {
    valid: data.valid,
    discountPaisa: toPaisa(data.discount),
    finalTotalPaisa: toPaisa(data.finalTotal),
    message: data.message,
  };
}

/** Applies a coupon against the authoritative server cart total (integer paisa in, paisa out). */
export async function validateCouponForCart(
  code: string,
  cartTotalPaisa: number
): Promise<CouponValidation> {
  return validateCoupon(code, cartTotalPaisa / 100);
}

export async function listCoupons(cartTotalPaisa?: number): Promise<CouponSummary[]> {
  const { data } = await api.get<{ data: CouponSummary[]; total: number }>('/coupons', {
    params: cartTotalPaisa === undefined ? {} : { cartTotal: cartTotalPaisa / 100 },
  });
  return data.data;
}

/* -------------------------------------------------------------- addresses --- */

export interface Address {
  id: string;
  label: string;
  line1: string;
  village: string;
  district: string;
  state: string;
  pincode: string;
  lat?: number | null;
  lng?: number | null;
  isDefault: boolean;
  createdAt?: string;
}

export type AddressPayload = Omit<Address, 'id' | 'createdAt'>;

export async function listAddresses(): Promise<Address[]> {
  const { data } = await api.get<{ data: Address[] }>('/addresses');
  return data.data;
}

export async function createAddress(payload: AddressPayload): Promise<Address> {
  const { data } = await api.post<Address>('/addresses', payload, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  return data;
}

export async function updateAddress(addressId: string, payload: AddressPayload): Promise<Address> {
  const { data } = await api.put<Address>(`/addresses/${addressId}`, payload, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  return data;
}

export async function deleteAddress(addressId: string): Promise<void> {
  await api.delete(`/addresses/${addressId}`, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
}

/* ---------------------------------------------------------------- reviews --- */

export interface ProductReview {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewEligibility {
  eligible: boolean;
  orderId: string | null;
  alreadyReviewed: boolean;
}

export async function listReviews(
  productId: string,
  params: { cursor?: string | null; pageSize?: number } = {}
): Promise<CursorPage<ProductReview>> {
  const pageSize = params.pageSize ?? 20;
  const { data } = await api.get<RawPaged<ProductReview>>(`/products/${productId}/reviews`, {
    params: { page: cursorToPage(params.cursor), pageSize },
  });
  return toCursorPage(data);
}

/** Gate for the review form: a delivered order for this buyer + product. */
export async function getReviewEligibility(productId: string): Promise<ReviewEligibility> {
  const { data } = await api.get<ReviewEligibility>(
    `/products/${productId}/reviews/eligibility`
  );
  return data;
}

/** One review per user per product (backend upsert semantics). */
export async function writeReview(
  productId: string,
  payload: { rating: number; comment?: string }
): Promise<ProductReview> {
  const { data } = await api.post<ProductReview>(
    `/products/${productId}/reviews`,
    { rating: payload.rating, comment: payload.comment ?? '' },
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return data;
}

/* ----------------------------------------------------------- seller side ---- */

export interface SellerProductPayload {
  title: string;
  category: string;
  brand?: string;
  /** Only the `/my-products` payload accepts a vernacular title. */
  vernacularTitle?: string;
  description?: string;
  mrp: number;
  discountedPrice: number;
  stock: number;
  unit?: string;
  imageUrl?: string;
  batchNo?: string;
}

/** Products of the signed-in seller (`GET /seller/products`) — seller role only. */
export async function listSellerProducts(): Promise<MarketplaceProduct[]> {
  const { data } = await api.get<{ data: MarketplaceProduct[]; total: number }>('/seller/products');
  return data.data;
}

export async function createSellerProduct(
  payload: SellerProductPayload
): Promise<MarketplaceProduct> {
  const { data } = await api.post<MarketplaceProduct>('/seller/products', payload, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  return data;
}

export async function updateSellerProduct(
  productId: string,
  payload: Partial<SellerProductPayload>
): Promise<MarketplaceProduct> {
  const { data } = await api.put<MarketplaceProduct>(`/seller/products/${productId}`, payload, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  return data;
}

/** Products listed by any signed-in user (`GET /my-products`). */
export async function listMyProducts(): Promise<MarketplaceProduct[]> {
  const { data } = await api.get<{ data: MarketplaceProduct[]; total: number }>('/my-products');
  return data.data;
}

export async function createMyProduct(payload: SellerProductPayload): Promise<MarketplaceProduct> {
  const { data } = await api.post<MarketplaceProduct>('/my-products', payload, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  return data;
}

export async function updateMyProduct(
  productId: string,
  payload: Partial<SellerProductPayload>
): Promise<MarketplaceProduct> {
  const { data } = await api.put<MarketplaceProduct>(`/my-products/${productId}`, payload, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  return data;
}

export async function deleteMyProduct(productId: string): Promise<void> {
  await api.delete(`/my-products/${productId}`, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
}

/** Product surface a form/list runs on: the seller role route or the user route. */
export type ProductSurface = 'seller' | 'myProducts';

export const PRODUCT_SURFACE_APIS: Record<
  ProductSurface,
  {
    list: () => Promise<MarketplaceProduct[]>;
    create: (payload: SellerProductPayload) => Promise<MarketplaceProduct>;
    update: (id: string, payload: Partial<SellerProductPayload>) => Promise<MarketplaceProduct>;
  }
> = {
  seller: {
    list: listSellerProducts,
    create: createSellerProduct,
    update: updateSellerProduct,
  },
  myProducts: {
    list: listMyProducts,
    create: createMyProduct,
    update: updateMyProduct,
  },
};

/** Browse-path for a product detail page (deep route registered in App.tsx). */
export function productDetailPath(productId: string): string {
  return `/dashboard/p/marketplace/${productId}`;
}

export const MARKETPLACE_ROUTES = {
  catalog: '/dashboard/p/marketplace',
  cart: '/dashboard/p/marketplace/cart',
  checkout: '/dashboard/p/marketplace/checkout',
  orders: '/dashboard/p/orders',
  orderDetail: (orderId: string) => `/dashboard/p/orders/${orderId}`,
  returns: '/dashboard/p/marketplace/returns',
  productDetail: productDetailPath,
  productNew: '/dashboard/p/marketplace/products/new',
  productEdit: (productId: string) => `/dashboard/p/marketplace/products/${productId}/edit`,
} as const;
