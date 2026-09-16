export type SoilTestStatus = 'booked' | 'sampleCollected' | 'atLab' | 'resultReady';

export interface SoilTestBooking {
  id: string;
  plotId: string;
  pickupDate: string;
  sampleDepth: 'surface' | 'subsurface';
  payment: { mode: 'coins' | 'shcScheme' | 'paid'; coinsRedeemed: number; amountRupees: number };
  status: SoilTestStatus;
  bookingRef: string;
  resultPdfUrl: string | null;
  createdAt: string;
}

export interface HomeDashboard {
  weather: unknown;
  urgentTask: unknown;
  vyapariRates: unknown[];
  banners: { id: string; title: string; route: string }[];
}
