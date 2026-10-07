import { api } from './client';

/**
 * Climate & carbon module wrappers — mirror `backend/app/routers/climate.py`.
 *
 * Backend quirks (verified):
 * - Every route requires the `farmer` role (403 `FORBIDDEN_ROLE` otherwise).
 * - Standard error envelope `{ error: { code, message, fieldErrors } }`.
 * - All payloads are read from Firestore (`climate_varieties`, `carbon_factors`)
 *   — no hardcoded data in the response path (global rule 1). Missing factors
 *   yield honest zeros, never invented numbers.
 * - `/climate/carbon-potential` returns an **estimate, not credits**: the UI must
 *   render the `carbonEstimateNotCredits` label next to every number until a
 *   partner MRV integration exists. `plantation_estimate` joins the tree module's
 *   plantations into the same estimate.
 * - `/climate/enrollments` writes a `pending_mrv` enrollment (`mrvPartner: null`
 *   — the partner-MRV placeholder); the write carries `Idempotency-Key`.
 */

export interface CarbonPotential {
  co2eTonnes: number;
  /** Legacy rupee field derived from the paisa value below. */
  annualIncomePotential: number;
  /** Authoritative integer-paisa income potential. */
  annualIncomePotentialPaisa: number;
  practices: string[];
  /** Tonnes CO2e/yr joined from the farmer's tree plantations. */
  plantation_estimate: number;
  estimateOnly: boolean;
}

export async function getCarbonPotential(params?: {
  lat?: number;
  lng?: number;
}): Promise<CarbonPotential> {
  const { data } = await api.get<CarbonPotential>('/climate/carbon-potential', {
    params: params ?? {},
  });
  return data;
}

export interface ResilientVariety {
  id: string;
  variety: string;
  crop: string;
  trait: string;
  source: string;
}

export interface ResilientVarietiesPage {
  data: ResilientVariety[];
  page: number;
  pageSize: number;
  total: number;
}

export async function getResilientVarieties(crop?: string): Promise<ResilientVarietiesPage> {
  const { data } = await api.get<ResilientVarietiesPage>('/climate/resilient-varieties', {
    params: crop ? { crop } : {},
  });
  return data;
}

export type EnrollmentStatus = 'pending_mrv' | string;

export interface CarbonEnrollment {
  id: string;
  farmerId: string;
  plotId: string | null;
  practices: string[];
  status: EnrollmentStatus;
  /** Partner-MRV placeholder — null until a partner integration exists. */
  mrvPartner: string | null;
  createdAt: string;
}

export interface EnrollmentInput {
  plotId?: string;
  practices?: string[];
}

export async function createEnrollment(input: EnrollmentInput): Promise<CarbonEnrollment> {
  const { data } = await api.post<CarbonEnrollment>('/climate/enrollments', input);
  return data;
}

export interface EnrollmentsPage {
  data: CarbonEnrollment[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listMyEnrollments(): Promise<EnrollmentsPage> {
  const { data } = await api.get<EnrollmentsPage>('/climate/enrollments/mine');
  return data;
}

/** Integer paisa → ₹ display (the money convention for this module). */
export function formatPaisa(paisa: number): string {
  return `₹${(paisa / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
