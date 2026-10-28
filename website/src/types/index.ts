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

export interface BuyerDemand {
  id: string;
  buyerId: string;
  buyerName: string;
  companyName: string;
  crop: string;
  variety?: string;
  requiredQuantityQuintal: number;
  maxPricePerQuintal: number;
  deliveryLocation: string;
  state: string;
  district: string;
  qualitySpecs: string;
  status: 'open' | 'fulfilled' | 'closed';
  validUntil: string;
  createdAt: string;
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
  ownerPhone: string;
  name: string;
  type: 'Tractor' | 'Rotavator' | 'Harvester' | 'Sprayer Drone' | 'Thresher' | 'Seed Drill';
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
  landlordPhone: string;
  title: string;
  surveyNumber: string;
  village: string;
  district: string;
  acres: number;
  soilType: string;
  waterSource: 'Borewell' | 'Canal' | 'Open Well' | 'Rainfed';
  annualRent: number;
  tenureYears: number;
  terms: string;
  status: 'open' | 'negotiating' | 'leased' | 'closed';
  createdAt: string;
  /** Backend (land.py / land_ops.py) aliases — listings are stored with these fields. */
  lat?: number;
  lng?: number;
  areaAcres?: number;
  expectedRentRupees?: number;
  plotId?: string | null;
  gatNumber?: string | null;
  availability?: { fromDate: string; toDate: string; status: string }[];
  viewsCount?: number;
  photos?: { id?: string; url: string; caption?: string }[];
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
  category: 'Modern Farming' | 'Organic Agriculture' | 'Dairy Tech' | 'Hydroponics' | 'Agri-Business';
  durationHours: number;
  lessonsCount: number;
  enrolledStudents: number;
  rating: number;
  price: number;
  isFree: boolean;
  thumbnailUrl: string;
  description: string;
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

export interface ExportRfq {
  id: string;
  commodity: string;
  variety?: string;
  quantityMt: number;
  targetPriceUsd?: number;
  incoterm: 'CIF' | 'FOB' | 'CFR' | 'EXW';
  destinationCountry: string;
  destinationPort: string;
  originPort?: string;
  packagingSpecs?: string;
  requiredCertifications?: string[];
  inspectionAgency?: string;
  status: 'open' | 'closed' | 'cancelled';
  quotesCount?: number;
  validUntil?: string;
  createdAt: string;
}

export interface ExportQuote {
  id: string;
  rfqId: string;
  sellerId: string;
  sellerName: string;
  pricePerMtUsd: number;
  quantityMt: number;
  incotermOffered: string;
  shipmentLeadDays: number;
  originPort: string;
  packagingOffered: string;
  inspectionOffered: string;
  status: 'pending' | 'accepted' | 'rejected';
  notes?: string;
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
