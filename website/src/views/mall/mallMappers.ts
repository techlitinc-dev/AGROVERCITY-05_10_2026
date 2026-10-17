import type { MallProduct } from '../../types';

/**
 * The mall catalog API (`GET /products`) returns raw seller/gruh-udyog product
 * docs (`discountedPrice`, `reviewsCount`, `inStock`, optional `imageUrl`),
 * while the shared `MallProduct` type (and cartStore) speaks `price`,
 * `ratingCount` and `stockQty`. These helpers bridge the two shapes once so
 * every mall view maps data the same way.
 */
export interface ApiProductDoc {
  id?: string;
  title?: string;
  vernacularTitle?: string;
  category?: string;
  brand?: string;
  rating?: number;
  ratingAvg?: number;
  reviewsCount?: number;
  ratingCount?: number;
  dealerName?: string;
  sellerName?: string;
  mrp?: number;
  discountedPrice?: number;
  price?: number;
  bnplAvailable?: boolean;
  batchNo?: string;
  inStock?: boolean;
  stock?: number;
  stockQty?: number;
  unit?: string;
  description?: string;
  imageUrl?: string;
  sellerId?: string;
  source?: string;
  unitId?: string;
  gruhProductId?: string;
  specifications?: Record<string, string>;
  [key: string]: unknown;
}

export const PRODUCT_PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=400&q=80';

export function toMallProduct(doc: ApiProductDoc): MallProduct {
  const price = Number(doc.discountedPrice ?? doc.price ?? 0);
  const mrp = Number(doc.mrp ?? price);
  return {
    id: String(doc.id ?? ''),
    title: doc.title ?? 'Product',
    category: (doc.category ?? 'Seeds') as MallProduct['category'],
    brand: doc.brand ?? '',
    price,
    mrp,
    rating: Number(doc.rating ?? doc.ratingAvg ?? 0),
    ratingCount: Number(doc.reviewsCount ?? doc.ratingCount ?? 0),
    stockQty: Number(doc.stock ?? doc.stockQty ?? (doc.inStock === false ? 0 : 10)),
    unit: doc.unit ?? '',
    imageUrl: doc.imageUrl || PRODUCT_PLACEHOLDER_IMAGE,
    sellerName: doc.sellerName ?? doc.dealerName ?? 'Krishi Mall Seller',
    description: doc.description ?? '',
    specifications: doc.specifications ?? {},
  };
}

/** A cart row from `GET /cart` — `{ productId, quantity, product }`. */
export interface ApiCartRow {
  productId: string;
  quantity: number;
  product: ApiProductDoc;
}

export interface ApiCart {
  data: ApiCartRow[];
  cartTotal: number;
}

export function isApiCart(value: unknown): value is ApiCart {
  return (
    value !== null &&
    typeof value === 'object' &&
    Array.isArray((value as ApiCart).data)
  );
}

/**
 * `mall.cart()` goes through `readOne`, which unwraps `{data: rows}` to the
 * bare rows array — but accept the full envelope too so this keeps working if
 * the helper ever stops unwrapping.
 */
export function parseCartRows(payload: unknown): ApiCartRow[] {
  if (Array.isArray(payload)) return payload as ApiCartRow[];
  if (isApiCart(payload)) return payload.data;
  return [];
}

// --- order docs (`POST /orders`, `GET /orders`) ---

export interface ApiOrderItem {
  productId: string;
  quantity: number;
}

export interface ApiOrderEvent {
  status: string;
  at: string;
  note?: string;
}

export interface ApiOrder {
  id: string;
  userId?: string;
  items: ApiOrderItem[];
  paymentMethod: string;
  deliveryAddress?: string;
  addressId?: string;
  total: number;
  discount?: number;
  finalTotal?: number;
  couponCode?: string;
  status: string;
  refundStatus?: string;
  returnStatus?: string;
  returnReason?: string;
  events?: ApiOrderEvent[];
  createdAt: string;
  updatedAt?: string;
  cancelledAt?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  bnplSchedule?: ApiBnplInstallment[];
  [key: string]: unknown;
}

export interface ApiBnplInstallment {
  installment: number;
  dueInDays: number;
  amount: number;
}

export function asOrders(payload: unknown): ApiOrder[] {
  if (Array.isArray(payload)) return payload as ApiOrder[];
  return [];
}

export function orderTotal(order: ApiOrder): number {
  return Number(order.finalTotal ?? order.total ?? 0);
}

export function orderNumber(order: ApiOrder): string {
  return order.id.replace(/^ord_/, '').toUpperCase();
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// --- misc record helpers (addresses / coupons / reviews / subscriptions) ---

export type AnyRecord = Record<string, unknown>;

export function asRecords(payload: unknown): AnyRecord[] {
  if (Array.isArray(payload)) return payload as AnyRecord[];
  return [];
}

export function asRecord(payload: unknown): AnyRecord {
  return (payload ?? {}) as AnyRecord;
}

export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
