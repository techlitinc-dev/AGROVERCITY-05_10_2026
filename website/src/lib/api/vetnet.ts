import { api } from './client';

// Verified against backend/app/routers/livestock_vets.py.
//
// QUIRK (do not "fix"): the prescriptions list returns a flat `{ data, total }`
// envelope (NOT the paged `{ data, page, pageSize, total }` shape every other
// list here returns). Completing an appointment with an inline prescription
// auto-creates the prescriptions doc server-side (livestock_vets.py:424-433).

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

// ---- Managed vets (dairyManager directory) ----

export interface ManagedVet {
  id: string;
  name: string;
  phone: string;
  qualification: string;
  specializations: string[];
  clinicAddress: string;
  experienceYears: number;
  feeClinic: number;
  feeFarm: number;
  feeTele: number;
  visitTypes: string[];
  serviceDistricts: string[];
  languages: string[];
  vetCouncilRegNo: string;
  emergencyAvailable: boolean;
  availableForFarmVisit: boolean;
  /** True when a real vet claimed this profile via phone (livestock_vets.py:121). */
  claimed: boolean;
  /** WS-06: credential verification — "pending" for records predating the flag. */
  credentialStatus: 'pending' | 'verified' | 'rejected';
  credentialDocs: string[];
  ratingAvg: number | null;
  ratingCount: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt?: string;
}

export interface ManagedVetInput {
  name: string;
  phone: string;
  qualification?: string;
  specializations?: string[];
  clinicAddress?: string;
  experienceYears?: number;
  feeClinic?: number;
  feeFarm?: number;
  feeTele?: number;
  visitTypes?: string[];
  serviceDistricts?: string[];
  languages?: string[];
  vetCouncilRegNo?: string;
  emergencyAvailable?: boolean;
  availableForFarmVisit?: boolean;
}

export async function listManagedVets(params: { page?: number; pageSize?: number } = {}): Promise<Paged<ManagedVet>> {
  const { data } = await api.get<Paged<ManagedVet>>('/livestock/vets/managed', { params });
  return data;
}

export async function createManagedVet(payload: ManagedVetInput): Promise<ManagedVet> {
  const { data } = await api.post<ManagedVet>('/livestock/vets/managed', payload);
  return data;
}

export async function updateManagedVet(vetId: string, payload: ManagedVetInput): Promise<ManagedVet> {
  const { data } = await api.put<ManagedVet>(`/livestock/vets/managed/${vetId}`, payload);
  return data;
}

/** Soft delete — backend sets status: "inactive". */
export async function deactivateManagedVet(vetId: string): Promise<ManagedVet> {
  const { data } = await api.delete<ManagedVet>(`/livestock/vets/managed/${vetId}`);
  return data;
}

// ---- Appointments ----

export type VisitType = 'clinic' | 'farm' | 'tele';
export type AppointmentStatus = 'requested' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';

/** Server state machine (livestock_vets.py:25-29): vet-side transitions only. */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['in-progress', 'cancelled'],
  'in-progress': ['completed'],
  completed: [],
  cancelled: [],
};

