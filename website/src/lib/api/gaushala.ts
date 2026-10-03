import { api } from './client';

// Verified against backend/app/routers/livestock_gaushala.py + livestock.py (animals/adoptions/donations/byproducts).
//
// QUIRK (do not "fix"): adoptions/donations/byproducts lists return `{data:[...]}` (NOT paged)
// and live under /livestock/gaushala/* in livestock.py with looser role checks, while the
// manager-only console endpoints (profile/cattle/events/expenses/dashboard/analytics/receipts)
// live in livestock_gaushala.py. Query params are camelCase (`gaushalaId`, `pageSize`).

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** ₹ with 2 decimals (paise matter on donations/expenses). */
export function fmtINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Liters to 2 decimals. */
export function fmtL(liters: number): string {
  return liters.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- Profile ----

export interface GaushalaCertifications {
  eightyGRegistered?: boolean;
  [key: string]: unknown;
}

export interface GaushalaBankDetails {
  accountNumber?: string;
  ifsc?: string;
  holderName?: string;
  [key: string]: unknown;
}

export interface GaushalaProfile {
  id: string;
  managerId: string;
  name: string;
  trustName: string;
  address: string;
  district: string;
  phone: string;
  capacity: number;
  certifications: GaushalaCertifications;
  bankDetails: GaushalaBankDetails;
  cowCount: number;
  rating: number;
  createdAt: string;
  updatedAt?: string;
}

export interface GaushalaProfileInput {
  name: string;
  trustName?: string;
  address?: string;
  district?: string;
  phone?: string;
  capacity?: number;
  certifications?: GaushalaCertifications;
  bankDetails?: GaushalaBankDetails;
}

/** 404 GAUSHALA_NOT_FOUND when the manager has no profile yet. */
export async function getMyGaushala(): Promise<GaushalaProfile> {
  const { data } = await api.get<GaushalaProfile>('/livestock/gaushala/mine');
  return data;
}

/** 409 GAUSHALA_EXISTS when a profile already exists. */
export async function createGaushalaProfile(payload: GaushalaProfileInput): Promise<GaushalaProfile> {
  const { data } = await api.post<GaushalaProfile>('/livestock/gaushala/profile', payload);
  return data;
}

export async function updateGaushalaProfile(payload: GaushalaProfileInput): Promise<GaushalaProfile> {
  const { data } = await api.put<GaushalaProfile>('/livestock/gaushala/profile', payload);
  return data;
}

// ---- Dashboard ----

export interface GaushalaDashboard {
  gaushalaId: string;
  headcount: number;
  byCategory: Record<string, number>;
  activeAdoptions: number;
  donationsMonthTotal: number;
  expensesMonthTotal: number;
  capacity: number;
  occupancy: number;
  occupancyPercent: number | null;
}

export async function getGaushalaDashboard(): Promise<GaushalaDashboard> {
  const { data } = await api.get<GaushalaDashboard>('/livestock/gaushala/dashboard');
  return data;
}

// ---- Analytics ----

export interface GaushalaMonthlyStat {
  month: string;
  expenses: number;
  donations: number;
  adoptions: number;
  adoptionAmount: number;
  intakes: number;
}

export interface GaushalaAnalytics {
  month: string;
  monthly: GaushalaMonthlyStat[];
  expenseByCategory: Record<string, number>;
  cattleByStatus: Record<string, number>;
}

export async function getGaushalaAnalytics(month?: string): Promise<GaushalaAnalytics> {
  const { data } = await api.get<GaushalaAnalytics>('/livestock/gaushala/analytics', {
    params: month ? { month } : {},
  });
  return data;
}

// ---- Cattle ----

export type CattleSpecies = 'cow' | 'buffalo' | 'goat';
export type CattleGender = 'female' | 'male';
export type LactationStatus = 'lactating' | 'dry' | 'pregnant' | 'heifer' | 'calf';
export type CattleHealthStatus = 'healthy' | 'under_treatment' | 'quarantined';
export type CattleStatus = 'in-shelter' | 'adopted-out' | 'deceased' | 'transferred';
export type CattleEventType = 'intake' | 'adopted-out' | 'deceased' | 'transferred';

export interface CattleEvent {
  type: CattleEventType;
  note: string;
  date: string;
  at?: string;
}

/** POST /livestock/animals body (AnimalIn) — gaushalaId routes the animal into the shelter. */
export interface AnimalInput {
  tagId: string;
  name: string;
  species: CattleSpecies;
  breed: string;
  gender: CattleGender;
  ageMonths: number;
  lactationStatus: LactationStatus;
  lactationCycle?: number;
  dailyYieldLiters?: number;
  sire?: string;
  dam?: string;
  healthStatus: CattleHealthStatus;
  photoUrl?: string;
  gaushalaId?: string;
}

export interface Animal {
  id: string;
  tagId: string;
  name: string;
  species: string;
  breed: string;
  gender: string;
  ageMonths: number;
  lactationStatus: string;
  lactationCycle: number;
  dailyYieldLiters: number;
  sire: string;
  dam: string;
  healthStatus: string;
  ownerType: string;
  ownerId: string;
  ownerName: string;
  photoUrl: string;
  gaushalaId: string;
  cattleStatus: CattleStatus | string;
  events: CattleEvent[];
  createdAt: string;
}

/** Own-gaushala cattle, newest first; 404 GAUSHALA_NOT_FOUND without a profile. */
export async function listGaushalaCattle(params: {
  category?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<Paged<Animal>> {
  const { data } = await api.get<Paged<Animal>>('/livestock/gaushala/cattle', {
    params: {
      ...(params.category ? { category: params.category } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });
  return data;
}

/**
 * Register a new animal. Passing gaushalaId (from GET /livestock/gaushala/mine) makes it a
 * shelter intake: 201 with cattleStatus "in-shelter" + an intake event.
 * 404 GAUSHALA_NOT_FOUND when the gaushalaId is not managed by the caller.
 */
export async function createAnimal(payload: AnimalInput): Promise<Animal> {
  const { data } = await api.post<Animal>('/livestock/animals', payload);
  return data;
}

export interface CattleEventInput {
  type: CattleEventType;
  note?: string;
  date?: string;
}

/** Appends an event and maps it onto cattleStatus (intake→in-shelter etc.). 404 CATTLE_NOT_FOUND. */
export async function addCattleEvent(animalId: string, payload: CattleEventInput): Promise<Animal> {
  const { data } = await api.post<Animal>(`/livestock/gaushala/cattle/${animalId}/events`, payload);
  return data;
}

// ---- Adoptions ----

export type AdoptionTier = 'gau_gras' | 'gau_seva' | 'purna_dattak' | 'lifetime';
export type AdoptionBillingCycle = 'monthly' | 'annual' | 'one_time';
export type AdoptionStatus = 'active' | 'approved' | 'rejected' | 'completed';

export interface CowAdoption {
  id: string;
  gaushalaId: string;
  gaushalaName: string;
  cowTagId: string;
  cowName: string;
  donorId: string;
  donorName: string;
  donorPhone: string;
  donorCity: string;
  tier: AdoptionTier | string;
  amountInr: number;
  billingCycle: string;
  startDate: string;
  endDate: string;
  status: AdoptionStatus | string;
  certificateNumber: string;
  createdAt: string;
}

export interface CowAdoptionInput {
  gaushalaId: string;
  cowTagId: string;
  cowName: string;
  donorName: string;
  donorPhone: string;
  donorCity?: string;
  tier: AdoptionTier;
  amountInr: number;
  billingCycle: AdoptionBillingCycle;
}

/** {data:[...]} — NOT paged; newest first. */
export async function listGaushalaAdoptions(gaushalaId: string): Promise<CowAdoption[]> {
  const { data } = await api.get<{ data: CowAdoption[] }>('/livestock/gaushala/adoptions', {
    params: { gaushalaId },
  });
  return data.data;
}

/** Record an offline adoption; status starts "active". */
export async function createAdoption(payload: CowAdoptionInput): Promise<CowAdoption> {
  const { data } = await api.post<CowAdoption>('/livestock/gaushala/adoptions', payload);
  return data;
}

export interface GaushalaReceipt {
  id: string;
  kind: 'adoption' | 'donation' | string;
  refId: string;
  personName: string;
  amount: number;
  panNumber: string;
  eightyGEligible: boolean;
  certificateNumber: string;
  certificateUrl: string;
  issuedBy: string;
  gaushalaId: string;
  gaushalaName: string;
  issuedAt: string;
}

export interface AdoptionStatusResponse {
  adoption: CowAdoption;
  /** Present only when status === "approved" (80G certificate issued). */
  receipt: GaushalaReceipt | null;
}

/** active→approved|rejected, approved→completed|rejected; anything else 409 INVALID_TRANSITION. */
export async function updateAdoptionStatus(
  adoptionId: string,
  status: 'approved' | 'rejected' | 'completed'
): Promise<AdoptionStatusResponse> {
  const { data } = await api.put<AdoptionStatusResponse>(
    `/livestock/gaushala/adoptions/${adoptionId}/status`,
    { status }
  );
  return data;
}

// ---- Donations ----

export type DonationType = 'green_fodder' | 'dry_fodder' | 'mineral_mixture' | 'cash_seva';
export type DonationStatus = 'received' | 'acknowledged' | 'rejected';

export interface FodderDonation {
  id: string;
  gaushalaId: string;
  donorId: string;
  donorName: string;
  donorPhone: string;
  donationType: DonationType | string;
  quantityDescription: string;
  amountInr: number;
  receiptNumber: string;
  /** ABSENT until acted on — treat missing as "received". */
  status?: DonationStatus | string;
  createdAt: string;
}

export interface FodderDonationInput {
  gaushalaId: string;
  donorName: string;
  donorPhone?: string;
  donationType: DonationType;
  quantityDescription?: string;
  amountInr: number;
}

/** {data:[...]} — NOT paged; newest first. */
export async function listGaushalaDonations(gaushalaId: string): Promise<FodderDonation[]> {
  const { data } = await api.get<{ data: FodderDonation[] }>('/livestock/gaushala/donations', {
    params: { gaushalaId },
  });
  return data.data;
}

/** Record an offline donation; no 80G receipt until acknowledged. */
export async function createDonation(payload: FodderDonationInput): Promise<FodderDonation> {
  const { data } = await api.post<FodderDonation>('/livestock/gaushala/donations', payload);
  return data;
}

export interface DonationStatusResponse {
  donation: FodderDonation;
  /** Present only when status === "acknowledged" (80G receipt issued). */
  receipt: GaushalaReceipt | null;
}

export async function updateDonationStatus(
  donationId: string,
  status: 'acknowledged' | 'rejected'
): Promise<DonationStatusResponse> {
  const { data } = await api.put<DonationStatusResponse>(
    `/livestock/gaushala/donations/${donationId}/status`,
    { status }
  );
  return data;
}

// ---- Expenses ----

export type GaushalaExpenseCategory =
  | 'fodder'
  | 'medical'
  | 'staff'
  | 'utilities'
  | 'transport'
  | 'other';

export interface GaushalaExpense {
  id: string;
  gaushalaId: string;
  category: GaushalaExpenseCategory | string;
  amount: number;
  note: string;
  expenseDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GaushalaExpenseInput {
  category: GaushalaExpenseCategory;
  amount: number;
  note?: string;
  expenseDate: string;
}

export async function listGaushalaExpenses(params: {
  month?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<Paged<GaushalaExpense>> {
  const { data } = await api.get<Paged<GaushalaExpense>>('/livestock/gaushala/expenses', {
    params: {
      ...(params.month ? { month: params.month } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });
  return data;
}

export async function createGaushalaExpense(payload: GaushalaExpenseInput): Promise<GaushalaExpense> {
  const { data } = await api.post<GaushalaExpense>('/livestock/gaushala/expenses', payload);
  return data;
}

export async function updateGaushalaExpense(
  expenseId: string,
  payload: GaushalaExpenseInput
): Promise<GaushalaExpense> {
  const { data } = await api.put<GaushalaExpense>(`/livestock/gaushala/expenses/${expenseId}`, payload);
  return data;
}

/** Hard delete — backend returns {success:true}. */
export async function deleteGaushalaExpense(expenseId: string): Promise<{ success: boolean }> {
  const { data } = await api.delete<{ success: boolean }>(`/livestock/gaushala/expenses/${expenseId}`);
  return data;
}

export interface GaushalaExpenseSummary {
  month: string;
  total: number;
  count: number;
  byCategory: Record<string, number>;
}

export async function getGaushalaExpenseSummary(month?: string): Promise<GaushalaExpenseSummary> {
  const { data } = await api.get<GaushalaExpenseSummary>('/livestock/gaushala/expenses/summary', {
    params: month ? { month } : {},
  });
  return data;
}

// ---- Byproducts (Panchagavya) ----

export type PanchagavyaCategory =
  | 'compost'
  | 'dung_cakes'
  | 'gomutra_ark'
  | 'panchagavya_tonic'
  | 'ghee'
  | 'dhoop';

export interface PanchagavyaProduct {
  id: string;
  gaushalaId: string;
  title: string;
  vernacularTitle: string;
  category: PanchagavyaCategory | string;
  price: number;
  unit: string;
  inStock: boolean;
  stockQuantity: number;
  description: string;
  imageUrl: string;
  createdAt: string;
}

export interface PanchagavyaProductInput {
  gaushalaId?: string;
  title: string;
  vernacularTitle?: string;
  category: PanchagavyaCategory;
  price: number;
  unit?: string;
  stockQuantity?: number;
  description?: string;
  imageUrl?: string;
}

export async function listGaushalaByproducts(category?: string): Promise<PanchagavyaProduct[]> {
  const { data } = await api.get<{ data: PanchagavyaProduct[] }>('/livestock/gaushala/byproducts', {
    params: category ? { category } : {},
  });
  return data.data;
}

export async function createGaushalaByproduct(
  payload: PanchagavyaProductInput
): Promise<PanchagavyaProduct> {
  const { data } = await api.post<PanchagavyaProduct>('/livestock/gaushala/byproducts', payload);
  return data;
}

// ---- Receipts ----

export async function listGaushalaReceipts(params: { page?: number; pageSize?: number } = {}): Promise<
  Paged<GaushalaReceipt>
> {
  const { data } = await api.get<Paged<GaushalaReceipt>>('/livestock/gaushala/receipts', {
    params: {
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });
  return data;
}
