import { post, readItems, readOne } from './http';

/** A pending rating prompt opened by a completed transaction (WS-03). */
export interface RatingPendingItem {
  id: string;
  rateeUid: string;
  kind: string;
  transactionId: string;
  status: string;
  createdAt?: string;
}

/** A review the caller received (GET /ratings/mine `recent` rows). */
export interface RatingReceivedItem {
  id: string;
  raterName?: string | null;
  rating?: number;
  comment?: string;
  tags?: string[];
  kind?: string;
  createdAt?: string;
  reply?: string | null;
  repliedAt?: string;
}

export interface RatingsMine {
  average?: number | null;
  count?: number;
  trustTier?: string | null;
  recent?: RatingReceivedItem[];
}

/** A raw rating doc the caller authored (GET /ratings/given). */
export interface RatingGivenItem {
  id: string;
  bookingKind?: string;
  bookingId?: string;
  stars?: number;
  comment?: string;
  tags?: string[];
  raterId?: string;
  providerId?: string;
  createdAt?: string;
}

export interface RatingSubmitPayload {
  bookingKind: string;
  bookingId: string;
  stars: number;
  comment?: string;
  tags?: string[];
  targetRole?: 'broker' | 'farmer';
}

/** Ratings namespace — pending ratings, submit, my reputation & replies. */
export const ratings = {
  /** GET /ratings/pending */
  pending: (): Promise<RatingPendingItem[]> => readItems<RatingPendingItem>('/ratings/pending'),

  /** POST /ratings */
  submit: (payload: RatingSubmitPayload): Promise<unknown> => post<unknown>('/ratings', payload),

  /** GET /ratings/mine — average, count, trustTier, recent reviews. */
  mine: (): Promise<RatingsMine> => readOne<RatingsMine>('/ratings/mine'),

  /** GET /ratings/given — ratings the current user left for others. */
  given: (): Promise<RatingGivenItem[]> => readItems<RatingGivenItem>('/ratings/given'),

  /** POST /ratings/{id}/reply — owner reply to a review. */
  reply: (ratingId: string, payload: { reply: string }): Promise<unknown> =>
    post<unknown>(`/ratings/${ratingId}/reply`, payload),
};