export interface Appointment {
  id: string;
  vetId: string;
  vetName: string;
  farmerUid: string;
  farmerName: string;
  animalId: string;
  visitType: VisitType;
  slotDate: string;
  slotTime: string;
  symptoms: string;
  address: string;
  fee: number;
  status: AppointmentStatus;
  vetNotes?: string;
  cancelReason?: string;
  prescriptionId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentInput {
  vetId: string;
  animalId?: string;
  visitType?: VisitType;
  slotDate: string;
  slotTime: string;
  symptoms?: string;
  address?: string;
  fee?: number;
}

export interface MedicineInput {
  name: string;
  dosage?: string;
  frequency?: string;
  durationDays?: number;
  notes?: string;
}

export interface PrescriptionPayload {
  diagnosis: string;
  medicines?: MedicineInput[];
  advice?: string;
  milkWithdrawalDays?: number;
  followUpDate?: string;
}

export interface AppointmentStatusInput {
  status: 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
  vetNotes?: string;
  prescription?: PrescriptionPayload;
  cancelReason?: string;
}

export async function listAppointments(params: {
  status?: AppointmentStatus;
  date?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<Paged<Appointment>> {
  const { data } = await api.get<Paged<Appointment>>('/livestock/appointments', {
    params: { ...(params.status ? { status: params.status } : {}), ...(params.date ? { date: params.date } : {}) },
  });
  return data;
}

export async function createAppointment(payload: AppointmentInput): Promise<Appointment> {
  const { data } = await api.post<Appointment>('/livestock/appointments', payload);
  return data;
}

export async function updateAppointmentStatus(
  appointmentId: string,
  payload: AppointmentStatusInput
): Promise<Appointment> {
  const { data } = await api.post<Appointment>(`/livestock/appointments/${appointmentId}/status`, payload);
  return data;
}

// ---- Prescriptions ----

export interface Medicine extends MedicineInput {
  dosage: string;
  frequency: string;
  durationDays: number;
  notes: string;
}

export interface Prescription {
  id: string;
  appointmentId: string;
  vetId: string;
  animalId: string;
  farmerUid: string;
  diagnosis: string;
  medicines: Medicine[];
  advice: string;
  milkWithdrawalDays: number;
  followUpDate: string;
  createdAt: string;
}

export interface PrescriptionInput {
  animalId: string;
  appointmentId?: string;
  diagnosis: string;
  medicines?: MedicineInput[];
  advice?: string;
  milkWithdrawalDays?: number;
  followUpDate?: string;
}

export interface PrescriptionList {
  data: Prescription[];
  total: number;
}

export async function listPrescriptions(params: { animalId?: string } = {}): Promise<PrescriptionList> {
  const { data } = await api.get<PrescriptionList>('/livestock/prescriptions', {
    params: params.animalId ? { animalId: params.animalId } : {},
  });
  return data;
}

export async function createPrescription(payload: PrescriptionInput): Promise<Prescription> {
  const { data } = await api.post<Prescription>('/livestock/prescriptions', payload);
  return data;
}

// ---- Vaccination campaigns ----

export type CampaignStatus = 'upcoming' | 'active' | 'closed';

export interface Campaign {
  id: string;
  title: string;
  vaccine: string;
  disease: string;
  fromDate: string;
  toDate: string;
  targetDistricts: string[];
  organizerId: string;
  status: CampaignStatus;
  createdAt: string;
}

export interface CampaignInput {
  title: string;
  vaccine: string;
  disease?: string;
  fromDate: string;
  toDate: string;
  targetDistricts?: string[];
  status?: CampaignStatus;
}

export type EnrollmentStatus = 'enrolled' | 'vaccinated';

export interface CampaignEnrollment {
  id: string;
  campaignId: string;
  animalId: string;
  farmerUid: string;
  status: EnrollmentStatus;
  vaccinatedAt: string;
  createdAt: string;
}

export interface CampaignDetail extends Campaign {
  enrollments: CampaignEnrollment[];
  enrollmentCount: number;
}

export async function listCampaigns(params: {
  status?: CampaignStatus;
  page?: number;
  pageSize?: number;
} = {}): Promise<Paged<Campaign>> {
  const { data } = await api.get<Paged<Campaign>>('/livestock/vet/campaigns', {
    params: params.status ? { status: params.status } : {},
  });
  return data;
}

export async function createCampaign(payload: CampaignInput): Promise<Campaign> {
  const { data } = await api.post<Campaign>('/livestock/vet/campaigns', payload);
  return data;
}

export async function getCampaign(campaignId: string): Promise<CampaignDetail> {
  const { data } = await api.get<CampaignDetail>(`/livestock/vet/campaigns/${campaignId}`);
  return data;
}

export async function enrollCampaign(campaignId: string, animalId: string): Promise<CampaignEnrollment> {
  const { data } = await api.post<CampaignEnrollment>(`/livestock/vet/campaigns/${campaignId}/enroll`, { animalId });
  return data;
}

export async function markVaccinated(campaignId: string, animalId: string): Promise<CampaignEnrollment> {
  const { data } = await api.post<CampaignEnrollment>(
    `/livestock/vet/campaigns/${campaignId}/mark-vaccinated`,
    { animalId }
  );
  return data;
}

// ---- Animals (pickers only; list is scoped server-side to own animals) ----

export interface VetAnimal {
  id: string;
  tagId: string;
  name: string;
  species: string;
  breed: string;
  ownerId: string;
}

export async function listVetAnimals(): Promise<Paged<VetAnimal>> {
  const { data } = await api.get<Paged<VetAnimal>>('/livestock/animals', { params: { pageSize: 500 } });
  return data;
}
