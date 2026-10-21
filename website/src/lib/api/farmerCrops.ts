import { patch, readList } from './http';

/** Farmer crop cycles (sowing intents + confirmed plans) — user-scoped. */
export const farmerCrops = {
  /** GET /farmer/crops — the caller's crop cycles, newest first. */
  list: (): Promise<unknown[]> => readList<unknown[]>('/farmer/crops'),

  /** PATCH /farmer/crops/{id} — update stage/status/notes on own cycle. */
  update: (cycleId: string, body: Record<string, unknown>): Promise<unknown> =>
    patch<unknown>(`/farmer/crops/${cycleId}`, body),
};
