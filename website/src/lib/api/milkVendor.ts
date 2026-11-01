import { download, patch, post, put, readList, readOne } from './http';

/**
 * Milk Vendor (Doodhwala) namespace — private client records, schedule-driven
 * daily deliveries, rate rules, immutable bills (PDF + secure WhatsApp share
 * links) and vendor-recorded external payments. Money is integer paisa,
 * quantities integer millilitres throughout.
 */

export type VendorProfile = Record<string, unknown> & {
  id?: string;
  businessName?: string;
  billPrefix?: string;
  defaultShift?: string;
  kycVerified?: boolean;
};

export type VendorProduct = Record<string, unknown> & { id: string; name?: string; unit?: string; active?: boolean };

export interface VendorClient extends Record<string, unknown> {
  id: string;
  name?: string;
  whatsappNumber?: string;
  status?: string;
  defaultProductId?: string;
  defaultQuantityMilliLitres?: number;
  scheduleType?: string;
  scheduleStartDate?: string;
  defaultShift?: string;
  recordedBalancePaisa?: number;
}

export interface VendorBill extends Record<string, unknown> {
  id: string;
  billNumber?: string;
  revisionNumber?: number;
  status?: string;
  clientId?: string;
  clientName?: string;
  periodStart?: string;
  periodEnd?: string;
  deliveryTotalPaisa?: number;
  grossTotalPaisa?: number;
  paymentsAppliedPaisa?: number;
  balancePaisa?: number;
  hasShareLink?: boolean;
}

export interface VendorDelivery extends Record<string, unknown> {
  id: string;
  clientId?: string;
  deliveryDate?: string;
  shift?: string;
  status?: string;
  quantityMilliLitres?: number;
  amountPaisa?: number;
  extra?: boolean;
  billedBillId?: string | null;
}

