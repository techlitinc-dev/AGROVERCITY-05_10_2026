// Core Domain Types for AGROVERCITY / Kisan Setu

export type PersonaType =
  | 'farmer'
  | 'landlord'
  | 'transporter'
  | 'seller'
  | 'equipmentOwner'
  | 'broker'
  | 'dairyManager'
  | 'milkSeller'
  | 'vet'
  | 'fpoManager'
  | 'womenShg'
  | 'exporter'
  | 'instructor'
  | 'directBuyer'
  | 'customer'
  | 'bankManager'
  | 'insuranceProvider'
  | 'coldStorageProvider'
  | 'gaushalaManager'
  | 'nursery'
  | 'superadmin';

export interface UserProfile {
  id: string;
  phone: string;
  name: string;
  state: string;
  district: string;
  village?: string;
  whatsapp?: string;
  pincode?: string;
  activePersona: PersonaType;
  availablePersonas: PersonaType[];
  /** Personas the user hid in profile settings — options hidden, data kept. */
  disabledPersonas?: PersonaType[];
  kycStatus: 'unverified' | 'submitted' | 'verified' | 'rejected';
  /**
   * Server-controlled registration journey state. Missing for legacy accounts
   * (grandfathered = completed); new registrations move pendingProfile →
   * pendingKyc → completed only after identity verification succeeds.
   */
  registrationStatus?: 'pendingProfile' | 'pendingKyc' | 'completed';
  /** Identity-verification artefacts (DigiLocker-style), masked only. */
  maskedAadhaar?: string;
  verifiedName?: string;
  verificationMode?: string;
  hasMpin: boolean;
  avatarUrl?: string;
  farmSizeAcres?: number;
  gatNumber?: string;
  kisanCoins: number;
}

export interface MandiPrice {
  id: string;
  commodity: string;
  variety: string;
  mandi: string;
  district: string;
  state: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  priceDate: string;
  trendPercentage: number;
  msp?: number;
}

/** One normalized government-data mandi price row (INR per quintal). */
export interface MandiLivePrice {
  id: string;
  state: string;
  district: string;
  mandiName: string;
  commodity: string;
  variety: string;
  grade: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  priceDate: string;
  unit: 'INR_PER_QUINTAL';
}

/** GET /mandi/live — latest reported government open-data prices (daily, not real-time). */
export interface MandiLiveResponse {
  data: MandiLivePrice[];
  count: number;
  total: number;
  limit: number;
  offset: number;
  district: string;
  commodity: string;
  /** Latest priceDate across the returned records; null when nothing valid. */
  reportedDate: string | null;
  fetchedAt: string;
  source: string;
  /** True when the upstream refresh failed and this is the last-good cached snapshot. */
  stale: boolean;
}

/** GET /mandi/live/filters — derived from stored genuine snapshots. */
export interface MandiLiveFilters {
  districts: string[];
  commodities: string[];
  mandis: { name: string; district: string }[];
  records: number;
  source: string;
}

export interface ProduceLot {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  crop: string;
  variety: string;
  quantityQuintal: number;
  grade: 'A' | 'B' | 'C' | 'Ungraded';
  expectedPricePerQuintal: number;
  location: string;
  state: string;
  district: string;
  status:
    | 'open'
    | 'negotiating'
    | 'locked'
    | 'sold'
    | 'withdrawn'
    // moderation lifecycle
    | 'pending_review'
    | 'rejected'
    | 'taken_down';
  harvestDate?: string;
  imageUrl?: string;
  photos?: string[];
  lat?: number;
  lng?: number;
  village?: string;
  createdAt: string;
  offersCount: number;
}

export type DemandSupplyType = 'oneTime' | 'recurring';
export type DemandFrequency = 'oneTime' | 'weekly' | 'fortnightly' | 'monthly';
export type DemandStatus =
  | 'draft'
  | 'open'
  | 'paused'
  | 'applicationsReceived'
  | 'closed'
  | 'fulfilled';

