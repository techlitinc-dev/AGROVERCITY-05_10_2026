import { api } from './client';

/** Rating prompts + submissions (WS-03 X8). */

export interface RatingPrompt {
  id: string;
  rateeUid: string;
  kind: string;
  transactionId: string;
  status: string;
  createdAt: string;
}

export async function getPendingRatings(): Promise<RatingPrompt[]> {
  const { data } = await api.get<{ data: RatingPrompt[]; total: number }>('/ratings/pending');
  return data.data ?? [];
}

export async function submitRating(payload: {
  bookingKind: string;
  bookingId: string;
  stars: number;
  comment?: string;
}): Promise<unknown> {
  const { data } = await api.post('/ratings', payload);
  return data;
}
