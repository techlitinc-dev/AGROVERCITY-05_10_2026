import { api } from './client';

/**
 * Tree plantation & biofuel wrappers — mirror `backend/app/routers/tree.py`.
 *
 * Backend quirks (verified):
 * - Requires one of `farmer` / `farmLandlord` / `seller` (403 otherwise).
 * - Standard error envelope `{ error: { code, message, fieldErrors } }`.
 * - `/tree/plantations` (201) also emits three recurring tree survival-check
 *   tasks (30/90/180 days) into the phase-01 task engine, deep-linked to
 *   `/dashboard/p/treePlantation`.
 * - `/tree/ngos/{id}/sapling-request` (201) writes the request with status
 *   `pending` — the approval console is phase-07; the write carries
 *   `Idempotency-Key`. `/tree/sapling-requests/mine` lists the caller's requests.
 * - Carbon figures (`/tree/carbon/estimate`, a plantation's `estimatedCo2KgPerYear`)
 *   are estimates — the UI renders the `carbonEstimateNotCredits` label next to
 *   every carbon number.
 */

export interface Plantation {
  id: string;
  farmerId: string;
  farmerName: string;
  parcelName: string;
  treeSpecies: string;
  vernacularSpecies: string;
  treeCount: number;
  plantingDate: string;
  landType: string;
  status: string;
  survivalRate: number;
  currentAvgHeightCm: number;
  estimatedCo2KgPerYear: number;
  logsCount: number;
  createdAt: string;
}

export interface PlantationPage {
  data: Plantation[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listMyPlantations(): Promise<PlantationPage> {
  const { data } = await api.get<PlantationPage>('/tree/plantations/mine');
  return data;
}

export interface PlantationInput {
  parcelName: string;
  treeSpecies: string;
  vernacularSpecies?: string;
  treeCount: number;
  plantingDate: string;
  landType?: string;
  latitude: number;
  longitude: number;
  initialHeightCm?: number;
  irrigationType?: string;
}

export async function registerPlantation(input: PlantationInput): Promise<Plantation> {
  const { data } = await api.post<Plantation>('/tree/plantations', input);
  return data;
}

export interface Ngo {
  id: string;
  name: string;
  focusArea: string;
  location: string;
  treesPlantedCount: number;
  rating: number;
  providesFreeSaplings: boolean;
}

export interface NgoPage {
  data: Ngo[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listNgos(): Promise<NgoPage> {
  const { data } = await api.get<NgoPage>('/tree/ngos');
  return data;
}

export type SaplingType = 'timber' | 'biofuel' | 'fruit' | 'bamboo';

export interface SaplingRequestInput {
  treeType: SaplingType;
  count: number;
}

export interface SaplingRequestResult {
  requestId: string;
  ngoId: string;
  treeType: string;
  count: number;
  status: string;
}

export async function requestSaplings(
  ngoId: string,
  input: SaplingRequestInput
): Promise<SaplingRequestResult> {
  const { data } = await api.post<SaplingRequestResult>(
    `/tree/ngos/${ngoId}/sapling-request`,
    input
  );
  return data;
}

export interface SaplingRequest {
  id: string;
  ngoId: string;
  ngoName: string;
  treeType: string;
  count: number;
  status: string;
  createdAt: string;
}

export interface SaplingRequestsPage {
  data: SaplingRequest[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listMySaplingRequests(): Promise<SaplingRequestsPage> {
  const { data } = await api.get<SaplingRequestsPage>('/tree/sapling-requests/mine');
  return data;
}

export interface BiofuelTree {
  id: string;
  name: string;
  botanicalName: string;
  oilContentPercent: string;
  gestationPeriod: string;
  expectedReturnPerAcre: string;
  suitability: string;
  uses: string;
  buyerMarket: string;
  subsidyScheme: string;
}

export interface BiofuelPage {
  data: BiofuelTree[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listBiofuel(): Promise<BiofuelPage> {
  const { data } = await api.get<BiofuelPage>('/tree/biofuel');
  return data;
}

export interface CareGuide {
  id: string;
  title: string;
  stepNumber: number;
  stage: string;
  instructions: string;
  wateringRule: string;
  fertilizerSchedule: string;
  pestProtection: string;
}

export interface CareGuidesPage {
  data: CareGuide[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listCareGuides(): Promise<CareGuidesPage> {
  const { data } = await api.get<CareGuidesPage>('/tree/care-guides');
  return data;
}
