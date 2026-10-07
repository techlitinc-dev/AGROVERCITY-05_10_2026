import { api } from './client';

/**
 * FPO wrappers — mirror `backend/app/routers/fpo.py`.
 *
 * Backend quirks (verified):
 * - Every route requires the `farmer` role.
 * - `/fpo/directory` returns each FPO with the caller's `membership`
 *   (`member` | `pending` | `none`) and the A8 `verification_status`
 *   (`unverified` until the phase-07 admin console verifies it).
 * - A join request is idempotent per (fpo, farmer); the dev-approve route
 *   transitions `pending` → `member` (the real approval is the phase-07 admin
 *   console — this is a dev affordance only).
 * - `/fpo/pools/{id}/join` clamps `bookedUnits` at `targetUnits` and answers
 *   409 `POOL_FULL` once the target is met.
 * - `/fpo/machinery` joins the equipment module's slot data for `ownerType=fpo`
 *   machines over a Monday-starting week (no duplicated slot logic here).
 * - Writes carry `Idempotency-Key` (added by `client.ts`).
 */

export type FpoMembership = 'member' | 'pending' | 'none';

export interface Fpo {
  id: string;
  name: string;
  memberCount: number;
  district: string;
  /** A8 hook — `unverified` until the admin console verifies the FPO. */
  verification_status: string;
  membership: FpoMembership;
}

export async function listFpos(): Promise<Fpo[]> {
  const { data } = await api.get<{ data: Fpo[] }>('/fpo/directory');
  return data.data;
}

export interface JoinRequestResult {
  id: string;
  fpoId: string;
  status: string;
  membership: FpoMembership;
}

export async function requestFpoJoin(fpoId: string): Promise<JoinRequestResult> {
  const { data } = await api.post<JoinRequestResult>(`/fpo/${fpoId}/join-request`);
  return data;
}

/** Dev-only self-approval (phase-07 owns the real verification console). */
export async function approveFpoJoin(fpoId: string): Promise<JoinRequestResult> {
  const { data } = await api.post<JoinRequestResult>(`/fpo/${fpoId}/join-request/approve`);
  return data;
}

export interface FpoPool {
  id: string;
  fpoId: string;
  fpoName: string;
  item: string;
  bookedUnits: number;
  targetUnits: number;
  discountPercent: number;
  deadline: string;
  status: string;
}

export async function listFpoPools(): Promise<FpoPool[]> {
  const { data } = await api.get<{ data: FpoPool[] }>('/fpo/pools');
  return data.data;
}

export async function joinFpoPool(poolId: string, units: number): Promise<FpoPool> {
  const { data } = await api.post<FpoPool>(`/fpo/pools/${poolId}/join`, { units });
  return data;
}

export interface FpoMachinerySlot {
  id: string;
  equipmentId: string;
  date: string;
  slotName: string;
  duration: string;
  status: string;
  bookedByName?: string | null;
  priceRupees: number;
  recommendedTask: string;
}

export interface FpoMachinery {
  equipmentId: string;
  name: string;
  days: Record<string, FpoMachinerySlot[]>;
}

export async function getFpoMachinery(week?: string): Promise<FpoMachinery[]> {
  const { data } = await api.get<{ data: FpoMachinery[] }>('/fpo/machinery', {
    params: week ? { week } : {},
  });
  return data.data;
}
