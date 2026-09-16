export interface AppConfig {
  minSupportedVersion: string;
  latestVersion: string;
  forceUpdate: boolean;
  playStoreUrl: string;
  featureFlags: Record<string, boolean>;
  rateSanityBandPct: number;
  coinCaps: { earnPerDay: number; redeemMaxPctOfOrder: number };
  maintenance: { active: boolean; message: string };
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  refId?: string;
  route?: string;
  read: boolean;
  at: string;
}

export type AddressLabel = 'home' | 'farm' | 'other';

export interface Address {
  id: string;
  userId?: string;
  label: AddressLabel;
  line: string;
  village: string;
  district: string;
  pincode: string;
  phone: string;
  isDefault: boolean;
  createdAt?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountLast4: string;
  ifsc: string;
  accountHolderName: string;
  accountType: 'savings' | 'current';
  verificationStatus: 'pending' | 'verified' | 'failed';
  verificationMethod: 'pennyDrop';
  failureReason?: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface BankAccountBody {
  accountNumber: string;
  ifsc: string;
  accountHolderName: string;
  accountType: 'savings' | 'current';
}

export interface ChatParticipant {
  uid: string;
  name: string;
  role: string;
}

export type ChatContextType = 'direct' | 'brokerDeal' | 'transportBooking' | 'produceLot';

export interface ChatThread {
  id: string;
  participants: ChatParticipant[];
  contextType: ChatContextType;
  contextId: string | null;
  lastMessage: string | null;
  unreadCount: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string;
  senderRole?: string;
  type: 'text' | 'image' | 'system';
  text: string;
  attachmentUrl: string | null;
  at: string;
}

export type SupportThreadStatus = 'open' | 'answered' | 'closed';

export interface SupportThread {
  id: string;
  topic: string;
  status: SupportThreadStatus;
  lastMessage: string;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  sender: 'user' | 'expert';
  text: string;
  attachmentUrl: string | null;
  at: string;
}

export interface SearchResults {
  query: string;
  schemes: { id: string; name: string; match: string }[];
  products: { id: string; title: string; discountedPrice: number }[];
  news: { id: string; title: string; timestamp: string }[];
  crops: { crop: string; vernacularName: string; mandiCount: number }[];
  videos: { id: string; title: string; duration: string }[];
}

export interface Device {
  id: string;
  fcmToken?: string;
  platform: 'android' | 'web';
  deviceName: string;
  registeredAt: string;
}

export interface SyncOperation {
  idempotencyKey: string;
  method: string;
  path: string;
  body: unknown;
  queuedAt: string;
  baseUpdatedAt?: string;
}

export interface SyncOpResult {
  idempotencyKey: string;
  status: number;
  body?: unknown;
  error?: { code: string; message: string; fieldErrors: Record<string, unknown> };
  replayed: boolean;
}

export interface SyncRes {
  results: SyncOpResult[];
}

export interface RatingBody {
  bookingType: 'transport' | 'equipment' | 'vet' | 'workshop' | 'talk';
  bookingId: string;
  stars: number;
  tags: string[];
  comment: string;
}

export interface RatingSummary {
  targetType: string;
  targetId: string;
  average: number;
  count: number;
}

export interface ReportBody {
  reason: 'spam' | 'abuse' | 'fraud' | 'inappropriate' | 'other';
  contextType: 'chat' | 'deal' | 'rate' | 'profile';
  contextId: string;
  details: string;
}

export interface RazorpayOrderRes {
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

export interface RazorpayVerifyBody {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface RazorpayVerifyRes {
  verified: boolean;
  purpose: string;
  refId: string;
}

export interface SttRes {
  text: string;
  language: string;
  confidence: number;
  durationMs: number;
}

export interface TtsRes {
  audioUrl: string;
  durationMs: number;
  cached: boolean;
}
