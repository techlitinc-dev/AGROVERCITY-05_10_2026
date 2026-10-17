import { post, readList } from './http';

/** Ratings namespace — pending ratings + submit. */
export const ratings = {
  /** GET /ratings/pending */
  pending: (): Promise<unknown[]> => readList<unknown[]>('/ratings/pending'),

  /** POST /ratings */
  submit: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/ratings', payload),
};
