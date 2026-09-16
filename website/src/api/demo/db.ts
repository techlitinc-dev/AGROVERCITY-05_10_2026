import type {
  Address,
  AggregatedBooking,
  AgriLiveChannel,
  AgriNewsItem,
  AuthSession,
  BankAccount,
  BlogArticle,
  BrokerDeal,
  BrokerLead,
  BuyerContract,
  BuyerLedgerEntry,
  BuyerRequirement,
  CartItem,
  ChatMessage,
  ChatThread,
  CoinLedgerEntry,
  ColdStorage,
  CommissionEntry,
  ConsentFlags,
  CropCycle,
  CropInsurancePolicy,
  Equipment,
  ExpertTalk,
  FarmDiaryEntry,
  FarmPlot,
  FarmTask,
  FarmerProfile,
  FpoPool,
  InputProduct,
  InsuranceClaimRecord,
  InventoryItem,
  LandListing,
  LandPlot,
  LandRecord712,
  Lease,
  LeaseRequest,
  RentPayment,
  MandiPrice,
  MarketLot,
  NotificationItem,
  Order,
  Procurement,
  ReferralUser,
  Reward,
  SaleEntry,
  SellerRate,
  SlotBooking,
  SoilTestBooking,
  SupportMessage,
  SupportThread,
  TransportBooking,
  UserSettings,
  Vehicle,
  VideoGuide,
  VaultDocument,
  VyapariRate,
  GovtScheme,
  PaidWorkshop,
  YantraSlot,
} from '@/api/types';
import { buildSeed } from './seed';

export interface DemoUser extends FarmerProfile {
  mpin: string;
}

export interface OtpSession {
  phone: string;
  expiresAt: number;
}

export interface DemoDb {
  users: Record<string, DemoUser>;
  userIdsByPhone: Record<string, string>;
  otpSessions: Record<string, OtpSession>;
  refreshTokens: Record<string, string>;
  sessions: AuthSession[];
  settings: Record<string, UserSettings>;
  consents: Record<string, ConsentFlags & { updatedAt: string }>;
  mandiPrices: MandiPrice[];
  vyapariRates: VyapariRate[];
  products: InputProduct[];
  cart: CartItem[];
  orders: Order[];
  contracts: BuyerContract[];
  vehicles: Vehicle[];
  transportBookings: TransportBooking[];
  equipmentList: Equipment[];
  slots: YantraSlot[];
  slotBookings: SlotBooking[];
  diaryEntries: FarmDiaryEntry[];
  schemes: GovtScheme[];
  vaultDocs: VaultDocument[];
  policies: CropInsurancePolicy[];
  claims: InsuranceClaimRecord[];
  landRecords: LandRecord712[];
  fpoPools: FpoPool[];
  notifications: NotificationItem[];
  addresses: Address[];
  bankAccounts: BankAccount[];
  chats: ChatThread[];
  chatMessages: Record<string, ChatMessage[]>;
  supportThreads: SupportThread[];
  supportMessages: Record<string, SupportMessage[]>;
  sellerRates: SellerRate[];
  inventory: InventoryItem[];
  sales: SaleEntry[];
  procurements: Procurement[];
  ledgerEntries: Record<string, BuyerLedgerEntry[]>;
  deals: BrokerDeal[];
  leads: BrokerLead[];
  commissions: CommissionEntry[];
  landPlots: LandPlot[];
  leases: Lease[];
  rentPayments: RentPayment[];
  listings: LandListing[];
  leaseRequests: LeaseRequest[];
  lots: MarketLot[];
  requirements: BuyerRequirement[];
  farmPlots: FarmPlot[];
  cropCycles: CropCycle[];
  tasks: FarmTask[];
  soilTests: SoilTestBooking[];
  aggregatedBookings: AggregatedBooking[];
  rewards: Reward[];
  coinLedger: CoinLedgerEntry[];
  referrals: ReferralUser[];
  coldStorages: ColdStorage[];
  news: AgriNewsItem[];
  channels: AgriLiveChannel[];
  workshops: PaidWorkshop[];
  expertTalks: ExpertTalk[];
  videos: VideoGuide[];
  blogs: BlogArticle[];
}

const DB_KEY = 'ks.demodb';
let db: DemoDb | null = null;

export function getDb(): DemoDb {
  if (db) return db;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      db = JSON.parse(raw) as DemoDb;
      return db;
    }
  } catch {
    // in-memory fallback
  }
  db = buildSeed();
  return db;
}

export function saveDb(): void {
  if (!db) return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // storage unavailable — demo db stays in memory only
  }
}

export function resetDemoDb(): DemoDb {
  db = buildSeed();
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // in-memory only
  }
  return db;
}