export interface BuyerSummary {
  buyerId: string;
  name: string;
  companyName: string;
  buyerType: string;
  /** Legacy browse flag — identity verification only. */
  verified?: boolean;
  identityVerified?: boolean;
  businessVerified?: boolean;
  capacityPerMonth?: number;
  capacityPerDay?: number;
  serviceRadiusKm?: number;
  district?: string;
  state?: string;
  ratingAvg?: number | null;
  ratingCount?: number;
}

export interface BuyerDemand {
  id: string;
  buyerId: string;
  buyerName: string;
  companyName: string;
  buyerCompany?: string;
  crop: string;
  variety?: string;
  quantity: number;
  unit?: string;
  /** Legacy aliases kept for older screens. */
  requiredQuantityQuintal?: number;
  maxPrice: number;
  maxPricePerQuintal?: number;
  qualityGrade?: 'A' | 'B' | 'C';
  qualitySpecs?: string;
  packaging?: string;
  deliveryLocation: string;
  state: string;
  district?: string;
  neededBy?: string;
  validUntil?: string;
  frequency?: DemandFrequency;
  supplyType?: DemandSupplyType;
  quantityPerDelivery?: number;
  startDate?: string;
  endDate?: string;
  deliveryMode?: 'delivery' | 'collection';
  transportArrangement?: string;
  packagingRequirements?: string;
  labellingRequirements?: string;
  partialAllowed?: boolean;
  multipleFarmersAllowed?: boolean;
  targetPrice?: number;
  targetUnit?: string;
  samplingRequirements?: string;
  qualityConditions?: string;
  gradeNotes?: string;
  notes?: string;
  audience?: string;
  status: DemandStatus;
  offersCount?: number;
  applicationsCount?: number;
  createdAt: string;
  buyerSummary?: BuyerSummary;
  match?: { cropMatch: boolean; locationMatch: boolean };
}

export interface TradeOffer {
  id: string;
  targetType: 'lot' | 'demand';
  targetId: string;
  lotCrop?: string;
  senderId: string;
  senderName: string;
  senderRole: 'farmer' | 'buyer' | 'vyapari';
  receiverId: string;
  receiverName: string;
  pricePerUnit: number;
  quantity: number;
  message?: string;
  counterPrice?: number;
  counterRound: number; // Max 1 round for B2B trade negotiation
  status: 'pending' | 'countered' | 'agreement_pending' | 'accepted' | 'rejected' | 'withdrawn';
  /** Mutual deal agreement — present while status is 'agreement_pending' (one
   *  party agreed, waiting for the other) or after lock ('accepted'). */
  agreement?: {
    confirmedBy: string[];
    at: string;
    previousStatus?: string;
    lockedAt?: string;
  } | null;
  createdAt: string;
}

export type PurchaseStatus =
  | 'confirmed'
  | 'advancePaid'
  | 'pickupScheduled'
  | 'inTransit'
  | 'delivered'
  | 'completed'
  | 'qcDisputed'
  | 'cancelled';

export interface PurchaseOrder {
  id: string;
  offerId?: string;
  lotId?: string;
  farmerId: string;
  farmerName: string;
  buyerId: string;
  buyerName: string;
  crop: string;
  quantityQuintal: number;
  agreedPricePerQuintal: number;
  totalAmount: number;
  advanceAmount: number;
  advancePaid: boolean;
  status: PurchaseStatus;
  pickupDate?: string;
  pickupAddress?: string;
  vehicleNumber?: string;
  handoverOtp?: string;
  qcGrade?: 'A' | 'B' | 'C' | 'Rejected';
  qcPhotos?: string[];
  qcDisputeReason?: string;
  invoiceNumber?: string;
  ratedFarmer?: boolean;
  ratedBuyer?: boolean;
  createdAt: string;
}

