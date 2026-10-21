// Common API response envelopes
export interface ApiResponse<T> {
  data: T;
  page?: number;
  pageSize?: number;
  total?: number;
}

// 1. Farmer Entities
export interface ProduceLot {
  id: string;
  farmerId?: string;
  farmerName?: string;
  crop: string;
  variety?: string;
  quantity?: number;
  quantityQuintals?: number;
  expectedPricePerQuintal?: number;
  expectedRate?: number;
  grade?: string;
  village?: string;
  district?: string;
  status: 'active' | 'approved' | 'rejected' | 'sold' | 'disputed' | 'pending';
  harvestDate?: string;
  createdAt?: string;
  images?: string[];
  lat?: number;
  lng?: number;
}

export interface MandiRate {
  id: string;
  commodity: string;
  mandi: string;
  market?: string;
  district?: string;
  state?: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedBy?: string;
  source?: string;
}

export interface FarmDiaryEntry {
  id: string;
  farmerId: string;
  farmerName?: string;
  crop: string;
  activity: string;
  costPaisa?: number;
  costRupees?: number;
  date: string;
  notes?: string;
}

export interface AdvisoryScan {
  id: string;
  userId: string;
  userName?: string;
  crop: string;
  disease?: string;
  confidence?: number;
  severity?: string;
  createdAt: string;
  imageUrl?: string;
  accuracyScore?: number;
}

export interface SoilTest {
  id: string;
  userId: string;
  farmerName?: string;
  sampleId?: string;
  status: 'pending' | 'validated' | 'completed';
  ph?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  recommendation?: string;
  createdAt?: string;
}

// 2. Transporter Entities
export interface Vehicle {
  id: string;
  transporterId?: string;
  transporterName?: string;
  vehicleNumber?: string;
  vehicleNo?: string;
  vehicleType: string;
  capacityTons?: number;
  payloadCapacityQuintals?: number;
  rcNumber?: string;
  rcStatus?: string;
  insuranceExpiry?: string;
  fitnessExpiry?: string;
  pucExpiry?: string;
  docStatus: 'pending' | 'verified' | 'rejected';
  status: 'active' | 'inactive' | 'suspended';
}

export interface TransportBooking {
  id: string;
  farmerId?: string;
  farmerName?: string;
  transporterId?: string;
  transporterName?: string;
  vehicleType?: string;
  pickupLocation?: string | { village?: string; district?: string };
  dropLocation?: string | { mandi?: string; district?: string };
  fareAmount?: number;
  distanceKm?: number;
  status: 'requested' | 'accepted' | 'in_transit' | 'delivered' | 'completed' | 'cancelled' | 'disputed';
  pickupTime?: string;
  createdAt: string;
  commodity?: string;
  weightQuintals?: number;
}

// 3. Vyapari Entities
export interface BuyerOrg {
  id: string;
  name: string;
  orgName?: string;
  contactPerson?: string;
  phone?: string;
  gstNumber?: string;
  licenseNumber?: string;
  status: 'pending' | 'verified' | 'suspended';
  escrowLimit?: number;
  district?: string;
  createdAt?: string;
}

export interface B2BDeal {
  id: string;
  lotId?: string;
  buyerId?: string;
  buyerName?: string;
  farmerId?: string;
  farmerName?: string;
  commodity?: string;
  quantityQuintals?: number;
  agreedPricePerQuintal?: number;
  totalAmount?: number;
  escrowStatus: 'held' | 'released' | 'refunded' | 'disputed';
  status: 'negotiating' | 'confirmed' | 'dispatched' | 'completed' | 'cancelled';
  createdAt?: string;
}

export interface BuyerContract {
  id: string;
  title: string;
  buyerName?: string;
  commodity: string;
  targetQuantityQuintals?: number;
  pricePerQuintal: number;
  startDate?: string;
  endDate?: string;
  status: 'draft' | 'active' | 'fulfilled' | 'terminated';
  acceptancesCount?: number;
}

// 4. Mahila Graha Udyog Entities
export interface WomenShg {
  id: string;
  name: string;
  village?: string;
  district?: string;
  memberCount: number;
  leaderName?: string;
  phone?: string;
  loanFundPaisa?: number;
  monthlyDepositPaisa?: number;
  status: 'pending' | 'verified' | 'active' | 'suspended';
  createdAt?: string;
}

export interface GruhCert {
  id: string;
  unitId: string;
  unitName?: string;
  ownerUid?: string;
  ownerName?: string;
  type: string;
  number?: string;
  documentUrl?: string;
  status: 'pending' | 'verified' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
  reviewReason?: string;
  createdAt?: string;
}

