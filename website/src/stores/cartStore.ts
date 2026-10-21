import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MallProduct, CartItem } from '../types';

/** A FarmGate produce-cart line (multi-farmer `/customer/cart/checkout`). */
export interface ProduceLotLine {
  kind: 'lot';
  lotId: string;
  farmerId: string;
  farmerName: string;
  crop: string;
  grade: string;
  /** Quintals the buyer wants. */
  qtyQuintals: number;
  /** What the lot still offers — used to clamp qty edits. */
  availableQuintals: number;
  /** Per-quintal price in paisa. */
  pricePaisa: number;
  logisticsMode: 'farmer_delivery' | 'customer_pickup' | 'platform_transport';
  harvestDate?: string;
}

export type ProduceLogisticsMode = ProduceLotLine['logisticsMode'];

interface CartState {
  items: CartItem[];
  produceLines: ProduceLotLine[];
  addItem: (product: MallProduct, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, quantity: number) => void;
  addProduceLine: (line: Omit<ProduceLotLine, 'kind'>, quantity?: number) => void;
  updateProduceQty: (lotId: string, qtyQuintals: number) => void;
  updateProduceLogistics: (lotId: string, logisticsMode: ProduceLogisticsMode) => void;
  removeProduceLine: (lotId: string) => void;
  clearProduceCart: () => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getProduceLineCount: () => number;
  getProduceSubtotalPaisa: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      produceLines: [],

      addItem: (product, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((item) => item.product.id === product.id);
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.product.id === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            };
          }
          return {
            items: [...state.items, { product, quantity }],
          };
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.product.id !== productId),
        }));
      },

      updateQty: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item
          ),
        }));
      },

      addProduceLine: (line, quantity) => {
        const qty = quantity ?? line.qtyQuintals;
        if (qty <= 0) return;
        set((state) => {
          const existing = state.produceLines.find((l) => l.lotId === line.lotId);
          if (existing) {
            return {
              produceLines: state.produceLines.map((l) =>
                l.lotId === line.lotId
                  ? {
                      ...l,
                      qtyQuintals: Math.min(l.availableQuintals, l.qtyQuintals + qty),
                      logisticsMode: line.logisticsMode,
                    }
                  : l
              ),
            };
          }
          return {
            produceLines: [
              ...state.produceLines,
              { ...line, kind: 'lot' as const, qtyQuintals: Math.min(line.availableQuintals, qty) },
            ],
          };
        });
      },

      updateProduceQty: (lotId, qtyQuintals) => {
        if (qtyQuintals <= 0) {
          get().removeProduceLine(lotId);
          return;
        }
        set((state) => ({
          produceLines: state.produceLines.map((l) =>
            l.lotId === lotId
              ? { ...l, qtyQuintals: Math.min(l.availableQuintals, qtyQuintals) }
              : l
          ),
        }));
      },

      updateProduceLogistics: (lotId, logisticsMode) => {
        set((state) => ({
          produceLines: state.produceLines.map((l) =>
            l.lotId === lotId ? { ...l, logisticsMode } : l
          ),
        }));
      },

      removeProduceLine: (lotId) => {
        set((state) => ({
          produceLines: state.produceLines.filter((l) => l.lotId !== lotId),
        }));
      },

      clearProduceCart: () => set({ produceLines: [] }),

      clearCart: () => set({ items: [] }),

      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      },

      getProduceLineCount: () => get().produceLines.length,

      getProduceSubtotalPaisa: () => {
        return get().produceLines.reduce((sum, l) => {
          const unit = Math.round(l.pricePaisa * l.qtyQuintals);
          return sum + unit;
        }, 0);
      },
    }),
    { name: 'agrovercity-cart' }
  )
);
