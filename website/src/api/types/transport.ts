export type VehicleTypeId = 'tataAce' | 'boleroMaxi' | 'tractorTrolley' | 'pickup' | 'miniTruck';

export interface VehicleType {
  type: VehicleTypeId;
  baseFare: number;
  perKmRate: number;
  capacityTonnes: number;
}

export interface FareEstimateBody {
  vehicleType: VehicleTypeId;
  distanceKm: number;
}

export interface FareEstimate {
  baseFare: number;
  distanceFare: number;
  totalFare: number;
}

export type TripStatus =
  | 'requested'
  | 'accepted'
  | 'enRoute'
  | 'delivered'
  | 'cancelled'
  | 'rejected'
  | 'expired';

export interface TransportBooking {
  id: string;
  vehicleType: VehicleTypeId;
  vehicleId?: string;
  vehicleNo?: string;
  distanceKm: number;
  pickup: string;
  drop: string;
  date: string;
  fare: number;
  status: TripStatus;
  cargoNote?: string;
  lotId?: string;
  bookerName?: string;
  podNote?: string;
  podPhotos?: string[];
  receiverName?: string;
  receiverSignatureUrl?: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  ownerId: string;
  type: VehicleTypeId;
  registrationNo: string;
  capacityTonnes: number;
  baseFare: number;
  perKmRate: number;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  isActive: boolean;
  rcDocumentUrl?: string;
  insuranceDocumentUrl?: string;
  insuranceExpiry?: string;
  fitnessExpiry?: string;
  pucExpiry?: string;
  docStatus?: 'ok' | 'expiringSoon' | 'expired';
  createdAt: string;
}

export type VehicleBody = Partial<Omit<Vehicle, 'id' | 'ownerId' | 'verificationStatus' | 'isActive' | 'createdAt' | 'docStatus'>>;

export interface VehicleCalendarDay {
  date: string;
  status: 'available' | 'booked' | 'blocked';
  bookingCount: number;
}

export interface VehicleCalendar {
  vehicleId: string;
  month: string;
  days: VehicleCalendarDay[];
}

export interface AvailabilityBody {
  dates: string[];
  status: 'blocked' | 'available';
}

export type SettlementStatus = 'pending' | 'approved' | 'paid' | 'failed' | 'onHold';

export interface Settlement {
  id: string;
  role: 'transport' | 'equipmentRental' | 'broker';
  periodStart: string;
  periodEnd: string;
  itemCount: number;
  grossRupees: number;
  commissionPct: number;
  commissionRupees: number;
  netRupees: number;
  status: SettlementStatus;
  paidOn: string | null;
  bankAccountLast4: string | null;
  utr: string | null;
}

export interface CurrentSettlement {
  periodStart: string;
  grossRupees: number;
  estimatedNetRupees: number;
  tripCount: number;
  payoutDay: string;
}
