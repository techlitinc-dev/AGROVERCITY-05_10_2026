import { create } from 'zustand';
import {
  getCommissions,
  listDeals,
  listLeads,
  type CommissionsSummary,
  type Deal,
  type Lead,
} from '../lib/api/broker';

/**
 * Broker data cache — cross-page reuse for brokerHome ↔ deals/leads/commissions.
 * Pages keep their own local loading state (house convention); this store only
 * memoizes the last good payload per slice. No persist — deals go stale fast.
 */
interface BrokerState {
  deals: Deal[] | null;
  leads: Lead[] | null;
  commissions: CommissionsSummary | null;
  refreshDeals: () => Promise<Deal[]>;
  refreshLeads: () => Promise<Lead[]>;
  refreshCommissions: () => Promise<CommissionsSummary>;
}

export const useBrokerStore = create<BrokerState>()((set) => ({
  deals: null,
  leads: null,
  commissions: null,
  refreshDeals: async () => {
    const res = await listDeals({ page: 1, pageSize: 100 });
    set({ deals: res.data });
    return res.data;
  },
  refreshLeads: async () => {
    const res = await listLeads();
    set({ leads: res.data });
    return res.data;
  },
  refreshCommissions: async () => {
    const summary = await getCommissions();
    set({ commissions: summary });
    return summary;
  },
}));
