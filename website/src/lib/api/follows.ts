import { apiClient } from './client';
import { handleApiError } from './errors';
import { del, post, unwrapItems } from './http';

/** Follows & mandi favorites (SR 11, SR 32) — /users/{id}/follow, /users/me/follows, /mandi/favorites. */

export interface FollowedUser {
  userId: string;
  name: string;
  persona: string;
  photoUrl?: string;
  rating?: number;
  since: string;
}

export interface MandiFavorite {
  mandiId: string;
  name: string;
  district: string;
  state: string;
  since: string;
}

export const followUser = (userId: string): Promise<void> =>
  post<void>(`/users/${encodeURIComponent(userId)}/follow`);

export const unfollowUser = (userId: string): Promise<void> =>
  del<void>(`/users/${encodeURIComponent(userId)}/follow`);

export const getFollows = async (): Promise<FollowedUser[]> => {
  try {
    const res = await apiClient.get('/users/me/follows');
    return unwrapItems<FollowedUser>(res.data?.data ?? res.data);
  } catch (e) {
    handleApiError(e);
  }
};

export const getMandiFavorites = async (): Promise<MandiFavorite[]> => {
  try {
    const res = await apiClient.get('/mandi/favorites');
    return unwrapItems<MandiFavorite>(res.data?.data ?? res.data);
  } catch (e) {
    handleApiError(e);
  }
};

export const addMandiFavorite = (mandiId: string): Promise<void> =>
  post<void>('/mandi/favorites', { mandiId });

export const removeMandiFavorite = (mandiId: string): Promise<void> =>
  del<void>(`/mandi/favorites/${encodeURIComponent(mandiId)}`);

/** Commodity watchlist — the mandi terminal wishlist (commodity-level). */
export interface CommodityWatchItem {
  commodity: string;
  slug: string;
  group?: string;
  since: string;
}

export const getCommodityWatchlist = async (): Promise<CommodityWatchItem[]> => {
  try {
    const res = await apiClient.get('/mandi/watchlist');
    return unwrapItems<CommodityWatchItem>(res.data?.data ?? res.data);
  } catch (e) {
    handleApiError(e);
  }
};

export const addCommodityWatchlist = (commodity: string, group?: string): Promise<void> =>
  post<void>('/mandi/watchlist', { commodity, group });

export const removeCommodityWatchlist = (slug: string): Promise<void> =>
  del<void>(`/mandi/watchlist/${encodeURIComponent(slug)}`);
