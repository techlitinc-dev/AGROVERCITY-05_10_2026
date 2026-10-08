import { api } from './client';

/**
 * Women Farmer Hub wrappers — mirrors `backend/app/routers/women.py` one-to-one.
 * All data is read from real Firestore collections (`shg_groups`,
 * `shg_meetings`, `garden_plans`, `home_enterprises`); the livestock tab joins
 * the herd registry (`/v1/livestock/animals`).
 *
 * Backend quirks (verified against backend/app/routers/women.py):
 * - SHG + home-enterprise routes require the `farmer` role (403
 *   `FORBIDDEN_ROLE`); garden plans + backyard livestock accept any signed-in
 *   user.
 * - Money is integer paisa everywhere (`corpusPaisa`, `amountPaisa`,
 *   `monthlyProfitPaisa`).
 * - `GET /women/shg` answers `{group: null, deposits: [], meetings: []}` when
 *   the farmer has no SHG group — render the honest empty state, never
 *   invented figures.
 * - A duplicate deposit month answers 409 `DUPLICATE_DEPOSIT_MONTH`.
 * - `listings` publishes into the WS-03 marketplace catalog.
 * - `Idempotency-Key` is added automatically by `client.ts` on writes.
 */

export interface ShgMember {
  memberUid: string;
  name?: string;
  role?: string;
}

export interface ShgGroup {
  id: string;
  name: string;
  memberUid: string;
  memberCount: number;
  corpusPaisa: number;
  loanFundPaisa: number;
  monthlyDepositPaisa: number;
  members: ShgMember[];
}

export interface ShgDeposit {
  id: string;
  month: string;
  amountPaisa: number;
  depositedAt: string;
}

export interface ShgAttendance {
  memberUid: string;
  present: boolean;
  markedAt?: string;
}

export interface ShgCollection {
  id: string;
  memberUid: string;
  amountPaisa: number;
  recordedAt: string;
}

export interface ShgMeeting {
  id: string;
  groupId: string;
  date: string;
  agenda: string;
  attendance: ShgAttendance[];
  collections: ShgCollection[];
}

export interface ShgOverview {
  group: ShgGroup | null;
  deposits: ShgDeposit[];
  meetings: ShgMeeting[];
  readiness: ShgReadiness | null;
}

/** M26 (phase-08 WS-01) — explainable readiness card factors (all 0–1). */
export interface ShgReadinessFactors {
  savings_regularity: number;
  meeting_attendance: number;
  enterprise_income: number;
  record_keeping: number;
}

export interface ShgReadiness {
  available: boolean;
  shgId: string;
  readiness: number;
  gap: string;
  factors: ShgReadinessFactors;
  suggestedNextStep: { en: string; hi: string };
  loanMarketplaceLink: { enabled: boolean; deepLink: string; copy: { en: string; hi: string } } | null;
  decisionId: string;
  confidence: number;
  source: string;
}

export async function shgOverview(): Promise<ShgOverview> {
  const { data } = await api.get<ShgOverview>('/women/shg');
  return data;
}

/** M26 readiness card (returned inside `shgOverview`; fetched here on demand). */
export async function getShgReadiness(): Promise<ShgReadiness | null> {
  const { data } = await api.get<ShgOverview>('/women/shg');
  return data.readiness;
}

export async function createShgGroup(input: {
  name: string;
  memberCount?: number;
  monthlyDepositPaisa?: number;
}): Promise<ShgGroup> {
  const { data } = await api.post<ShgGroup>('/women/shg', input);
  return data;
}

export async function shgDeposit(input: {
  amountPaisa: number;
  month: string;
}): Promise<{ depositedPaisa: number; newCorpusPaisa: number }> {
  const { data } = await api.post<{ depositedPaisa: number; newCorpusPaisa: number }>(
    '/women/shg/deposit',
    input
  );
  return data;
}

export async function listShgMeetings(): Promise<{ data: ShgMeeting[] }> {
  const { data } = await api.get<{ data: ShgMeeting[] }>('/women/shg/meetings');
  return data;
}

export async function createShgMeeting(input: {
  date: string;
  agenda: string;
}): Promise<ShgMeeting> {
  const { data } = await api.post<ShgMeeting>('/women/shg/meetings', input);
  return data;
}

export async function markAttendance(
  meetingId: string,
  input: { memberUid: string; present: boolean }
): Promise<ShgMeeting> {
  const { data } = await api.post<ShgMeeting>(
    `/women/shg/meetings/${meetingId}/attendance`,
    input
  );
  return data;
}

export async function recordShgCollection(
  meetingId: string,
  input: { memberUid: string; amountPaisa: number }
): Promise<{ entry: ShgCollection; newCorpusPaisa: number }> {
  const { data } = await api.post<{ entry: ShgCollection; newCorpusPaisa: number }>(
    `/women/shg/meetings/${meetingId}/collections`,
    input
  );
  return data;
}

export interface GardenItem {
  name: string;
  vernacularName?: string;
  nutrition?: string;
  companion?: string;
  daysToHarvest?: number;
}

export interface GardenPlan {
  id: string;
  category: string;
  template?: boolean;
  ownerUid?: string;
  order?: number;
  items: GardenItem[];
}

export async function listGardenPlans(): Promise<{ data: GardenPlan[] }> {
  const { data } = await api.get<{ data: GardenPlan[] }>('/women/garden-plans');
  return data;
}

export async function createGardenPlan(input: {
  category: string;
  items: GardenItem[];
}): Promise<GardenPlan> {
  const { data } = await api.post<GardenPlan>('/women/garden-plans', input);
  return data;
}

export async function updateGardenPlan(
  planId: string,
  input: { category: string; items: GardenItem[] }
): Promise<GardenPlan> {
  const { data } = await api.put<GardenPlan>(`/women/garden-plans/${planId}`, input);
  return data;
}

export interface EnterpriseLine {
  id: string;
  ownerUid: string;
  product: string;
  monthlyProfitPaisa: number;
}

export interface EnterpriseSummary {
  lines: EnterpriseLine[];
  totalMonthlyProfitPaisa: number;
}

export async function homeEnterprise(): Promise<EnterpriseSummary> {
  const { data } = await api.get<EnterpriseSummary>('/women/home-enterprise');
  return data;
}

export async function createEnterpriseLine(input: {
  product: string;
  monthlyProfitPaisa: number;
}): Promise<EnterpriseLine> {
  const { data } = await api.post<EnterpriseLine>('/women/home-enterprise', input);
  return data;
}

export interface ListingInput {
  title: string;
  category: string;
  brand?: string;
  vernacularTitle?: string;
  description?: string;
  /** Rupees (marketplace products store rupees, not paisa). */
  mrp: number;
  discountedPrice: number;
  stock?: number;
  unit?: string;
  imageUrl?: string;
}

export async function publishEnterpriseListing(input: ListingInput): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>('/women/home-enterprise/listings', input);
  return data;
}

export interface HerdRow {
  id: string;
  tagId: string;
  animal: string;
  name: string;
  vernacularName: string;
  count: number;
  yieldLabel: string;
  vaccine: string;
  vaccineDue: string;
  healthStatus: string;
}

export async function backyardLivestock(): Promise<{ data: HerdRow[]; checkedAt: string }> {
  const { data } = await api.get<{ data: HerdRow[]; checkedAt: string }>(
    '/women/backyard-livestock'
  );
  return data;
}
