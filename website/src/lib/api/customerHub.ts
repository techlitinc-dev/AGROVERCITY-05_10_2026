import { readOne } from './http';

/**
 * Customer hub client (SR 1, SR 23): home breadth sections + AI basket.
 * Reads only.
 */

export interface CustomerProductCard {
  id: string;
  name: string;
  price: number;
  unit?: string;
  category?: string;
  imageUrl?: string;
  rating?: number;
  sellerId?: string;
  reason?: string;
}

export interface CustomerActiveOrder {
  id: string;
  status: string;
  total: number;
  createdAt?: string;
}

export interface CustomerSubscriptionNext {
  id: string;
  label: string;
  nextRunAt?: string;
  frequency?: string;
}

export interface CustomerHomePayload {
  seasonalPicks: CustomerProductCard[];
  activeOrders: CustomerActiveOrder[];
  subscriptionNext: CustomerSubscriptionNext[];
  coinBalance: number;
  followedOffers: CustomerProductCard[];
  unreadNotifications: number;
}

export interface CustomerRecommendationsPayload {
  basket: CustomerProductCard[];
  bestPrice: CustomerProductCard[];
  seasonalAlternatives: CustomerProductCard[];
}

export const customerHub = {
  /** GET /customer/home — seasonal picks, active orders, subscription, coins, follows, notifications. */
  home: (): Promise<CustomerHomePayload> =>
    readOne<CustomerHomePayload>('/customer/home'),

  /** GET /customer/recommendations — AI basket, best-price board, seasonal alternatives. */
  recommendations: (): Promise<CustomerRecommendationsPayload> =>
    readOne<CustomerRecommendationsPayload>('/customer/recommendations'),
};
