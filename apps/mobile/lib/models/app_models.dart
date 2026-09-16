// Kisan Setu Data Models for Flutter Super App

class FarmerProfile {
  final String id;
  String name;
  String vernacularName;
  String phone;
  String village;
  String tehsil;
  String district;
  String state;
  double landAreaAcres;
  String soilType;
  String irrigationType;
  int kisanCreditScore;
  String creditTier;
  int krishiRatnaLevel;
  String krishiRatnaTitle;
  int streakDays;
  int agriCoins;
  String bankName;
  int kccLimit;
  List<String> activeCrops;
  List<Map<String, double>> farmBoundaryPoints;

  FarmerProfile({
    required this.id,
    required this.name,
    required this.vernacularName,
    required this.phone,
    required this.village,
    required this.tehsil,
    required this.district,
    required this.state,
    required this.landAreaAcres,
    required this.soilType,
    required this.irrigationType,
    required this.kisanCreditScore,
    required this.creditTier,
    required this.krishiRatnaLevel,
    required this.krishiRatnaTitle,
    required this.streakDays,
    required this.agriCoins,
    required this.bankName,
    required this.kccLimit,
    required this.activeCrops,
    this.farmBoundaryPoints = const [],
  });
}

class CropPandL {
  final String id;
  final String name;
  final String season;
  final String area;
  final int yieldQuintals;
  final int marketAvgRate;
  final int grossRevenue;
  final int totalExpenses;
  final int netProfit;
  final int roiPercent;
  final List<Map<String, dynamic>> expensesBreakdown;

  CropPandL({
    required this.id,
    required this.name,
    required this.season,
    required this.area,
    required this.yieldQuintals,
    required this.marketAvgRate,
    required this.grossRevenue,
    required this.totalExpenses,
    required this.netProfit,
    required this.roiPercent,
    required this.expensesBreakdown,
  });
}

class MandiPrice {
  final String id;
  final String mandiName;
  final double distanceKm;
  final String commodity;
  final String variety;
  final int minPrice;
  final int maxPrice;
  final int modalPrice;
  final int msp;
  final String trend;
  final String changePercent;
  final int arrivalsQuintals;
  final String updatedAt;

  MandiPrice({
    required this.id,
    required this.mandiName,
    required this.distanceKm,
    required this.commodity,
    required this.variety,
    required this.minPrice,
    required this.maxPrice,
    required this.modalPrice,
    required this.msp,
    required this.trend,
    required this.changePercent,
    required this.arrivalsQuintals,
    required this.updatedAt,
  });
}

class PestDisease {
  final String id;
  final String diseaseName;
  final String crop;
  final String pathogen;
  final int confidence;
  final String symptoms;
  final String chemicalTreatment;
  final String organicTreatment;
  final String dosage;
  final String estimatedCost;

  PestDisease({
    required this.id,
    required this.diseaseName,
    required this.crop,
    required this.pathogen,
    required this.confidence,
    required this.symptoms,
    required this.chemicalTreatment,
    required this.organicTreatment,
    required this.dosage,
    required this.estimatedCost,
  });
}

class InputProduct {
  final String id;
  final String title;
  final String vernacularTitle;
  final String category;
  final String brand;
  final double rating;
  final int reviewsCount;
  final String dealerName;
  final double distanceKm;
  final int mrp;
  final int discountedPrice;
  final bool bnplAvailable;
  final String batchNo;
  int quantity;

  InputProduct({
    required this.id,
    required this.title,
    required this.vernacularTitle,
    required this.category,
    required this.brand,
    required this.rating,
    required this.reviewsCount,
    required this.dealerName,
    required this.distanceKm,
    required this.mrp,
    required this.discountedPrice,
    required this.bnplAvailable,
    required this.batchNo,
    this.quantity = 1,
  });
}

class BuyerContract {
  final String id;
  final String buyerCompany;
  final double buyerRating;
  final String crop;
  final int lockedRateQuintal;
  final int mspCurrentRate;
  final String premiumAboveMSP;
  final int minQuantityQuintals;
  final String deliveryLocation;
  final String paymentTerms;
  String status;
  final String contractDuration;

  BuyerContract({
    required this.id,
    required this.buyerCompany,
    required this.buyerRating,
    required this.crop,
    required this.lockedRateQuintal,
    required this.mspCurrentRate,
    required this.premiumAboveMSP,
    required this.minQuantityQuintals,
    required this.deliveryLocation,
    required this.paymentTerms,
    required this.status,
    required this.contractDuration,
  });
}

