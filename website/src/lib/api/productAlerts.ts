import { del, post, readItems } from './http';

/** Per-product alert subscriptions (SR 13) — price drop / restock on any product,
 * plus back-in-season alerts via followed sellers. */

export type ProductAlertKind = 'price_drop' | 'restock' | 'back_in_season';

export interface ProductAlert {
  productId: string;
  name: string;
  price: number;
  stockQty: number;
  kinds: ProductAlertKind[];
  since: string;
}

const BASE = '/customer/product-alerts';

/** GET /customer/product-alerts — own subscriptions joined with live product data. */
export const getProductAlerts = (): Promise<ProductAlert[]> => readItems<ProductAlert>(BASE);

/** POST /customer/product-alerts — subscribe; re-subscribing replaces kinds. */
export const subscribeProductAlert = (productId: string, kinds: ProductAlertKind[]): Promise<unknown> =>
  post<unknown>(BASE, { productId, kinds });

/** DELETE /customer/product-alerts/{productId} */
export const unsubscribeProductAlert = (productId: string): Promise<unknown> =>
  del<unknown>(`${BASE}/${encodeURIComponent(productId)}`);