export interface SupplyContract {
  id: string;
  buyerId: string;
  buyerName: string;
  farmerId?: string;
  farmerName?: string;
  crop: string;
  totalQuantityQuintal: number;
  /** Backend contract-farming payload (POST /contracts) — targeted offers. */
  specId?: string;
  quantityTotal?: number;
  priceType?: 'fixed' | 'mandiLinked';
  pricingType?: 'fixed' | 'mandiLinked';
  baseRate?: number;
  baseRatePerQuintal: number;
  premiumPerQuintal?: number;
  mandiName?: string;
  schedule?: { startDate: string; endDate: string; frequency: string; qtyPerDelivery: number };
  deliveryLocation?: string;
  termsText?: string;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'one-time';
  paymentTermsDays: number;
  status: 'offered' | 'active' | 'completed' | 'declined' | 'open';
  signedByFarmer: boolean;
  signedAt?: string;
  createdAt: string;
}

/** Vehicle rate-card entry from GET /transport/vehicles (`vehicle_catalog`). */
export interface VehicleCatalogEntry {
  type: string;
  baseFare: number;
  perKmRate: number;
  capacityTonnes: number;
}

export interface TransportVehicle {
  id: string;
  transporterId: string;
  transporterName: string;
  transporterPhone: string;
  /** Catalog vehicle type (a `vehicle_catalog` entry name). */
  vehicleType: string;
  registrationNumber: string;
  capacityTons: number;
  baseFare: number;
  ratePerKm: number;
  currentLocation: string;
  available: boolean;
  /** Backend (owner fleet) aliases — transport.py returns these on /transport/vehicles/my. */
  registrationNo?: string;
  capacityTonnes?: number;
  docStatus?: string;
  docReview?: string;
  rejectionReason?: string | null;
  rcDocUrl?: string | null;
  insuranceDocUrl?: string | null;
  pucExpiry?: string | null;
  permitExpiry?: string | null;
  fitnessExpiry?: string | null;
  insuranceExpiry?: string | null;
  photoUrl?: string | null;
  permitType?: string;
  driverName?: string | null;
  driverPhone?: string | null;
  availableNow?: boolean;
  /** Free days marked on the fleet calendar (YYYY-MM-DD) — the load-board
   * apply gate checks this (plus availableNow) against the pickup date. */
  availableDates?: string[];
  active?: boolean;
  ownerId?: string;
  perKmRate?: number | null;
}

export interface TransportBooking {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  transporterId?: string;
  transporterName?: string;
  vehicleType: string;
  pickupAddress: string;
  dropAddress: string;
  distanceKm: number;
  cargoCrop: string;
  cargoWeightQuintal: number;
  pickupTime: string;
  timeWindowMinutes: number;
  insuranceOptIn: boolean;
  declaredValuePaisa?: number;
  insurancePremiumPaisa?: number;
  estimatedFare: number;
  waitingHours: number;
  waitingChargePaisa: number;
  /** Backend state machine (transport.py): booker cancels while `requested`. */
  status:
    | 'requested'
    | 'accepted'
    | 'arrivedPickup'
    | 'loading'
    | 'enRoute'
    | 'reachedDestination'
    | 'unloading'
    | 'delivered'
    | 'cancelled';
  shareToken?: string;
  currentLat?: number;
  currentLng?: number;
  biltyNumber?: string;
  createdAt: string;
  /** Backend booking-doc aliases — transport.py stores pickup/drop/commodity/fare. */
  pickup?: string;
  drop?: string;
  commodity?: string;
  weightQuintals?: number;
  fare?: number;
  /** Locked-in negotiated fare (set when a booking offer is accepted). */
  farePaise?: number;
  date?: string;
  vehicleId?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  userId?: string;
  /** Negotiation round counter; bumped per offer/counter on this booking. */
  offerRound?: number;
  /** Set when the farmer cancels — shown in the cancelled banner. */
  cancellationReason?: string;
  cancelledBy?: string;
  /** Original trip id when this booking was created via one-tap rebook. */
  rebookOf?: string;
  /** Option C direct request: preset transporter + direct-connect consent. */
  requestKind?: 'open' | 'direct';
  contactReveal?: {
    farmer?: { name?: string; phone?: string; phoneDigits?: string; whatsappDigits?: string };
    transporter?: { name?: string; phone?: string; phoneDigits?: string; whatsappDigits?: string };
    revealedAt?: string;
  };
  consent?: {
    termsAccepted?: boolean;
    termsVersion?: string;
    acceptedAt?: string;
    acceptedBy?: string;
    contactRevealedAt?: string;
  };
  waypointsLog?: { waypoint?: string; label?: string; time?: string }[];
  /** Instant-booking pinned coordinates (transport.py pickupGeo/dropGeo). */
  pickupGeo?: { lat: number; lng: number } | null;
  dropGeo?: { lat: number; lng: number } | null;
  /** Coordinate aliases on legacy booking docs. */
  pickupCoords?: { lat: number; lng: number } | null;
  dropCoords?: { lat: number; lng: number } | null;
  pod?: { photos?: string[]; receiverName?: string; receiverPhone?: string; damageNotes?: string; deliveredAt?: string };
  podOtp?: { verifiedAt?: string };
}