export const milkVendor = {
  // --- profile / settings ---
  profile: (): Promise<VendorProfile> => readOne<VendorProfile>('/milk-vendor/profile'),
  saveProfile: (payload: Record<string, unknown>): Promise<VendorProfile> =>
    put<VendorProfile>('/milk-vendor/profile', payload),

  // --- products ---
  products: (): Promise<VendorProduct[]> => readList<VendorProduct>('/milk-vendor/products'),
  addProduct: (payload: Record<string, unknown>): Promise<VendorProduct> =>
    post<VendorProduct>('/milk-vendor/products', payload),
  updateProduct: (productId: string, updates: Record<string, unknown>): Promise<VendorProduct> =>
    patch<VendorProduct>(`/milk-vendor/products/${productId}`, updates),

  // --- rates ---
  rates: (params?: Record<string, unknown>): Promise<Record<string, unknown>[]> =>
    readList<Record<string, unknown>>('/milk-vendor/rates', { params }),
  addRate: (payload: Record<string, unknown>): Promise<Record<string, unknown>> =>
    post<Record<string, unknown>>('/milk-vendor/rates', payload),

  // --- clients ---
  clients: (params?: Record<string, unknown>): Promise<VendorClient[]> =>
    readList<VendorClient>('/milk-vendor/clients', { params }),
  addClient: (payload: Record<string, unknown>): Promise<VendorClient> =>
    post<VendorClient>('/milk-vendor/clients', payload),
  client: (clientId: string): Promise<Record<string, unknown>> =>
    readOne<Record<string, unknown>>(`/milk-vendor/clients/${clientId}`),
  updateClient: (clientId: string, updates: Record<string, unknown>): Promise<VendorClient> =>
    patch<VendorClient>(`/milk-vendor/clients/${clientId}`, updates),
  pauseClient: (clientId: string, payload: Record<string, unknown>): Promise<VendorClient> =>
    post<VendorClient>(`/milk-vendor/clients/${clientId}/pause`, payload),
  resumeClient: (clientId: string): Promise<VendorClient> =>
    post<VendorClient>(`/milk-vendor/clients/${clientId}/resume`, {}),
  deactivateClient: (clientId: string): Promise<VendorClient> =>
    post<VendorClient>(`/milk-vendor/clients/${clientId}/deactivate`, {}),

  // --- deliveries ---
  today: (params?: Record<string, unknown>): Promise<Record<string, unknown>> =>
    readOne<Record<string, unknown>>('/milk-vendor/today', { params }),
  recordDelivery: (payload: Record<string, unknown>): Promise<VendorDelivery> =>
    post<VendorDelivery>('/milk-vendor/deliveries', payload),
  recordBulk: (payload: Record<string, unknown>, idempotencyKey?: string): Promise<Record<string, unknown>> =>
    post<Record<string, unknown>>('/milk-vendor/deliveries/bulk', payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  correctDelivery: (deliveryId: string, updates: Record<string, unknown>): Promise<VendorDelivery> =>
    patch<VendorDelivery>(`/milk-vendor/deliveries/${deliveryId}`, updates),
  deliveries: (params?: Record<string, unknown>): Promise<VendorDelivery[]> =>
    readList<VendorDelivery>('/milk-vendor/deliveries', { params }),

  // --- bills ---
  previewBill: (payload: Record<string, unknown>): Promise<Record<string, unknown>> =>
    post<Record<string, unknown>>('/milk-vendor/bills/preview', payload),
  generateBill: (payload: Record<string, unknown>, idempotencyKey?: string): Promise<VendorBill> =>
    post<VendorBill>('/milk-vendor/bills', payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  bills: (params?: Record<string, unknown>): Promise<VendorBill[]> =>
    readList<VendorBill>('/milk-vendor/bills', { params }),
  bill: (billId: string): Promise<VendorBill> => readOne<VendorBill>(`/milk-vendor/bills/${billId}`),
  billPdf: (billId: string): Promise<Blob> => download(`/milk-vendor/bills/${billId}/pdf`),
  reviseBill: (billId: string, payload: Record<string, unknown>): Promise<VendorBill> =>
    post<VendorBill>(`/milk-vendor/bills/${billId}/revise`, payload),
  cancelBill: (billId: string, payload: Record<string, unknown>): Promise<VendorBill> =>
    post<VendorBill>(`/milk-vendor/bills/${billId}/cancel`, payload),
  shareLink: (billId: string): Promise<{ url: string; token: string }> =>
    post<{ url: string; token: string }>(`/milk-vendor/bills/${billId}/share-link`, {}),
  shareEvent: (billId: string, channel: string): Promise<Record<string, unknown>> =>
    post<Record<string, unknown>>(`/milk-vendor/bills/${billId}/share-event`, { channel }),

  // --- payments ---
  payments: (params?: Record<string, unknown>): Promise<Record<string, unknown>[]> =>
    readList<Record<string, unknown>>('/milk-vendor/payments', { params }),
  recordPayment: (payload: Record<string, unknown>): Promise<Record<string, unknown>> =>
    post<Record<string, unknown>>('/milk-vendor/payments', payload),
  voidPayment: (paymentId: string, reason: string): Promise<Record<string, unknown>> =>
    post<Record<string, unknown>>(`/milk-vendor/payments/${paymentId}/void`, { reason }),

  // --- public customer bill (no auth) ---
  publicBill: (token: string): Promise<Record<string, unknown>> =>
    readOne<Record<string, unknown>>(`/public/milk-bills/${token}`),
  publicBillPdf: (token: string): Promise<Blob> => download(`/public/milk-bills/${token}/pdf`),
};

/** rupees → integer paisa (never float storage). */
export function rupeesToPaisa(rupees: string | number): number {
  const n = typeof rupees === 'number' ? rupees : parseFloat(rupees);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

/** litres → integer millilitres. */
export function litresToMl(litres: string | number): number {
  const n = typeof litres === 'number' ? litres : parseFloat(litres);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return Math.round(n * 1000);
}

/** The spec message template for WhatsApp click-to-chat sharing. */
export function buildWhatsappMessage(bill: VendorBill, clientName: string, businessName: string, secureUrl: string): string {
  const money = (paisa?: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format((paisa || 0) / 100);
  return [
    `Namaste ${clientName},`,
    '',
    `Your milk bill from ${businessName} is ready.`,
    '',
    `Bill: ${bill.billNumber ?? ''}`,
    `Period: ${bill.periodStart} to ${bill.periodEnd}`,
    `Bill amount: ${money(bill.grossTotalPaisa)}`,
    `Payments recorded: ${money(bill.paymentsAppliedPaisa)}`,
    `Balance shown on bill: ${money(bill.balancePaisa)}`,
    '',
    'View/download bill:',
    secureUrl,
    '',
    'Thank you.',
  ].join('\n');
}

/** wa.me click-to-chat URL — digits only, message URL-encoded. */
export function whatsappChatUrl(phone: string, message: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
