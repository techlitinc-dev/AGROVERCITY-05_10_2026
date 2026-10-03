import { api } from './client';
import type { Purchase } from './purchases';

/**
 * Market intelligence + price alerts + direct contracts — types & wrappers.
 * LOCKED backend contracts (parallel workstream):
 * - GET  /v1/intelligence?persona=… → IntelligenceResponse (404
 *   INTELLIGENCE_NOT_AVAILABLE for personas the engine does not serve).
 * - GET/POST /v1/price-alerts, DELETE /v1/price-alerts/{id}.
 * - GET  /v1/contracts/mine?role=buyer|farmer&status=… → {data,total}
 *   (envelope has no page/pageSize — intentionally NOT the full Paged shape).
 * - POST /v1/contracts (buyer) · PUT /v1/contracts/{id} (buyer, offered only)
 * - POST /v1/contracts/{id}/cancel|decline {reason?} → {ok,status}
 * - POST /v1/contracts/{id}/accept {signatureData,consentTimestamp,mpin}
 *   → {ok,status,contractId} (pre-existing endpoint, unchanged shape).
 * - POST /v1/contracts/{id}/deliveries {slotDate} → 201 purchase doc;
 *   idempotent replay returns 200 with the SAME purchase doc.
 * - GET  /v1/contracts/{id}/deliveries → ContractDeliveriesResponse.
 */

// ---------- Intelligence ----------

export type IntelligencePersona =
  | 'farmer'
  | 'seller'
  | 'broker'
  | 'directBuyer'
  | 'transport'
  | string;