class GovtScheme {
  final String id;
  final String name;
  final String category;
  final bool eligible;
  final String benefitAmount;
  final List<String> documentsRequired;
  String status;
  final String nextDeadline;
  final String description;

  GovtScheme({
    required this.id,
    required this.name,
    required this.category,
    required this.eligible,
    required this.benefitAmount,
    required this.documentsRequired,
    required this.status,
    required this.nextDeadline,
    required this.description,
  });
}

// Media & Gyan Hub Models

class BlogArticle {
  final String id;
  final String title;
  final String vernacularTitle;
  final String author;
  final String authorRole;
  final String readTimeMinutes;
  final String category;
  final String summary;
  final String content;
  final String publishedDate;
  final int likesCount;
  bool isBookmarked;

  BlogArticle({
    required this.id,
    required this.title,
    required this.vernacularTitle,
    required this.author,
    required this.authorRole,
    required this.readTimeMinutes,
    required this.category,
    required this.summary,
    required this.content,
    required this.publishedDate,
    required this.likesCount,
    this.isBookmarked = false,
  });
}

class VideoGuide {
  final String id;
  final String title;
  final String vernacularTitle;
  final String instructor;
  final String duration;
  final String views;
  final String category;
  final String videoUrl;
  final String summary;
  final List<String> keyPoints;

  VideoGuide({
    required this.id,
    required this.title,
    required this.vernacularTitle,
    required this.instructor,
    required this.duration,
    required this.views,
    required this.category,
    required this.videoUrl,
    required this.summary,
    required this.keyPoints,
  });
}

class ExpertTalk {
  final String id;
  final String expertName;
  final String institution;
  final String topic;
  final String vernacularTopic;
  final String scheduledTime;
  final bool isLive;
  final int registeredCount;
  final String expertAvatar;
  final String description;

  ExpertTalk({
    required this.id,
    required this.expertName,
    required this.institution,
    required this.topic,
    required this.vernacularTopic,
    required this.scheduledTime,
    required this.isLive,
    required this.registeredCount,
    required this.expertAvatar,
    required this.description,
  });
}

// CRD Change 7: Live Vyapari Rate Model
class VyapariRate {
  final String id;
  final String crop;
  final String rateDisplay; // e.g. "₹24/kg"
  final String priceChange; // e.g. "₹2"
  final String changeDir; // 'up', 'down', 'flat'
  final String mandiName; // e.g. "Nashik Mandi"
  final int vyapariCount; // e.g. 3
  final String lastUpdated;

  VyapariRate({
    required this.id,
    required this.crop,
    required this.rateDisplay,
    required this.priceChange,
    required this.changeDir,
    required this.mandiName,
    required this.vyapariCount,
    required this.lastUpdated,
  });
}

// CRD Change 8 & 9: Kisan Mitra Chatbot Message & Advisory Model
class KisanMitraMessage {
  final String id;
  final String sender; // 'bot' | 'user'
  final String text;
  final DateTime timestamp;
  final List<String>? quickReplies;
  final String? richCardType; // 'saturation' | 'weather' | 'mandi' | 'pest'
  final Map<String, dynamic>? richCardData;

  KisanMitraMessage({
    required this.id,
    required this.sender,
    required this.text,
    required this.timestamp,
    this.quickReplies,
    this.richCardType,
    this.richCardData,
  });
}

// CRD Change 10: Time-Slot Based Yantra Equipment Booking Model
class YantraSlot {
  final String id;
  final String equipmentId;
  final String slotName; // e.g. "6:00 AM – 10:00 AM"
  final String duration; // e.g. "4h"
  final String status; // 'available', 'booked', 'pending'
  final String? bookedByName;
  final int priceRupees;
  final String recommendedTask;

  YantraSlot({
    required this.id,
    this.equipmentId = 'eq1',
    required this.slotName,
    required this.duration,
    required this.status,
    this.bookedByName,
    required this.priceRupees,
    required this.recommendedTask,
  });

  String get timeRange => slotName;
  double get price => priceRupees.toDouble();
}

// CRD Change 11: 7/12 Land Record Model
class LandRecord712 {
  final String gatNumber;
  final String village;
  final String district;
  final String ownerName;
  final String khataNumber;
  final double totalAreaHectares;
  final double totalAreaAcres;
  final String landClass;
  final String ferfarNumber;
  final String cropHistory;