/** Diary entry kinds — matches backend DiaryEntryIn.type (SR 12 breadth). */
export type DiaryEntryType =
  | 'income'
  | 'expense'
  | 'farmActivity'
  | 'transport'
  | 'equipment'
  | 'lesson'
  | 'order'
  | 'household';

/** Buy/sell tag for trade entries (mandi purchases, produce sales…). */
export type DiaryTradeType = 'buy' | 'sell';

export interface FarmDiaryEntry {
  id: string;
  date: string;
  type: DiaryEntryType;
  /** Legacy crop label kept for backward compatibility with older rows. */
  crop: string;
  /** Free-form category; per-type option lists live in FarmDiaryView. */
  category: string;
  amount: number;
  quantity?: number;
  unit?: string;
  notes?: string;
  /** Backend DiaryEntryIn.title — the short label shown in reports. */
  title?: string;
  /** Crop name recorded on the entry (backend cropName). */
  cropName?: string;
  /** Counterparty — who paid / who was paid (trade entries). */
  party?: string;
  tradeType?: DiaryTradeType;
  photos?: string[];
}

export interface EquipmentMachine {
  id: string;
  ownerId: string;
  ownerName: string;
  /** Never present in public discovery responses (spec §6). */
  ownerPhone?: string;
  name: string;
  /** Free-form — the served listings are the single source of truth for the
   * equipment catalog (spec §5); no hard-coded mirror list. */
  type: string;
  ratePerHour: number;
  ratePerDay?: number;
  location: string;
  specs: string;
  available: boolean;
  imageUrl?: string;
}

