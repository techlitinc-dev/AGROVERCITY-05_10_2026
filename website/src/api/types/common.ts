export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type ProfileType =
  | 'farmer'
  | 'farmLandlord'
  | 'transport'
  | 'seller'
  | 'equipmentRental'
  | 'broker';

export type LanguageCode = 'hi' | 'mr' | 'gu' | 'pa' | 'te' | 'ta' | 'en';

export type PaymentMode = 'cash' | 'upi' | 'bank' | 'credit' | 'udhaar';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors: Record<string, unknown>;
  };
}