  LandRecord712({
    required this.gatNumber,
    required this.village,
    required this.district,
    required this.ownerName,
    required this.khataNumber,
    required this.totalAreaHectares,
    required this.totalAreaAcres,
    required this.landClass,
    required this.ferfarNumber,
    required this.cropHistory,
  });

  double get areaHectares => totalAreaHectares;
  double get areaAcres => totalAreaAcres;
  String get soilType => landClass;
  String get irrigationType => "Bagayati Drip";
}

// ==========================================
// 1. Tree / वृक्षारोपण (Plantation) Models
// ==========================================

class TreeArticle {
  final String id;
  final String title;
  final String vernacularTitle;
  final String category;
  final String author;
  final String readTime;
  final String summary;
  final String fullContent;
  final String benefits;
  final String publishedDate;

  TreeArticle({
    required this.id,
    required this.title,
    required this.vernacularTitle,
    required this.category,
    required this.author,
    required this.readTime,
    required this.summary,
    required this.fullContent,
    required this.benefits,
    required this.publishedDate,
  });
}

class NgoOrganization {
  final String id;
  final String name;
  final String vernacularName;
  final String focusArea;
  final String location;
  final String contactPhone;
  final String email;
  final int treesPlantedCount;
  final double rating;
  final List<String> servicesOffered;
  final bool providesFreeSaplings;
  final String websiteUrl;

  NgoOrganization({
    required this.id,
    required this.name,
    required this.vernacularName,
    required this.focusArea,
    required this.location,
    required this.contactPhone,
    required this.email,
    required this.treesPlantedCount,
    required this.rating,
    required this.servicesOffered,
    required this.providesFreeSaplings,
    required this.websiteUrl,
  });
}

class BiofuelTree {
  final String id;
  final String name;
  final String botanicalName;
  final String vernacularName;
  final String oilContentPercent;
  final String gestationPeriod;
  final String expectedReturnPerAcre;
  final String suitability;
  final String uses;
  final String buyerMarket;
  final String subsidyScheme;

  BiofuelTree({
    required this.id,
    required this.name,
    required this.botanicalName,
    required this.vernacularName,
    required this.oilContentPercent,
    required this.gestationPeriod,
    required this.expectedReturnPerAcre,
    required this.suitability,
    required this.uses,
    required this.buyerMarket,
    required this.subsidyScheme,
  });
}

class TreeCareGuide {
  final String id;
  final String title;
  final String vernacularTitle;
  final String stepNumber;
  final String stage;
  final String instructions;
  final String wateringRule;
  final String fertilizerSchedule;
  final String pestProtection;

  TreeCareGuide({
    required this.id,
    required this.title,
    required this.vernacularTitle,
    required this.stepNumber,
    required this.stage,
    required this.instructions,
    required this.wateringRule,
    required this.fertilizerSchedule,
    required this.pestProtection,
  });
}

// ==========================================
// 2. Farmer Live Channels & Agri News Models
// ==========================================

class AgriLiveChannel {
  final String id;
  final String channelName;
  final String vernacularName;
  final String broadcaster;
  final String programTitle;
  final String vernacularProgram;
  final String currentSpeaker;
  final int liveViewersCount;
  final bool isLiveNow;
  final String category;
  final String streamThumbnail;
  final String streamUrl;
  final String scheduleTime;

  AgriLiveChannel({
    required this.id,
    required this.channelName,
    required this.vernacularName,
    required this.broadcaster,
    required this.programTitle,
    required this.vernacularProgram,
    required this.currentSpeaker,
    required this.liveViewersCount,
    required this.isLiveNow,
    required this.category,
    required this.streamThumbnail,
    required this.streamUrl,
    required this.scheduleTime,
  });
}

class AgriNewsItem {
  final String id;
  final String title;
  final String vernacularTitle;
  final String category;
  final String source;
  final String timestamp;
  final String summary;
  final String content;
  final bool isBreaking;
  final String audioText;
  final String? impactRating;

  AgriNewsItem({
    required this.id,
    required this.title,
    required this.vernacularTitle,
    required this.category,
    required this.source,
    required this.timestamp,
    required this.summary,
    required this.content,
    this.isBreaking = false,
    required this.audioText,
    this.impactRating,
  });
}

// ==========================================
// 3. Livestock & Dairy Ecosystem Models
// ==========================================

