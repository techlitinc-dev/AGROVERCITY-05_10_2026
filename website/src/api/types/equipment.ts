export type SlotStatus = 'available' | 'booked' | 'pending';
export type OwnerType = 'fpo' | 'private';

export interface Equipment {
  id: string;
  name: string;
  vernacularName?: string;
  type: string;
  ownerType: OwnerType;
  ownerId?: string;
  hourlyRate: number;
  perAcreRate?: number;
  distanceKm: number;
  isActive?: boolean;
  utilizationPct?: number;
  createdAt?: string;
}

export interface YantraSlot {
  id: string;
  equipmentId: string;
  date?: string;
  slotName: string;
  duration: string;
  status: SlotStatus;
  bookedByName?: string | null;
  priceRupees: number;
  recommendedTask: string;
}

export interface SlotTemplate {
  slotName: string;
  startTime: string;
  endTime: string;
  priceRupees: number;
  recommendedTask: string;
  enabled: boolean;
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected' | 'expired';

export interface SlotBooking {
  id: string;
  slotId: string;
  equipmentId: string;
  farmerId: string;
  status: BookingStatus;
  priceRupees: number;
  scheduledAt: string;
  createdAt: string;
}

export interface BookSlotRes {
  booking: SlotBooking;
  status: BookingStatus;
  agriCoinsEarned: number;
}

export interface FleetItem {
  equipmentId: string;
  name: string;
  bookingsThisWeek: number;
  fareEarnedRupees: number;
  utilizationPct: number;
  status: string;
}

export interface MaintenanceEntry {
  id: string;
  equipmentId: string;
  ownerId?: string;
  date: string;
  type: 'service' | 'repair';
  description: string;
  costRupees: number;
  engineHours?: number;
  receiptUrl?: string;
  nextServiceDate?: string;
  createdAt?: string;
}
