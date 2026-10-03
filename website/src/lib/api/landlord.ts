import { api } from './client';

export interface Plot {
  id: string;
  name: string;
  village: string;
  district: string;
  areaAcres: number;
  gatNumber?: string;
  soilType?: string;
  status: 'vacant' | 'leased';
}

export interface LandListing {
  id: string;
  landlordId: string;
  landlordName: string;
  village: string;
  district: string;
  lat: number;
  lng: number;
  areaAcres: number;
  expectedRentRupees: number;
  soilType?: string;
  waterSource?: string;
  plotId?: string;
  status: 'open' | 'leased' | 'closed';
  createdAt: string;
}

export interface LeaseRequest {
  id: string;
  listingId: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  landlordId: string;
  message: string;
  durationMonths: number;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  proposedRentRupees?: number;
  counterRentRupees?: number;
  negotiationRounds?: number;
  landlordNotes?: string;
  createdAt: string;
}

export interface Lease {
  id: string;
  plotId: string;
  tenantName: string;
  tenantPhone: string;
  monthlyRentRupees: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'ended';
  verified: boolean;
}

export interface EscrowMilestone {
  index: number;
  name: string;
  percentage: number;
  amountRupees: number;
  status: 'pending' | 'released' | 'disputed';
  targetWindow: string;
  releaseDate?: string | null;
  notes?: string;
}

export interface LandlordAnalytics {
  totalAcreage: number;
  totalPlots: number;
  activeTenants: number;
  occupancyRatePercent: number;
  monthlyRentIncomeRupees: number;
  totalRentCollectedRupees: number;
  pendingRequestsCount: number;
  totalListings: number;
  soilBreakdown: Array<{ soilType: string; count: number }>;
  demandTrend: Array<{ month: string; demandScore: number; avgAcreRate: number }>;
}

export async function fetchLandlordAnalytics(): Promise<LandlordAnalytics> {
  const res = await api.get<LandlordAnalytics>('/land/analytics');
  return res.data;
}

export async function fetchMyPlots(): Promise<Plot[]> {
  const res = await api.get<{ data: Plot[] }>('/land/plots');
  return res.data.data;
}

export async function createPlot(data: Omit<Plot, 'id' | 'status'>): Promise<Plot> {
  const res = await api.post<Plot>('/land/plots', data);
  return res.data;
}

export async function fetchMyListings(): Promise<LandListing[]> {
  const res = await api.get<{ data: LandListing[] }>('/land/listings/mine');
  return res.data.data;
}

export async function createListing(data: {
  village: string;
  district: string;
  lat: number;
  lng: number;
  areaAcres: number;
  expectedRentRupees: number;
  soilType?: string;
  waterSource?: string;
  plotId?: string;
}): Promise<LandListing> {
  const res = await api.post<LandListing>('/land/listings', data);
  return res.data;
}

export async function fetchLeaseRequests(): Promise<LeaseRequest[]> {
  const res = await api.get<{ data: LeaseRequest[] }>('/land/lease-requests');
  return res.data.data;
}

export async function counterLeaseRequest(
  requestId: string,
  data: { counterRentRupees: number; note?: string; durationMonths?: number }
): Promise<LeaseRequest> {
  const res = await api.post<LeaseRequest>(`/land/lease-requests/${requestId}/counter`, data);
  return res.data;
}

export async function acceptLeaseRequest(requestId: string): Promise<{ leaseId: string }> {
  const res = await api.post<{ leaseId: string }>(`/land/lease-requests/${requestId}/accept`);
  return res.data;
}

export async function rejectLeaseRequest(requestId: string, reason: string): Promise<{ status: string }> {
  const res = await api.post<{ status: string }>(`/land/lease-requests/${requestId}/reject`, { reason });
  return res.data;
}

export async function fetchLeases(): Promise<Lease[]> {
  const res = await api.get<{ data: Lease[] }>('/land/leases');
  return res.data.data;
}

export async function fetchLeaseMilestones(leaseId: string): Promise<{ leaseId: string; milestones: EscrowMilestone[] }> {
  const res = await api.get<{ leaseId: string; milestones: EscrowMilestone[] }>(`/land/leases/${leaseId}/milestones`);
  return res.data;
}

export async function updateLeaseMilestone(
  leaseId: string,
  data: { milestoneIndex: number; status: 'pending' | 'released' | 'disputed'; notes?: string }
): Promise<{ leaseId: string; milestones: EscrowMilestone[] }> {
  const res = await api.post<{ leaseId: string; milestones: EscrowMilestone[] }>(`/land/leases/${leaseId}/milestones`, data);
  return res.data;
}

export async function fetchLeasePayments(leaseId: string): Promise<{
  data: Array<{ id: string; month: string; amountRupees: number; method: string; paidAt: string }>;
  totalCollectedRupees: number;
  pendingMonths: string[];
}> {
  const res = await api.get<any>(`/land/leases/${leaseId}/payments`);
  return res.data;
}

export async function recordRentPayment(
  leaseId: string,
  data: { amountRupees: number; month: string; method: 'cash' | 'upi' | 'bank'; paidAt: string }
) {
  const res = await api.post(`/land/leases/${leaseId}/payments`, data);
  return res.data;
}