export interface EquipmentSlotBooking {
  id: string;
  machineId: string;
  machineName: string;
  farmerId: string;
  farmerName: string;
  date: string;
  timeSlot: string;
  hours: number;
  totalCost: number;
  status: 'pending' | 'confirmed' | 'inProgress' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface LoanApplication {
  id: string;
  farmerId: string;
  farmerName: string;
  loanType: 'Kisan Credit Card (KCC)' | 'Crop Loan' | 'Farm Mechanization' | 'Dairy & Animal Husbandry';
  amountRequested: number;
  tenureMonths: number;
  landRecordId: string;
  creditScore: number;
  status: 'under_review' | 'document_verification' | 'appraisal' | 'approved' | 'disbursed' | 'rejected';
  rejectionReason?: string;
  appliedDate: string;
}

export interface CropInsuranceClaim {
  id: string;
  farmerId: string;
  farmerName: string;
  policyNumber: string;
  crop: string;
  surveyNumber: string;
  calamityType: 'Drought' | 'Excess Rainfall / Flood' | 'Hailstorm' | 'Pest Attack' | 'Unseasonal Frost';
  calamityDate: string;
  damagePercentage: number;
  estimatedLossAmount: number;
  status: 'intimated' | 'surveyor_assigned' | 'survey_completed' | 'dbt_approved' | 'settled' | 'rejected';
  photos: string[];
  createdAt: string;
}

export interface LandRecord712 {
  id: string;
  state: string;
  district: string;
  taluka: string;
  village: string;
  surveyNumber: string;
  subDivision: string;
  ownerName: string;
  totalAreaHa: number;
  cultivableAreaHa: number;
  cropsRegistered: string[];
  isVerified: boolean;
  boundaryGeoJson?: string;
}

export interface LandLeaseListing {
  id: string;
  landlordId: string;
  landlordName: string;
  /** Never present in public discovery responses (spec §7/§19). */
  landlordPhone?: string;
  title?: string;
  surveyNumber?: string;
  village: string;
  district: string;
  acres?: number;
  soilType?: string;
  /** Free-form — served listings are the single source of truth (spec §5). */
  waterSource?: string;
  annualRent?: number;
  tenureYears?: number;
  terms?: string;
  status: string;
  createdAt?: string;
  /** Backend (land.py / land_ops.py) aliases — listings are stored with these fields. */
  lat?: number;
  lng?: number;
  areaAcres?: number;
  expectedRentRupees?: number;
  plotId?: string | null;
  gatNumber?: string | null;
  availability?: { fromDate: string; toDate: string; status: string }[];
  viewsCount?: number;
  photos?: { id?: string; url: string; caption?: string }[] | string[];
  /** Direct-connect additions (spec §5/§6). */
  taluka?: string;
  state?: string;
  irrigated?: boolean | null;
  rentUnit?: string;
  availableFrom?: string | null;
  minDurationMonths?: number | null;
  maxDurationMonths?: number | null;
  permittedCrops?: string | null;
  notes?: string | null;
  landDocumentsStatus?: string;
  landlordVerified?: boolean;
  landVerified?: boolean;
}

export interface LeaseNegotiation {
  id: string;
  listingId: string;
  landlordId: string;
  farmerId: string;
  farmerName: string;
  offeredAnnualRent: number;
  proposedYears: number;
  round: number; // Max 5 rounds for lease negotiation
  status: 'pending' | 'countered' | 'accepted' | 'declined';
  lastMessage?: string;
  updatedAt: string;
}

export interface MilkCollectionSlip {
  id: string;
  date: string;
  shift: 'morning' | 'evening';
  memberId: string;
  memberName: string;
  animalType: 'Cow' | 'Buffalo';
  quantityLiters: number;
  fatPercent: number;
  snfPercent: number;
  ratePerLiter: number;
  totalAmount: number;
  printedAt: string;
}

export interface GaushalaDonation {
  id: string;
  donorName: string;
  donorPan: string;
  amount: number;
  category: 'Cattle Feed' | 'Medical Care' | 'Infrastructure' | 'Cow Adoption (Gau Gras)';
  paymentMethod: 'UPI' | 'NetBanking' | 'Card';
  receiptNumber80G: string;
  date: string;
  taxExemptionClaimed: boolean;
}

export interface MallProduct {
  id: string;
  title: string;
  category: 'Seeds' | 'Fertilizers' | 'Crop Protection' | 'Tools & Machinery' | 'Organic Produce' | 'Cattle Feed';
  brand: string;
  price: number;
  mrp: number;
  rating: number;
  ratingCount: number;
  stockQty: number;
  unit: string;
  imageUrl: string;
  sellerName: string;
  description: string;
  specifications: Record<string, string>;
}

export interface CartItem {
  product: MallProduct;
  quantity: number;
}

export interface MallOrder {
  id: string;
  customerId: string;
  customerName: string;
  shippingAddress: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  paymentMethod: 'COD' | 'UPI' | 'Card';
  paymentStatus: 'paid' | 'pending';
  orderStatus: 'placed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  placedAt: string;
}

export interface CourseItem {
  id: string;
  title: string;
  instructorName: string;
  category: 'Modern Farming' | 'Organic Agriculture' | 'Dairy Tech' | 'Hydroponics' | 'Agri-Business' | string;
  durationHours: number;
  lessonsCount: number;
  enrolledStudents: number;
  rating: number;
  price: number;
  isFree: boolean;
  thumbnailUrl: string;
  description: string;
  // --- Farmer–Instructor workflow fields ---
  priceRupees?: number;
  currency?: string;
  accessType?: 'free' | 'paid' | 'manualOffPlatform' | string;
  hasAccess?: boolean;
  isPurchased?: boolean;
  learningStatus?: 'notStarted' | 'inProgress' | 'completed' | string;
  instructorId?: string;
  instructorIdentityVerified?: boolean;
  instructorExpertiseVerified?: boolean;
  instructorCredentials?: { type: string; verifiedAt?: string }[];
  lessonCount?: number;
  durationMinutes?: number;
  modules?: {
    id: string;
    title: string;
    order: number;
    lessons: {
      id: string;
      title: string;
      kind: string;
      durationMinutes: number;
      order: number;
      isPreviewFree?: boolean;
      mediaUrl?: string | null;
    }[];
  }[];
  access?: {
    accessType?: string | null;
    accessStatus?: string;
    learningStatus?: string;
    progressPercent?: number;
    isCompleted?: boolean;
    isRevoked?: boolean;
  };
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'trade' | 'transport' | 'payment' | 'mandi' | 'advisory' | 'system';
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
}

export interface ExportVerificationSummary {
  exporterId?: string;
  farmerId?: string;
  name: string;
  companyName?: string;
  village?: string;
  district?: string;
  state?: string;
  /** Legacy browse alias — true only when exporter business docs (IEC/APEDA/GST) were reviewed. */
  verified: boolean;
  kycStatus?: string | null;
  /** Unified-KYC identity verification — never inferred from business docs. */
  identityVerified: boolean;
  /** Exporter business docs actually reviewed — never inferred from identity KYC. */
  businessVerified: boolean;
}

export interface ExportRfq {
  id: string;
  exporterId: string;
  crop: string;
  variety?: string | null;
  gradeSpec?: string | null;
  quantityQuintals: number;
  quantityUnit?: string | null;
  maxRatePerQuintal?: number | null;
  packing?: string | null;
  deliveryWindow: { from: string; to: string };
  deliveryLocation: string;
  paymentTermsDays: number;
  notes?: string | null;
  partialQuantityAllowed?: boolean;
  multiFarmerAllowed?: boolean;
  moistureRequirement?: string | null;
  sizeSpec?: string | null;
  qualityParams?: string | null;
  residueRequirements?: string | null;
  requiredCertifications?: string[];
  inspectionRequirements?: string | null;
  sampleRequirements?: string | null;
  rejectionConditions?: string | null;
  requirementDocuments?: { name: string; url: string }[];
  packagingRequirements?: string | null;
  labellingRequirements?: string | null;
  shipmentWindow?: string | null;
  targetPrice?: number | null;
  currency?: string | null;
  priceBasis?: string | null;
  destinationCountry?: string | null;
  requiredExportDocuments?: string[];
  buyerNotes?: string | null;
  status: 'draft' | 'open' | 'paused' | 'closed' | 'fulfilled' | string;
  fulfilledQuintals?: number;
  quoteCount?: number;
  applicationsCount?: number;
  applicationsReceived?: boolean;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string | null;
  exporter?: ExportVerificationSummary;
  /** Farmer opportunity detail extras (GET /opportunities/{id}). */
  termsText?: string;
  myApplicationId?: string | null;
}

export type ExportApplicationStatus =
  | 'submitted'
  | 'contacted'
  | 'dealDone'
  | 'dismissed'
  | 'withdrawn'
  | 'rejected'
  | 'accepted'
  | 'pending';

export interface ExportApplicationDocument {
  id: string;
  docType?: string;
  fileName?: string;
  /** True only when the document was actually reviewed — never from upload alone. */
  verified: boolean;
}

export interface ExportApplicationContact {
  name: string;
  fullName: string;
  village?: string;
  district?: string;
  state?: string;
  phone: string;
  phoneDigits?: string | null;
  whatsappDigits?: string | null;
}

export interface ExportContactReveal {
  farmer: ExportApplicationContact;
  exporter: ExportApplicationContact;
  revealedAt: string;
}

export interface ExportApplication {
  id: string;
  rfqId: string;
  exporterId: string;
  sellerId: string;
  sellerName?: string;
  applicantRole?: string;
  status: ExportApplicationStatus;
  quantityOffered: number;
  quantityUnit: string;
  price: number;
  priceUnit: string;
  currency: string;
  supplyBasis: 'farmGate' | 'collectionCentre' | 'mandi' | 'other';
  availableDate: string;
  supplyLocation: string;
  qualityDetails?: string | null;
  certificationNames?: string[];
  documents?: ExportApplicationDocument[];
  residueTestRefs?: string[];
  photos?: string[];
  packagingCapability?: string | null;
  previousExperience?: string | null;
  message?: string | null;
  sourceLotId?: string | null;
  sourceLot?: {
    id: string;
    crop?: string;
    quantityQuintals?: number;
    location?: unknown;
    harvestDate?: string;
    photos?: string[];
  } | null;
  contactReveal?: ExportContactReveal | null;
  exporterConsent?: {
    termsVersion: string;
    termsAcceptedAt: string;
    mpinVerified: boolean;
    contactRevealedAt: string;
    method?: string;
  };
  farmerConsent?: { termsVersion: string; acceptedAt: string };
  outcome?: {
    value: 'stillInContact' | 'dealDoneOffline' | 'didNotHappen' | 'withdrawn';
    reportedBy: string;
    reportedAt: string;
    dealDetails?: {
      finalQuantity?: number;
      finalQuantityUnit?: string;
      finalPrice?: number;
      finalPriceUnit?: string;
      finalCurrency?: string;
      supplyDate?: string;
      collectionLocation?: string;
    } | null;
  } | null;
  chatRoomId?: string;
  rfq?: {
    id?: string;
    crop?: string;
    variety?: string | null;
    quantityQuintals?: number;
    quantityUnit?: string | null;
    deliveryLocation?: string;
    deliveryWindow?: { from: string; to: string };
    status?: string;
    destinationCountry?: string | null;
  };
  exporter?: ExportVerificationSummary;
  farmer?: ExportVerificationSummary;
  termsText?: string;
  negotiationChecklist?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface ExportQuote {
  id: string;
  rfqId: string;
  sellerId: string;
  sellerName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface ExportOrder {
  id: string;
  rfqId?: string;
  quoteId?: string;
  exporterId: string;
  sellerId: string;
  sellerName?: string;
  commodity: string;
  variety?: string;
  quantityMt: number;
  pricePerMtUsd: number;
  totalAmountUsd: number;
  incoterm: string;
  destinationCountry: string;
  destinationPort: string;
  originPort: string;
  status:
    | 'confirmed'
    | 'sourcing'
    | 'packed'
    | 'pickedUp'
    | 'inTransit'
    | 'customsCleared'
    | 'shipped'
    | 'delivered'
    | 'cancelled';
  shipmentDetails?: {
    containerNumber?: string;
    vesselName?: string;
    voyageNumber?: string;
    blNumber?: string;
    etd?: string;
    eta?: string;
  };
  lcDetails?: {
    lcNumber?: string;
    issuingBank?: string;
    amountUsd?: number;
    expiryDate?: string;
    status?: 'draft' | 'opened' | 'accepted' | 'negotiated';
  };
  documents?: {
    id: string;
    docType: string;
    title: string;
    fileUrl: string;
    verified: boolean;
    issuedAt?: string;
  }[];
  createdAt: string;
}
