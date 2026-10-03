import { api } from './client';

// Verified against backend/app/routers/livestock.py (animals, yield logs, breeding, vet records, vaccinations).
//
// QUIRKS (do not "fix"):
// - Breeding status advance is a PUT with QUERY PARAMS (?status=…&pregnancyStatus=…),
//   not a JSON body — sending a body shape instead yields 422 from FastAPI.
// - BreedingCycleIn declares heatDate/aiDate/semenStrawId/bullBreed/technicianName as
//   bare `str` (no defaults) → pydantic treats them as required. Always send them,
//   falling back to "" when blank.
// - VetRecordIn.farmerName is required (min_length=1) even though conceptually optional;
//   prefill it from the animal's ownerName.
// - VetRecordIn.prescriptions / symptoms are server-side lists; the UI collects them
//   as comma / one-per-line text and maps them to the list shapes here.

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** ₹ with 2 decimals (paise matter on fees). */
export function fmtINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Liters to 2 decimals. */
export function fmtL(liters: number): string {
  return liters.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- Animals ----

export type AnimalSpecies = 'cow' | 'buffalo' | 'goat';
export type AnimalGender = 'female' | 'male';
export type LactationStatus = 'lactating' | 'dry' | 'pregnant' | 'heifer' | 'calf';
export type HealthStatus = 'healthy' | 'under_treatment' | 'quarantined';
export type OwnerType = 'farmer' | 'gaushala' | 'dairy';

export interface Animal {
  id: string;
  tagId: string;
  name: string;
  species: AnimalSpecies;
  breed: string;
  gender: AnimalGender;
  ageMonths: number;
  lactationStatus: LactationStatus;
  lactationCycle: number;
  dailyYieldLiters: number;
  sire: string;
  dam: string;
  healthStatus: HealthStatus;
  ownerType: OwnerType;
  ownerId: string;
  ownerName: string;
  photoUrl: string;
  gaushalaId: string;
  cattleStatus: string;
  events: unknown[];
  createdAt: string;
}

export interface AnimalInput {
  tagId: string;
  name: string;
  species?: AnimalSpecies;
  breed: string;
  gender?: AnimalGender;
  ageMonths?: number;
  lactationStatus?: LactationStatus;
  lactationCycle?: number;
  dailyYieldLiters?: number;
  sire?: string;
  dam?: string;
  healthStatus?: HealthStatus;
  ownerType?: OwnerType;
  photoUrl?: string;
  gaushalaId?: string;
}

/** 201. There is NO edit endpoint — after creation animals are read-only. */
export async function registerAnimal(payload: AnimalInput): Promise<Animal> {
  const { data } = await api.post<Animal>('/livestock/animals', payload);
  return data;
}

/** Server already scopes to the caller's own animals (+ own-gaushala cattle for dairyManager). */
export async function listAnimals(params: {
  species?: AnimalSpecies;
  ownerType?: OwnerType;
  tagId?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<Paged<Animal>> {
  const { data } = await api.get<Paged<Animal>>('/livestock/animals', { params });
  return data;
}

/** Full doc; 404 ANIMAL_NOT_FOUND. */
export async function getAnimal(animalId: string): Promise<Animal> {
  const { data } = await api.get<Animal>(`/livestock/animals/${animalId}`);
  return data;
}

// ---- Yield logs ----

export type YieldShift = 'morning' | 'evening';

export interface AnimalYieldLog {
  id: string;
  animalId: string;
  tagId: string;
  date: string;
  shift: YieldShift;
  yieldLiters: number;
  fatPercent: number;
  snfPercent: number;
  notes: string;
  loggedAt: string;
}

export interface YieldLogInput {
  date: string;
  shift: YieldShift;
  yieldLiters: number;
  fatPercent?: number;
  snfPercent?: number;
  notes?: string;
}

export async function addYieldLog(animalId: string, payload: YieldLogInput): Promise<AnimalYieldLog> {
  const { data } = await api.post<AnimalYieldLog>(`/livestock/animals/${animalId}/logs`, payload);
  return data;
}

/** Newest date first. */
export async function listYieldLogs(animalId: string): Promise<AnimalYieldLog[]> {
  const { data } = await api.get<{ data: AnimalYieldLog[] }>(`/livestock/animals/${animalId}/logs`);
  return data.data;
}

// ---- Breeding cycles ----

export type BreedingSpecies = 'cow' | 'buffalo';
export type BreedingStatus = 'inseminated' | 'pregnant' | 'calved' | 'failed';

export interface BreedingCycle {
  id: string;
  animalId: string;
  animalTagId: string;
  animalName: string;
  heatDate: string;
  aiDate: string;
  semenStrawId: string;
  bullBreed: string;
  technicianName: string;
  species: BreedingSpecies;
  /** Computed server-side: aiDate + 60 days. */
  pregnancyCheckDueDate: string;
  pregnancyStatus: string;
  /** Computed server-side: aiDate + 280 (cow) / 310 (buffalo) days. */
  expectedCalvingDate: string;
  actualCalvingDate: string;
  calfGender: string;
  status: BreedingStatus;
  notes: string;
  createdAt: string;
}

export interface BreedingCycleInput {
  animalId: string;
  animalTagId: string;
  animalName: string;
  heatDate?: string;
  aiDate: string;
  semenStrawId?: string;
  bullBreed?: string;
  technicianName?: string;
  species?: BreedingSpecies;
  notes?: string;
}

/** 201 → status "inseminated", pregnancyStatus "pending", computed due dates. */
export async function recordBreeding(payload: BreedingCycleInput): Promise<BreedingCycle> {
  const { data } = await api.post<BreedingCycle>('/livestock/breeding', {
    ...payload,
    // Model fields have no defaults — send "" rather than undefined.
    heatDate: payload.heatDate ?? '',
    semenStrawId: payload.semenStrawId ?? '',
    bullBreed: payload.bullBreed ?? '',
    technicianName: payload.technicianName ?? '',
    notes: payload.notes ?? '',
  });
  return data;
}

/** Scope to one animal via animalTagId (exact match server-side). */
export async function listBreedingCycles(params: {
  status?: BreedingStatus;
  animalTagId?: string;
} = {}): Promise<BreedingCycle[]> {
  const query: Record<string, string> = {};
  if (params.status) query.status = params.status;
  if (params.animalTagId) query.animalTagId = params.animalTagId;
  const { data } = await api.get<{ data: BreedingCycle[] }>('/livestock/breeding', { params: query });
  return data.data;
}

export interface BreedingStatusUpdate {
  status: BreedingStatus;
  pregnancyStatus?: string;
  calfGender?: 'female' | 'male';
  actualCalvingDate?: string;
}

/** QUERY PARAMS, not a JSON body. */
export async function updateBreedingStatus(cycleId: string, update: BreedingStatusUpdate): Promise<BreedingCycle> {
  const { data } = await api.put<BreedingCycle>(`/livestock/breeding/${cycleId}/status`, null, {
    params: {
      status: update.status,
      ...(update.pregnancyStatus ? { pregnancyStatus: update.pregnancyStatus } : {}),
      ...(update.calfGender ? { calfGender: update.calfGender } : {}),
      ...(update.actualCalvingDate ? { actualCalvingDate: update.actualCalvingDate } : {}),
    },
  });
  return data;
}

// ---- Vet records ----

export type VetVisitType = 'clinic' | 'farm' | 'teleconsultation';

export interface VetPrescription {
  medicine?: string;
  dosage?: string;
  duration?: string;
  [key: string]: unknown;
}

export interface VetRecord {
  id: string;
  vetId: string;
  vetName: string;
  farmerId: string;
  farmerName: string;
  animalTagId: string;
  animalName: string;
  species: string;
  visitDate: string;
  visitType: VetVisitType;
  temperatureF: number;
  symptoms: string[];
  diagnosis: string;
  clinicalNotes: string;
  prescriptions: VetPrescription[];
  withdrawalPeriodDays: number;
  feeCharged: number;
  createdAt: string;
}

export interface VetRecordInput {
  farmerId?: string;
  farmerName: string;
  animalTagId: string;
  animalName: string;
  species?: string;
  visitDate: string;
  visitType?: VetVisitType;
  temperatureF?: number;
  symptoms?: string[];
  diagnosis: string;
  clinicalNotes?: string;
  prescriptions?: VetPrescription[];
  withdrawalPeriodDays?: number;
  feeCharged?: number;
}

export async function createVetRecord(payload: VetRecordInput): Promise<VetRecord> {
  const { data } = await api.post<VetRecord>('/livestock/vet/records', payload);
  return data;
}

/** Scope to one animal via animalTagId (exact match server-side). */
export async function listVetRecords(params: { animalTagId?: string } = {}): Promise<VetRecord[]> {
  const { data } = await api.get<{ data: VetRecord[] }>('/livestock/vet/records', { params });
  return data.data;
}

// ---- Vaccinations ----

export type VaccineDisease = 'FMD' | 'HS' | 'BQ' | 'Brucellosis' | 'Lumpy_Skin' | 'Deworming';

export interface Vaccination {
  id: string;
  animalTagId: string;
  animalName: string;
  disease: VaccineDisease;
  vaccineName: string;
  batchNumber: string;
  administeredDate: string;
  /** Computed server-side: FMD +180 days, others +365 days. */
  nextDueDate: string;
  administeredBy: string;
  status: string;
  createdAt: string;
}

export interface VaccinationInput {
  animalTagId: string;
  animalName: string;
  disease: VaccineDisease;
  vaccineName: string;
  batchNumber?: string;
  administeredDate: string;
  administeredBy?: string;
}

/** 201 → status "completed" with computed nextDueDate. */
export async function recordVaccination(payload: VaccinationInput): Promise<Vaccination> {
  const { data } = await api.post<Vaccination>('/livestock/vet/vaccinations', payload);
  return data;
}

/** Scope to one animal via animalTagId (exact match server-side). */
export async function listVaccinations(params: { animalTagId?: string } = {}): Promise<Vaccination[]> {
  const { data } = await api.get<{ data: Vaccination[] }>('/livestock/vet/vaccinations', { params });
  return data.data;
}
