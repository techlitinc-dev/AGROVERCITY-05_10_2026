export interface LandPlot {
  id: string;
  ownerId: string;
  name: string;
  village: string;
  district: string;
  areaAcres: number;
  areaHectares: number;
  soilType: string;
  irrigationType: string;
  khasraNumber?: string;
  status: 'vacant' | 'leased';
  createdAt: string;
}

export interface Lease {
  id: string;
  plotId: string;
  ownerId: string;
  tenantName: string;
  tenantPhone: string;
  rentPerMonth: number;
  startDate: string;
  endDate: string;
  durationMonths?: number;
  terms?: string;
  status: 'active' | 'ended';
  verified: boolean;
  createdAt: string;
}

export interface RentPayment {
  id: string;
  leaseId: string;
  month: string;
  amount: number;
  mode: 'cash' | 'upi' | 'bank';
  paidOn: string;
  status: 'paid' | 'due' | 'overdue';
  note?: string;
  createdAt: string;
}

export interface LandListing {
  id: string;
  plotId: string;
  ownerId: string;
  expectedRentPerMonth: number;
  preferredDurationMonths: number;
  terms: string;
  photoUrls: string[];
  status: 'live' | 'paused' | 'leased';
  requestCount: number;
  createdAt: string;
}

export interface LeaseRequest {
  id: string;
  listingId: string;
  farmerId: string;
  farmerName?: string;
  village?: string;
  intendedCrop: string;
  durationMonths: number;
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  createdAt: string;
}

export interface LeaseAgreement {
  pdfUrl: string;
  generatedAt: string;
  signatures: { party: string; signedAt: string }[];
}
