import type { GeoPoint, LanguageCode, ProfileType } from './common';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface FarmerProfile {
  id: string;
  name: string;
  vernacularName: string;
  phone: string;
  village: string;
  tehsil: string;
  district: string;
  state: string;
  landAreaAcres: number;
  soilType: string;
  irrigationType: string;
  kisanCreditScore: number;
  creditTier: string;
  krishiRatnaLevel: number;
  krishiRatnaTitle: string;
  streakDays: number;
  agriCoins: number;
  bankName: string;
  kccLimit: number;
  activeCrops: string[];
  farmBoundaryPoints: GeoPoint[];
  linkedProfiles: ProfileType[];
  activeProfile: ProfileType;
  primaryProfile: ProfileType;
  fpoId?: string | null;
  referralCodeUsed?: string | null;
  khasraNumber?: string;
}

export interface OtpSendBody {
  phone: string;
}

export interface OtpSendRes {
  otpSessionId: string;
  expiresInSec: number;
  resendAfterSec: number;
}

export interface OtpVerifyBody {
  phone: string;
  otp: string;
  otpSessionId: string;
}

export interface OtpVerifyRes extends AuthTokens {
  isNewUser: boolean;
  user: FarmerProfile;
}

export interface LoginBody {
  phone: string;
  mpin: string;
}

export interface LoginRes extends AuthTokens {
  user: FarmerProfile;
}

export interface MpinResetBody {
  phone: string;
  otp: string;
  otpSessionId: string;
  newMpin: string;
}

export interface MpinReverifyBody {
  mpin: string;
  fcmToken?: string;
}

export interface BiometricLoginBody {
  phone: string;
  deviceKey: string;
  signature: string;
}

export interface RefreshBody {
  refreshToken: string;
}

export interface RegisterBody {
  name: string;
  phone: string;
  state: string;
  district: string;
  tehsil: string;
  village: string;
  landAreaAcres: number;
  soilType: string;
  irrigationType: string;
  crops: string[];
  mpin: string;
  profiles: ProfileType[];
  primaryProfile: ProfileType;
  referralCode?: string;
}

export interface AuthSession {
  id: string;
  deviceName: string;
  platform: string;
  lastSeenAt: string;
  current: boolean;
}

export interface UserSettings {
  language: LanguageCode;
  womenMode: boolean;
  highContrast: boolean;
  darkMode: boolean;
}

export interface ConsentFlags {
  saturationShare: boolean;
  locationForAdvisory: boolean;
  marketingPush: boolean;
  voiceDataProcessing: boolean;
}

export interface ConsentsRes {
  consents: ConsentFlags;
  updatedAt: string;
}

export interface ProfileActivateRes {
  activeProfile: ProfileType;
  defaultHomeRoute: string;
}

export interface FarmBoundaryBody {
  farmBoundaryPoints: GeoPoint[];
  landAreaAcres: number;
  khasraNumber?: string;
}

export interface DashboardMetricPill {
  key: string;
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
}

export interface DashboardQuickAction {
  route: string;
  label: string;
  icon: string;
}

export interface DashboardActivityItem {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  amountRupees?: number;
  at: string;
}

export interface DashboardPayload {
  profileType: ProfileType;
  metrics: DashboardMetricPill[];
  quickActions: DashboardQuickAction[];
  activity: DashboardActivityItem[];
}

export type BookingType = 'equipment' | 'transport' | 'vet' | 'workshop' | 'talk';

export interface AggregatedBooking {
  type: BookingType;
  refId: string;
  title: string;
  scheduledAt: string;
  status: string;
  amountRupees: number;
  cancellable: boolean;
}