class GaushalaItem {
  final String id;
  final String name;
  final String vernacularName;
  final String trustName;
  final String address;
  final String district;
  final double distanceKm;
  final int cowCount;
  final List<String> breeds; // e.g. Gir, Sahiwal, Kankrej
  final String phone;
  final bool providesOrganicManure;
  final bool offersCowAdoption;
  final double rating;
  final String facilities;

  GaushalaItem({
    required this.id,
    required this.name,
    required this.vernacularName,
    required this.trustName,
    required this.address,
    required this.district,
    required this.distanceKm,
    required this.cowCount,
    required this.breeds,
    required this.phone,
    required this.providesOrganicManure,
    required this.offersCowAdoption,
    required this.rating,
    required this.facilities,
  });
}

class PlantNursery {
  final String id;
  final String name;
  final String vernacularName;
  final String ownerName;
  final String location;
  final double distanceKm;
  final String phone;
  final double rating;
  final bool isGovtCertified;
  final List<String> availableSaplings;
  final String priceRange;

  PlantNursery({
    required this.id,
    required this.name,
    required this.vernacularName,
    required this.ownerName,
    required this.location,
    required this.distanceKm,
    required this.phone,
    required this.rating,
    required this.isGovtCertified,
    required this.availableSaplings,
    required this.priceRange,
  });
}

class VetDoctor {
  final String id;
  final String name;
  final String qualification;
  final String specialization;
  final String clinicAddress;
  final double distanceKm;
  final String phone;
  final int experienceYears;
  final double consultationFeeRupees;
  final bool availableForFarmVisit;
  final double rating;
  final String nextAvailableSlot;

  VetDoctor({
    required this.id,
    required this.name,
    required this.qualification,
    required this.specialization,
    required this.clinicAddress,
    required this.distanceKm,
    required this.phone,
    required this.experienceYears,
    required this.consultationFeeRupees,
    required this.availableForFarmVisit,
    required this.rating,
    required this.nextAvailableSlot,
  });
}

class DairyProductItem {
  final String id;
  final String title;
  final String vernacularTitle;
  final String farmName;
  final String category; // A2 Milk, Desi Ghee, Paneer, Butter, Manure
  final double price;
  final String unit;
  final double rating;
  final int reviewsCount;
  final String purityCertification;
  final bool inStock;
  final String description;

  DairyProductItem({
    required this.id,
    required this.title,
    required this.vernacularTitle,
    required this.farmName,
    required this.category,
    required this.price,
    required this.unit,
    required this.rating,
    required this.reviewsCount,
    required this.purityCertification,
    required this.inStock,
    required this.description,
  });
}

// ==========================================
// 4. ज्ञानसेतू (DnyanSetu) Paid Workshops Models
// ==========================================

class PaidWorkshop {
  final String id;
  final String title;
  final String vernacularTitle;
  final String instructor;
  final String instructorRole;
  final String institution;
  final int feeRupees;
  final int coinsDiscountAllowed;
  final String duration;
  final String batchDate;
  final String timing;
  final double rating;
  final int enrolledCount;
  final int totalSeats;
  final bool isCertified;
  final String certificateTitle;
  final List<String> syllabusModules;
  final List<String> deliverables;
  bool isEnrolled;

  PaidWorkshop({
    required this.id,
    required this.title,
    required this.vernacularTitle,
    required this.instructor,
    required this.instructorRole,
    required this.institution,
    required this.feeRupees,
    required this.coinsDiscountAllowed,
    required this.duration,
    required this.batchDate,
    required this.timing,
    required this.rating,
    required this.enrolledCount,
    required this.totalSeats,
    required this.isCertified,
    required this.certificateTitle,
    required this.syllabusModules,
    required this.deliverables,
    this.isEnrolled = false,
  });
}

// ==========================================
// 5. Daily Farm Diary & Refer/Earn Models
// ==========================================

enum FarmDiaryType { expense, income, farmActivity }

class FarmDiaryEntry {
  final String id;
  final String title;
  final String category; // Seeds, Fertilizer, Labor, Mandi Sale, Milk Sale, Irrigation
  final FarmDiaryType type;
  final double amount; // 0 for farmActivity
  final String date;
  final String cropName;
  final String notes;

  FarmDiaryEntry({
    required this.id,
    required this.title,
    required this.category,
    required this.type,
    required this.amount,
    required this.date,
    required this.cropName,
    required this.notes,
  });
}

