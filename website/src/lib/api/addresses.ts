import { apiClient } from './client';
import { post, put, del } from './http';

/**
 * Saved addresses namespace — the Swiggy/Zomato-style address book backing
 * every persona flow (mall checkout, transport pickup/drop, land listings,
 * equipment requests). Account-level: one address book per user, shared
 * across personas, with a persona-specific `label` vocabulary.
 */

export interface SavedAddress {
  id: string;
  label: string;
  customLabel?: string | null;
  line1: string;
  landmark?: string;
  village: string;
  district: string;
  state: string;
  pincode: string;
  contactName?: string;
  contactPhone?: string;
  lat?: number | null;
  lng?: number | null;
  isDefault?: boolean;
  createdAt?: string;
}

export interface AddressInput {
  label: string;
  customLabel?: string | null;
  line1: string;
  landmark?: string;
  village: string;
  district: string;
  state: string;
  pincode: string;
  contactName?: string;
  contactPhone?: string;
  lat?: number | null;
  lng?: number | null;
  isDefault?: boolean;
}

export const addresses = {
  /** GET /addresses — saved addresses, default first (backend sorts). */
  list: async (): Promise<SavedAddress[]> => {
    const res = await apiClient.get('/addresses');
    return (res.data?.data ?? res.data ?? []) as SavedAddress[];
  },
  /** POST /addresses — create; the first address becomes the default. */
  create: (payload: AddressInput): Promise<SavedAddress> => post<SavedAddress>('/addresses', payload),
  /** PUT /addresses/{id} — full update; isDefault=true clears other defaults. */
  update: (id: string, payload: AddressInput): Promise<SavedAddress> =>
    put<SavedAddress>(`/addresses/${id}`, payload),
  /** DELETE /addresses/{id}. */
  remove: (id: string): Promise<{ success?: boolean }> => del<{ success?: boolean }>(`/addresses/${id}`),
};

/** Display label — "Other" falls back to the user's custom label. */
export const addressLabel = (a: Pick<SavedAddress, 'label' | 'customLabel'>): string =>
  a.label === 'Other' && a.customLabel ? a.customLabel : a.label;

/** Single-line summary for compact selects and cards. */
export const addressSummary = (a: SavedAddress): string =>
  [a.line1, a.village, a.district, a.state, a.pincode].filter(Boolean).join(', ');