export interface Kpi {
  key: string;
  labelKey: string;
  value: number | string;
  unit?: string;
  deltaPct?: number;
  /** 'up' | 'down' | anything else (flat/unknown) — drives chip colour. */
  direction?: string;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface Series {
  key: string;
  labelKey: string;
  points: SeriesPoint[];
}

export interface BreakdownItem {
  label: string;
  value: number;
  unit?: string;
}

export interface Breakdown {
  key: string;
  labelKey: string;
  items: BreakdownItem[];
}

export interface Insight {
  severity: 'info' | 'opportunity' | 'warning';
  labelKey: string;
  params?: Record<string, string | number>;
}

export interface IntelligenceResponse {
  persona: string;
  generatedAt: string;
  kpis: Kpi[];
  series: Series[];
  breakdowns: Breakdown[];
  insights: Insight[];
}

export async function getIntelligence(): Promise<IntelligenceResponse> {
  // Persona is read server-side from the caller's activeProfile — no param.
  const { data } = await api.get<IntelligenceResponse>('/intelligence');
  return data;
}

// ---------- Price alerts ----------

export interface PriceAlert {
  id: string;
  crop: string;
  targetPrice: number;
  above: boolean;
  currentModal: number | null;
  fired: boolean;
  createdAt: string;
}

export interface PriceAlertInput {
  crop: string;
  targetPrice: number;
  above: boolean;
}

export async function listPriceAlerts(): Promise<{ data: PriceAlert[] }> {
  const { data } = await api.get<{ data: PriceAlert[] }>('/price-alerts');
  return data;
}

export async function createPriceAlert(input: PriceAlertInput): Promise<PriceAlert> {
  const { data } = await api.post<PriceAlert>('/price-alerts', input);
  return data;
}

export async function deletePriceAlert(alertId: string): Promise<void> {
  await api.delete(`/price-alerts/${alertId}`);
}

// ---------- Contracts ----------

export type ContractRole = 'buyer' | 'farmer';

export type ContractStatus =
  | 'offered'
  | 'active'
  | 'declined'
  | 'cancelled'
  | 'accepted'
  | 'open'
  | 'fulfilled';

export type ContractPriceType = 'fixed' | 'mandiLinked';

export type DeliveryFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface ContractSchedule {
  startDate: string;
  endDate: string;
  frequency: DeliveryFrequency;
  qtyPerDelivery: number;
}

export interface Contract {
  id: string;
  buyerCompany?: string;
  buyerId?: string;
  farmerId?: string;
  crop: string;
  quantityTotal?: number;
  priceType?: ContractPriceType;
  baseRate?: number;
  premiumPerQuintal?: number;
  mandiName?: string;
  schedule?: ContractSchedule;
  deliveryLocation?: string;
  paymentTermsDays?: number;
  termsText?: string;
  status: ContractStatus;
  deliveriesGenerated?: number;
  /** Live mandi-linked price, server-computed; null when unavailable. */
  currentPrice?: number | null;
  acceptedBy?: string;
  createdAt: string;
}

export interface ContractCreateInput {
  farmerId: string;
  crop: string;
  quantityTotal: number;
  priceType: ContractPriceType;
  baseRate?: number;
  premiumPerQuintal?: number;
  mandiName?: string;
  schedule: ContractSchedule;
  deliveryLocation?: string;
  paymentTermsDays?: number;
  termsText?: string;
}

export type ContractUpdateInput = Partial<
  Omit<ContractCreateInput, 'farmerId' | 'crop'>
> & { quantityTotal?: number; crop?: string };

export interface ContractActionResult {
  ok: boolean;
  status: string;
}

export interface ContractAcceptResult {
  ok: boolean;
  status: string;
  contractId: string;
}

export interface ContractDeliveryRow {
  slotDate: string;
  purchaseId: string;
  status: string;
  finalAmount?: number;
}

export interface ContractFulfilment {
  total: number;
  completed: number;
  cancelled: number;
  pending: number;
}

export interface ContractDeliveriesResponse {
  data: ContractDeliveryRow[];
  fulfilment: ContractFulfilment;
}

export async function listContractsMine(
  role: ContractRole,
  status?: ContractStatus
): Promise<{ data: Contract[]; total: number }> {
  const { data } = await api.get<{ data: Contract[]; total: number }>('/contracts/mine', {
    params: { role, ...(status ? { status } : {}) },
  });
  return data;
}

export async function createContract(input: ContractCreateInput): Promise<Contract> {
  const { data } = await api.post<Contract>('/contracts', input);
  return data;
}

export async function updateContract(
  contractId: string,
  input: ContractUpdateInput
): Promise<Contract> {
  const { data } = await api.put<Contract>(`/contracts/${contractId}`, input);
  return data;
}

export async function cancelContract(
  contractId: string,
  reason?: string
): Promise<ContractActionResult> {
  const { data } = await api.post<ContractActionResult>(`/contracts/${contractId}/cancel`, {
    ...(reason ? { reason } : {}),
  });
  return data;
}

export async function declineContract(
  contractId: string,
  reason?: string
): Promise<ContractActionResult> {
  const { data } = await api.post<ContractActionResult>(`/contracts/${contractId}/decline`, {
    ...(reason ? { reason } : {}),
  });
  return data;
}

export async function acceptContract(
  contractId: string,
  input: { signatureData: string; consentTimestamp: string; mpin: string }
): Promise<ContractAcceptResult> {
  const { data } = await api.post<ContractAcceptResult>(
    `/contracts/${contractId}/accept`,
    input
  );
  return data;
}

/** 201 creates the purchase; an idempotent replay answers 200 with the same doc. */
export async function createContractDelivery(
  contractId: string,
  slotDate: string
): Promise<Purchase> {
  const { data } = await api.post<Purchase>(`/contracts/${contractId}/deliveries`, { slotDate });
  return data;
}

export async function listContractDeliveries(
  contractId: string
): Promise<ContractDeliveriesResponse> {
  const { data } = await api.get<ContractDeliveriesResponse>(
    `/contracts/${contractId}/deliveries`
  );
  return data;
}

// ---------- Display helpers ----------

type Translate = (key: string, params?: Record<string, string | number>) => string;

const fmtShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** 'Fixed ₹X/q' or 'Mandi <name> + ₹Y/q' — the price formula chip copy. */
export function contractFormulaLabel(t: Translate, contract: Contract): string {
  if (contract.priceType === 'fixed') {
    return t('ctFormulaFixed', { rate: contract.baseRate ?? 0 });
  }
  return t('ctFormulaMandi', {
    mandi: contract.mandiName ?? '—',
    premium: contract.premiumPerQuintal ?? 0,
  });
}

export function contractFrequencyLabel(t: Translate, frequency: DeliveryFrequency): string {
  if (frequency === 'weekly') return t('ctFreqWeekly');
  if (frequency === 'biweekly') return t('ctFreqBiweekly');
  return t('ctFreqMonthly');
}

/** 'Weekly · 10 q per delivery · 1 Jan to 31 Mar' — one-line schedule summary. */
export function contractScheduleSummary(t: Translate, schedule: ContractSchedule): string {
  return t('ctScheduleSummary', {
    frequency: contractFrequencyLabel(t, schedule.frequency),
    qty: schedule.qtyPerDelivery,
    start: fmtShortDate(schedule.startDate),
    end: fmtShortDate(schedule.endDate),
  });
}

const FREQUENCY_STEP_DAYS: Record<DeliveryFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 28, // approximation — months differ; the buyer picks the exact slot date anyway
};

/**
 * Next upcoming slot for a schedule (first slot date >= today, stepping from
 * startDate by frequency). Returns null when the schedule has ended.
 */
export function nextSlotDate(schedule: ContractSchedule): string | null {
  const start = new Date(schedule.startDate);
  const end = new Date(schedule.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const stepDays = FREQUENCY_STEP_DAYS[schedule.frequency] ?? 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slot = new Date(start);
  slot.setHours(0, 0, 0, 0);
  // Guard against a pathological range looping forever.
  for (let i = 0; i < 1000 && slot < today; i += 1) {
    slot.setDate(slot.getDate() + stepDays);
  }
  if (slot > end) return null;
  return slot.toISOString().slice(0, 10);
}