export interface WomenEnterpriseProduct {
  id: string;
  unitId?: string;
  unitName?: string;
  name: string;
  category: string;
  priceRupees: number;
  stock: number;
  status: 'draft' | 'live' | 'paused' | 'moderated';
  fssaiVerified?: boolean;
}

// 5. Nursery Entities
export interface TreeNursery {
  id: string;
  name: string;
  ownerName?: string;
  phone?: string;
  district?: string;
  state?: string;
  accreditationNumber?: string;
  capacitySaplings?: number;
  verified: boolean;
  status: 'pending' | 'verified' | 'rejected' | 'active';
  rejectionReason?: string;
  createdAt?: string;
}

export interface TreeRequest {
  id: string;
  farmerId: string;
  farmerName?: string;
  species: string;
  quantity: number;
  landAreaAcres?: number;
  village?: string;
  district?: string;
  status: 'submitted' | 'approved' | 'dispatched' | 'planted' | 'rejected';
  survivalRatePct?: number;
  createdAt: string;
}

export interface NurseryPlant {
  id: string;
  nurseryId?: string;
  nurseryName?: string;
  name: string;
  category?: string;
  species?: string;
  priceRupees: number;
  stock: number;
  moderationStatus?: 'approved' | 'pending' | 'rejected' | 'taken_down';
}

// 6. eMarket Customer Entities
export interface MarketplaceOrder {
  id: string;
  userId: string;
  buyerName?: string;
  phone?: string;
  itemCount?: number;
  total?: number;
  finalTotal?: number;
  status: 'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  items?: Array<{
    productId: string;
    productName?: string;
    quantity: number;
    price?: number;
  }>;
  createdAt?: string;
  trackingNumber?: string;
}

export interface MarketplaceProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  stock: number;
  inStock?: boolean;
  sellerId?: string;
  sellerName?: string;
  status?: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminEmail?: string;
  role: string;
  action: string;
  module?: string;
  targetId: string;
  reason?: string;
  previousState?: unknown;
  newState?: unknown;
  at: string;
  ipAddress?: string;
}

// 7. Farmer Pages & Content CMS Entities
export interface AgriNewsItem {
  id: string;
  title: string;
  vernacularTitle?: string;
  summary?: string;
  content?: string;
  body?: string;
  category?: string;
  isBreaking?: boolean;
  impactRating?: string;
  audioText?: string;
  source?: string;
  timestamp?: string;
  createdAt?: string;
  status?: string;
}

export interface LiveChannel {
  id: string;
  name?: string;
  channelName?: string;
  title?: string;
  streamUrl?: string;
  currentProgram?: string;
  viewersCount?: number;
  isLive?: boolean;
  language?: string;
  category?: string;
  status?: string;
}

export interface WorkshopItem {
  id: string;
  title: string;
  instructorName?: string;
  instructorId?: string;
  date?: string;
  time?: string;
  duration?: string;
  feeRupees?: number;
  maxSeats?: number;
  enrolledCount?: number;
  mode?: 'online' | 'offline' | 'hybrid';
  venue?: string;
  meetingLink?: string;
  status?: string;
  createdAt?: string;
}

export interface VideoGuideItem {
  id: string;
  title: string;
  videoUrl?: string;
  youtubeId?: string;
  duration?: string;
  crop?: string;
  category?: string;
  views?: number;
  thumbnailUrl?: string;
  createdAt?: string;
}

export interface BlogArticleItem {
  id: string;
  title: string;
  author?: string;
  category?: string;
  readTimeMinutes?: number;
  publishedAt?: string;
  summary?: string;
  content?: string;
  tags?: string[];
  createdAt?: string;
}

export interface GovSchemeItem {
  id: string;
  name: string;
  category: string;
  eligible?: boolean;
  benefitAmount?: string;
  documentsRequired?: string[];
  status?: string;
  nextDeadline?: string;
  description?: string;
  portalUrl?: string;
  subsidyPercent?: number;
}

// 8. Landlord Entities
export interface LandListing {
  id: string;
  landlordId?: string;
  landlordName?: string;
  village?: string;
  district?: string;
  state?: string;
  areaAcres?: number;
  expectedRentRupees?: number;
  status?: string;
  plotId?: string;
  soilType?: string;
  waterSource?: string;
  createdAt?: string;
  auditFlags?: string[];
}

export interface LandLease {
  id: string;
  listingId?: string;
  landlordId?: string;
  landlordName?: string;
  farmerId?: string;
  farmerName?: string;
  village?: string;
  surveyNumber?: string;
  areaAcres?: number;
  rentPerYearRupees?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  recordMismatch?: boolean;
  createdAt?: string;
}

