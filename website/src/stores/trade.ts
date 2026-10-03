import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LotLocation } from '../lib/api/trade';

/**
 * Trade UI state — offline-tolerant form drafts (spec F4), inbox filters and
 * lightweight caches. Nothing here is authoritative; the backend is.
 */

export interface LotDraft {
  crop: string;
  quantityQuintals: string;
  expectedRate: string;
  harvestDate: string;
  location: LotLocation;
}

export interface DemandDraft {
  crop: string;
  variety: string;
  quantity: string;
  qualityGrade: 'A' | 'B' | 'C';
  maxPrice: string;
  packaging: string;
  deliveryLocation: string;
  neededBy: string;
  frequency: 'oneTime' | 'weekly' | 'monthly';
  notes: string;
}

interface TradeState {
  lotDraft: LotDraft | null;
  demandDraft: DemandDraft | null;
  offerFilter: 'sent' | 'received';
  notificationsUnread: number;
  saveLotDraft: (draft: LotDraft | null) => void;
  saveDemandDraft: (draft: DemandDraft | null) => void;
  setOfferFilter: (filter: 'sent' | 'received') => void;
  setNotificationsUnread: (count: number) => void;
}

export const useTradeStore = create<TradeState>()(
  persist(
    (set) => ({
      lotDraft: null,
      demandDraft: null,
      offerFilter: 'received',
      notificationsUnread: 0,
      saveLotDraft: (draft) => set({ lotDraft: draft }),
      saveDemandDraft: (draft) => set({ demandDraft: draft }),
      setOfferFilter: (filter) => set({ offerFilter: filter }),
      setNotificationsUnread: (count) => set({ notificationsUnread: count }),
    }),
    { name: 'agvc-trade' }
  )
);
