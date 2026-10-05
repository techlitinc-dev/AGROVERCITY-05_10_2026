/**
 * Single web wrapper for Razorpay `checkout.js` (phase-04 WS-01).
 *
 * Instructions.md §Repo orientation: never scatter `window.Razorpay` across
 * views — every checkout goes through `openRazorpayCheckout`. Amounts are
 * passed in INTEGER PAISA by callers; this module never multiplies by 100.
 * The publishable key id comes from `VITE_RAZORPAY_KEY_ID` (see .env.example).
 */

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise: Promise<void> | null = null;

/** Inject checkout.js once; subsequent calls reuse the same promise. */
export function loadRazorpayScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Unable to load the Razorpay checkout script'));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface OpenRazorpayOptions {
  orderId: string;
  /** Order amount in integer paisa (already converted by the caller). */
  amountPaisa: number;
  name: string;
  description: string;
  prefill?: { name?: string; contact?: string };
  onSuccess: (r: RazorpaySuccess) => void;
  onDismiss?: () => void;
}

/** Open the Razorpay checkout modal for a server-created order. */
export async function openRazorpayCheckout(opts: OpenRazorpayOptions): Promise<void> {
  await loadRazorpayScript();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const RazorpayCtor = (window as any).Razorpay;
  if (!RazorpayCtor) {
    throw new Error('Razorpay checkout is unavailable');
  }
  const checkout = new RazorpayCtor({
    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
    order_id: opts.orderId,
    amount: opts.amountPaisa,
    currency: 'INR',
    name: opts.name,
    description: opts.description,
    prefill: opts.prefill,
    handler: opts.onSuccess,
    modal: { ondismiss: opts.onDismiss },
  });
  checkout.open();
}