// 9. Equipment Owner Entities
export interface EquipmentItem {
  id: string;
  name: string;
  type: string;
  ownerType?: string;
  ownerId?: string;
  ownerName?: string;
  hourlyRate?: number;
  perAcreRate?: number;
  distanceKm?: number;
  active?: boolean;
  docStatus?: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  createdAt?: string;
}

export interface EquipmentBooking {
  id: string;
  equipmentId?: string;
  equipmentName?: string;
  renterId?: string;
  renterName?: string;
  ownerId?: string;
  ownerName?: string;
  bookingDate?: string;
  slot?: string;
  totalHours?: number;
  totalAmountRupees?: number;
  status: string;
  disputeReason?: string;
  createdAt?: string;
}

// 10. FPO Entities
export interface FpoItem {
  id: string;
  name: string;
  memberCount?: number;
  district?: string;
  state?: string;
  registrationNumber?: string;
  status?: string;
  totalEquityRupees?: number;
  activePoolsCount?: number;
  createdAt?: string;
}

export interface FpoPoolItem {
  id: string;
  fpoId: string;
  fpoName?: string;
  item: string;
  bookedUnits?: number;
  targetUnits?: number;
  discountPercent?: number;
  deadline?: string;
  status: 'open' | 'closed' | 'cancelled';
  createdAt?: string;
}

// 11. Livestock Entities (Vet, Gaushala, Dairy, Milk Vendor)
export interface LivestockVet {
  id: string;
  name: string;
  phone?: string;
  degree?: string;
  specialization?: string;
  registrationNumber?: string;
  district?: string;
  status?: 'pending' | 'verified' | 'rejected' | 'active';
  verified?: boolean;
  emergencyAvailable?: boolean;
  feeRupees?: number;
  createdAt?: string;
}

export interface GaushalaItem {
  id: string;
  name: string;
  trustName?: string;
  contactPerson?: string;
  phone?: string;
  district?: string;
  cowsCount?: number;
  desiBreeds?: string[];
  productsOffered?: string[];
  status?: string;
  createdAt?: string;
}

export interface ColdStorageFacility {
  id: string;
  name: string;
  operatorName?: string;
  phone?: string;
  district?: string;
  capacityMetricTons?: number;
  availableCapacityMT?: number;
  chambersCount?: number;
  temperatureRangeCelsius?: string;
  cropsSupported?: string[];
  verified?: boolean;
  docStatus?: string;
  status?: string;
  createdAt?: string;
}

// 12. Gurukul Entities
export interface GurukulCourse {
  id: string;
  title: string;
  instructorName?: string;
  category?: string;
  modulesCount?: number;
  durationHours?: number;
  feeRupees?: number;
  enrolledStudentsCount?: number;
  rating?: number;
  level?: string;
  createdAt?: string;
}

export interface TeacherProfile {
  id: string;
  userId?: string;
  name: string;
  phone?: string;
  specialization?: string;
  experienceYears?: number;
  bio?: string;
  isVerified?: boolean;
  status?: string;
  coursesCount?: number;
}

// 13. Banking & Insurance Entities
export interface FinanceLoan {
  id: string;
  applicationId?: string;
  userId: string;
  applicantName?: string;
  phone?: string;
  loanType?: string;
  requestedAmountRupees?: number;
  sanctionedAmount?: number;
  status: string;
  bankName?: string;
  prescreenDecision?: string;
  creditScore?: number;
  createdAt?: string;
}

export interface InsuranceClaim {
  id: string;
  claimNumber?: string;
  userId: string;
  farmerName?: string;
  farmerPhone?: string;
  cropName?: string;
  cropStage?: string;
  calamityType?: string;
  dateOfDamage?: string;
  requestedAmount?: number;
  approvedAmount?: number;
  estimatedLossPercent?: number;
  status: string;
  statusText?: string;
  surveyorName?: string;
  surveyorPhone?: string;
  dbtTransactionId?: string;
  village?: string;
  submittedAt?: string;
}

// 14. Exporter & Trader Entities
export interface ExportRfq {
  id: string;
  commodity: string;
  variety?: string;
  quantityMT?: number;
  destinationCountry?: string;
  buyerName?: string;
  targetPriceUSD?: number;
  incoterm?: string;
  status?: string;
  createdAt?: string;
}

export interface ExportOrder {
  id: string;
  orderNumber?: string;
  commodity: string;
  importerName?: string;
  country?: string;
  totalValueUSD?: number;
  status?: string;
  shipmentDate?: string;
  apedaCertificateNo?: string;
}