class ReferralUser {
  final String id;
  final String farmerName;
  final String village;
  final String phone;
  final String joinDate;
  final String status; // 'Joined', 'Verified', 'Active'
  final int rewardCoins;

  ReferralUser({
    required this.id,
    required this.farmerName,
    required this.village,
    required this.phone,
    required this.joinDate,
    required this.status,
    required this.rewardCoins,
  });
}

// ==========================================
// 6. Crop Insurance (फसल बीमा) Models
// ==========================================

enum ClaimStatus {
  intimated,
  surveyorAssigned,
  fieldAssessed,
  dbtApproved,
  disbursed,
  rejected
}

class CropInsurancePolicy {
  final String id;
  final String policyNumber;
  final String schemeName; // e.g., 'PM Fasal Bima Yojana (PMFBY)'
  final String vernacularSchemeName; // 'प्रधानमंत्री फसल बीमा योजना'
  final String cropName;
  final String vernacularCropName;
  final String season; // Kharif 2026, Rabi 2025-26
  final String year;
  final double landAreaAcres;
  final double sumInsured; // in INR
  final double farmerPremium; // in INR (1.5%, 2%, 5%)
  final double govtSubsidy; // in INR
  final String status; // 'Active', 'Under Claim', 'Expired'
  final String insuranceCompany; // 'Agriculture Insurance Company of India (AIC)'
  final String coverageStartDate;
  final String coverageEndDate;
  final String bankName;
  final String kccAccountNo;
  final String certificateUrl;

  CropInsurancePolicy({
    required this.id,
    required this.policyNumber,
    required this.schemeName,
    required this.vernacularSchemeName,
    required this.cropName,
    required this.vernacularCropName,
    required this.season,
    required this.year,
    required this.landAreaAcres,
    required this.sumInsured,
    required this.farmerPremium,
    required this.govtSubsidy,
    required this.status,
    required this.insuranceCompany,
    required this.coverageStartDate,
    required this.coverageEndDate,
    required this.bankName,
    required this.kccAccountNo,
    this.certificateUrl = "https://pmfby.gov.in/certificate",
  });
}

class InsuranceClaimRecord {
  final String id;
  final String claimNumber;
  final String policyId;
  final String cropName;
  final String vernacularCropName;
  final String calamityType; // 'ओलावृष्टि (Hailstorm)', 'सूखा (Drought)', 'जलभराव (Inundation/Flood)', 'बेमौसम बारिश (Unseasonal Rain)', 'कीट प्रकोप (Pest Attack)'
  final String dateOfDamage;
  final int estimatedLossPercent;
  final double requestedAmount;
  final double? approvedAmount;
  final ClaimStatus status;
  final String statusText;
  final String surveyorName;
  final String surveyorPhone;
  final String? surveyorVisitDate;
  final String gpsCoordinates;
  final String village;
  final List<String> damagePhotos;
  final String submittedAt;
  final String? dbtTransactionId;
  final String? bankAccountLast4;

  InsuranceClaimRecord({
    required this.id,
    required this.claimNumber,
    required this.policyId,
    required this.cropName,
    required this.vernacularCropName,
    required this.calamityType,
    required this.dateOfDamage,
    required this.estimatedLossPercent,
    required this.requestedAmount,
    this.approvedAmount,
    required this.status,
    required this.statusText,
    required this.surveyorName,
    required this.surveyorPhone,
    this.surveyorVisitDate,
    required this.gpsCoordinates,
    required this.village,
    this.damagePhotos = const [],
    required this.submittedAt,
    this.dbtTransactionId,
    this.bankAccountLast4,
  });
}

class CropPremiumRate {
  final String id;
  final String cropName;
  final String vernacularCropName;
  final String category; // 'Kharif Foodgrain/Oilseed', 'Rabi Foodgrain', 'Commercial/Horticulture'
  final String season; // 'Kharif', 'Rabi', 'Annual'
  final double sumInsuredPerAcre; // ₹ per acre
  final double farmerSharePercent; // 2.0%, 1.5%, 5.0%
  final double totalActuarialRatePercent; // e.g. 12.5%
  final String cutoffDate;

  CropPremiumRate({
    required this.id,
    required this.cropName,
    required this.vernacularCropName,
    required this.category,
    required this.season,
    required this.sumInsuredPerAcre,
    required this.farmerSharePercent,
    required this.totalActuarialRatePercent,
    required this.cutoffDate,
  });
}



