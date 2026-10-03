import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CollectionShift, DairySpecies } from '../lib/api/dairy';

/**
 * Dairy UI state — backend-authoritative; this only holds drafts & filters.
 * The collection draft survives a mid-queue refresh (rural connectivity) and
 * is cleared on successful save. Mirrors stores/trade.ts philosophy.
 */

export interface CollectionDraft {
  memberId: string;
  shift: CollectionShift;
  milkType: DairySpecies;
  liters: string;
  fatPercent: string;
  snfPercent: string;
}

interface DairyState {
  collectionDraft: CollectionDraft | null;
  batchPeriod: { from: string; to: string };
  slipsFilter: { month: string };
  ordersFilter: { status: string };
  saveCollectionDraft: (draft: CollectionDraft | null) => void;
  setBatchPeriod: (period: { from: string; to: string }) => void;
  setSlipsFilter: (filter: { month: string }) => void;
  setOrdersFilter: (filter: { status: string }) => void;
}

export const useDairyStore = create<DairyState>()(
  persist(
    (set) => ({
      collectionDraft: null,
      batchPeriod: { from: '', to: '' },
      slipsFilter: { month: '' },
      ordersFilter: { status: '' },
      saveCollectionDraft: (draft) => set({ collectionDraft: draft }),
      setBatchPeriod: (period) => set({ batchPeriod: period }),
      setSlipsFilter: (filter) => set({ slipsFilter: filter }),
      setOrdersFilter: (filter) => set({ ordersFilter: filter }),
    }),
    { name: 'agvc-dairy' }
  )
);
