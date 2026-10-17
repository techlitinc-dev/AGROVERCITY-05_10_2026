import { del, post, put, readList, readOne } from './http';
import { MOCK_MALL_PRODUCTS } from './mocks';
import type { MallProduct } from '../../types';

/**
 * Krishi Mall namespace — products, cart, orders, wishlist, coupons, addresses.
 * Razorpay payment helpers included.
 */
export const mall = {
  // --- catalog ---
  /** GET /products */
  products: (params?: Record<string, unknown>): Promise<MallProduct[]> =>
    readList<MallProduct>('/products', { params, mock: MOCK_MALL_PRODUCTS }),

  /** GET /products/{id} */
  product: (productId: string): Promise<MallProduct> => readOne<MallProduct>(`/products/${productId}`),

  /** GET /products/{id}/certificate */
  productCertificate: (productId: string): Promise<unknown> =>
    readOne<unknown>(`/products/${productId}/certificate`),

  /** GET /products/{id}/reviews */
  productReviews: (productId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/products/${productId}/reviews`),

  /** POST /products/{id}/reviews */
  reviewProduct: (productId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/products/${productId}/reviews`, payload),

  // --- cart ---
  /** GET /cart */
  cart: (): Promise<unknown> => readOne<unknown>('/cart'),

  /** POST /cart/items */
  addToCart: (productId: string, quantity: number): Promise<unknown> =>
    post<unknown>('/cart/items', { productId, quantity }),

  /** PUT /cart/items/{productId} */
  updateCartItem: (productId: string, quantity: number): Promise<unknown> =>
    put<unknown>(`/cart/items/${productId}`, { quantity }),

  /** DELETE /cart/items/{productId} */
  removeFromCart: (productId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/cart/items/${productId}`),

  // --- wishlist ---
  /** GET /wishlist */
  wishlist: (): Promise<MallProduct[]> => readList<MallProduct>('/wishlist', { mock: [] }),

  /** POST /wishlist/items */
  addToWishlist: (productId: string): Promise<unknown> => post<unknown>('/wishlist/items', { productId }),

  /** DELETE /wishlist/items/{productId} */
  removeFromWishlist: (productId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/wishlist/items/${productId}`),

  // --- coupons ---
  /** GET /coupons */
  coupons: (): Promise<unknown[]> => readList<unknown[]>('/coupons'),

  /** POST /coupons/validate */
  validateCoupon: (code: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>('/coupons/validate', { code, ...payload }),

  // --- addresses ---
  /** GET /addresses */
  addresses: (): Promise<unknown[]> => readList<unknown[]>('/addresses'),

  /** POST /addresses */
  addAddress: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/addresses', payload),

  /** PUT /addresses/{id} */
  updateAddress: (addressId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/addresses/${addressId}`, updates),

  /** DELETE /addresses/{id} */
  removeAddress: (addressId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/addresses/${addressId}`),

  // --- orders ---
  /** GET /orders */
  orders: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/orders', { params }),

  /** POST /orders */
  placeOrder: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/orders', payload),

  /** GET /orders/{id} */
  order: (orderId: string): Promise<unknown> => readOne<unknown>(`/orders/${orderId}`),

  /** GET /orders/{id}/timeline */
  orderTimeline: (orderId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/orders/${orderId}/timeline`),

  /** PATCH /orders/{id}/status */
  updateOrderStatus: (orderId: string, status: string): Promise<unknown> =>
    put<unknown>(`/orders/${orderId}/status`, { status }),

  /** POST /orders/{id}/cancel */
  cancelOrder: (orderId: string, reason?: string): Promise<unknown> =>
    post<unknown>(`/orders/${orderId}/cancel`, reason ? { reason } : {}),

  /** POST /orders/{id}/return */
  returnOrder: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/orders/${orderId}/return`, payload),

  /** GET /orders/{id}/bnpl-schedule */
  bnplSchedule: (orderId: string): Promise<unknown> =>
    readOne<unknown>(`/orders/${orderId}/bnpl-schedule`),

  // --- payments (Razorpay) ---
  /** POST /payments/razorpay/order */
  createPaymentOrder: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/payments/razorpay/order', payload),

  /** POST /payments/razorpay/verify */
  verifyPayment: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/payments/razorpay/verify', payload),

  /** POST /payments/razorpay/refund */
  refundPayment: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/payments/razorpay/refund', payload),
};
