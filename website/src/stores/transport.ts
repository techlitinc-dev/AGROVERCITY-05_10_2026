import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Transport UI state — offline-tolerant Post-a-Load wizard draft (spec §2.6),
 * mirroring the trade module's draft store. Nothing here is authoritative.
 */

export interface LoadDraft {
  crop: string;
  quantityQuintals: string;
  packaging: string;
  perishable: boolean;
  pickupLocation: string;
  dropLocation: string;
  pickupDate: string;
  distanceKm: string;
  preferredVehicleType: string;
  pricePath: 'instant' | 'auction';
  targetFare: string;
  notes: string;
}

interface TransportState {
  loadDraft: LoadDraft | null;
  saveLoadDraft: (draft: LoadDraft | null) => void;
}

export const useTransportStore = create<TransportState>()(
  persist(
    (set) => ({
      loadDraft: null,
      saveLoadDraft: (draft) => set({ loadDraft: draft }),
    }),
    { name: 'agvc-transport' }
  )
);
