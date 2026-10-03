// Tree Plantation models — fields match GET /v1/tree/articles, /v1/tree/ngos,
// /v1/tree/biofuel, /v1/tree/care-guides exactly. Vernacular getters keep the
// ported prototype template unchanged (seeds carry vernacular text inline).

class TreeArticle {
  final String id;
  final String title;
  final String category;
  final String author;
  final String readTime;
  final String summary;
  final String fullContent;
  final String benefits;
  final String publishedDate;

  const TreeArticle({
    required this.id,
    required this.title,
    required this.category,
    required this.author,
    required this.readTime,
    required this.summary,
    required this.fullContent,
    required this.benefits,
    required this.publishedDate,
  });

  String get vernacularTitle => title;

  factory TreeArticle.fromJson(Map<String, dynamic> json) => TreeArticle(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        category: json['category'] as String? ?? '',
        author: json['author'] as String? ?? '',
        readTime: json['readTime'] as String? ?? '',
        summary: json['summary'] as String? ?? '',
        fullContent: json['fullContent'] as String? ?? '',
        benefits: json['benefits'] as String? ?? '',
        publishedDate: json['publishedDate'] as String? ?? '',
      );
}

class NgoOrganization {
  final String id;
  final String name;
  final String focusArea;
  final String location;
  final String contactPhone;
  final String email;
  final int treesPlantedCount;
  final double rating;
  final List<String> servicesOffered;
  final bool providesFreeSaplings;
  final String websiteUrl;

  const NgoOrganization({
    required this.id,
    required this.name,
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

  String get vernacularName => name;

  factory NgoOrganization.fromJson(Map<String, dynamic> json) =>
      NgoOrganization(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        focusArea: json['focusArea'] as String? ?? '',
        location: json['location'] as String? ?? '',
        contactPhone: json['contactPhone'] as String? ?? '',
        email: json['email'] as String? ?? '',
        treesPlantedCount: (json['treesPlantedCount'] as num?)?.toInt() ?? 0,
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        servicesOffered:
            ((json['servicesOffered'] as List?) ?? const <dynamic>[])
                .map((e) => "$e")
                .toList(),
        providesFreeSaplings: json['providesFreeSaplings'] == true,
        websiteUrl: json['websiteUrl'] as String? ?? '',
      );
}

class BiofuelTree {
  final String id;
  final String name;
  final String botanicalName;
  final String oilContentPercent;
  final String gestationPeriod;
  final String expectedReturnPerAcre;
  final String suitability;
  final String uses;
  final String buyerMarket;
  final String subsidyScheme;

  const BiofuelTree({
    required this.id,
    required this.name,
    required this.botanicalName,
    required this.oilContentPercent,
    required this.gestationPeriod,
    required this.expectedReturnPerAcre,
    required this.suitability,
    required this.uses,
    required this.buyerMarket,
    required this.subsidyScheme,
  });

  String get vernacularName => uses;

  factory BiofuelTree.fromJson(Map<String, dynamic> json) => BiofuelTree(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        botanicalName: json['botanicalName'] as String? ?? '',
        oilContentPercent: json['oilContentPercent'] as String? ?? '',
        gestationPeriod: json['gestationPeriod'] as String? ?? '',
        expectedReturnPerAcre: json['expectedReturnPerAcre'] as String? ?? '',
        suitability: json['suitability'] as String? ?? '',
        uses: json['uses'] as String? ?? '',
        buyerMarket: json['buyerMarket'] as String? ?? '',
        subsidyScheme: json['subsidyScheme'] as String? ?? '',
      );
}

class TreeCareGuide {
  final String id;
  final String title;
  final int stepNumber;
  final String stage;
  final String instructions;
  final String wateringRule;
  final String fertilizerSchedule;
  final String pestProtection;

  const TreeCareGuide({
    required this.id,
    required this.title,
    required this.stepNumber,
    required this.stage,
    required this.instructions,
    required this.wateringRule,
    required this.fertilizerSchedule,
    required this.pestProtection,
  });

  String get vernacularTitle => title;

  factory TreeCareGuide.fromJson(Map<String, dynamic> json) => TreeCareGuide(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        stepNumber: (json['stepNumber'] as num?)?.toInt() ?? 0,
        stage: json['stage'] as String? ?? '',
        instructions: json['instructions'] as String? ?? '',
        wateringRule: json['wateringRule'] as String? ?? '',
        fertilizerSchedule: json['fertilizerSchedule'] as String? ?? '',
        pestProtection: json['pestProtection'] as String? ?? '',
      );
}

class PlantationLogEntry {
  final String id;
  final String plantationId;
  final double heightCm;
  final double girthCm;
  final int survivalCount;
  final String healthStatus;
  final String notes;
  final String photoUrl;
  final String auditDate;
  final String loggedAt;

  const PlantationLogEntry({
    required this.id,
    required this.plantationId,
    required this.heightCm,
    required this.girthCm,
    required this.survivalCount,
    required this.healthStatus,
    required this.notes,
    required this.photoUrl,
    required this.auditDate,
    required this.loggedAt,
  });

  factory PlantationLogEntry.fromJson(Map<String, dynamic> json) =>
      PlantationLogEntry(
        id: json['id'] as String? ?? '',
        plantationId: json['plantationId'] as String? ?? '',
        heightCm: (json['heightCm'] as num?)?.toDouble() ?? 0.0,
        girthCm: (json['girthCm'] as num?)?.toDouble() ?? 0.0,
        survivalCount: (json['survivalCount'] as num?)?.toInt() ?? 0,
        healthStatus: json['healthStatus'] as String? ?? 'healthy',
        notes: json['notes'] as String? ?? '',
        photoUrl: json['photoUrl'] as String? ?? '',
        auditDate: json['auditDate'] as String? ?? '',
        loggedAt: json['loggedAt'] as String? ?? '',
      );
}

class TreePlantation {
  final String id;
  final String farmerId;
  final String farmerName;
  final String parcelName;
  final String treeSpecies;
  final String vernacularSpecies;
  final int treeCount;
  final String plantingDate;
  final String landType;
  final double latitude;
  final double longitude;
  final double initialHeightCm;
  final String photoUrl;
  final String irrigationType;
  final String status;
  final double survivalRate;
  final double currentAvgHeightCm;
  final double estimatedCo2KgPerYear;
  final int logsCount;
  final String createdAt;
  final List<PlantationLogEntry> logs;

  const TreePlantation({
    required this.id,
    required this.farmerId,
    required this.farmerName,
    required this.parcelName,
    required this.treeSpecies,
    required this.vernacularSpecies,
    required this.treeCount,
    required this.plantingDate,
    required this.landType,
    required this.latitude,
    required this.longitude,
    required this.initialHeightCm,
    required this.photoUrl,
    required this.irrigationType,
    required this.status,
    required this.survivalRate,
    required this.currentAvgHeightCm,
    required this.estimatedCo2KgPerYear,
    required this.logsCount,
    required this.createdAt,
    this.logs = const [],
  });

  factory TreePlantation.fromJson(Map<String, dynamic> json) => TreePlantation(
        id: json['id'] as String? ?? '',
        farmerId: json['farmerId'] as String? ?? '',
        farmerName: json['farmerName'] as String? ?? '',
        parcelName: json['parcelName'] as String? ?? '',
        treeSpecies: json['treeSpecies'] as String? ?? '',
        vernacularSpecies: json['vernacularSpecies'] as String? ?? '',
        treeCount: (json['treeCount'] as num?)?.toInt() ?? 0,
        plantingDate: json['plantingDate'] as String? ?? '',
        landType: json['landType'] as String? ?? 'bund',
        latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
        longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
        initialHeightCm: (json['initialHeightCm'] as num?)?.toDouble() ?? 30.0,
        photoUrl: json['photoUrl'] as String? ?? '',
        irrigationType: json['irrigationType'] as String? ?? 'drip',
        status: json['status'] as String? ?? 'active',
        survivalRate: (json['survivalRate'] as num?)?.toDouble() ?? 100.0,
        currentAvgHeightCm:
            (json['currentAvgHeightCm'] as num?)?.toDouble() ?? 30.0,
        estimatedCo2KgPerYear:
            (json['estimatedCo2KgPerYear'] as num?)?.toDouble() ?? 0.0,
        logsCount: (json['logsCount'] as num?)?.toInt() ?? 0,
        createdAt: json['createdAt'] as String? ?? '',
        logs: ((json['logs'] as List?) ?? const <dynamic>[])
            .map((e) =>
                PlantationLogEntry.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );
}

class CarbonEstimate {
  final String treeSpecies;
  final int treeCount;
  final int ageYears;
  final double co2PerTreePerYearKg;
  final double annualCo2Kg;
  final double tenYearCo2Kg;
  final double carbonCredits10Yr;
  final double estimatedEarningsInr;
  final String formulaExplanation;

  const CarbonEstimate({
    required this.treeSpecies,
    required this.treeCount,
    required this.ageYears,
    required this.co2PerTreePerYearKg,
    required this.annualCo2Kg,
    required this.tenYearCo2Kg,
    required this.carbonCredits10Yr,
    required this.estimatedEarningsInr,
    required this.formulaExplanation,
  });

  factory CarbonEstimate.fromJson(Map<String, dynamic> json) => CarbonEstimate(
        treeSpecies: json['treeSpecies'] as String? ?? '',
        treeCount: (json['treeCount'] as num?)?.toInt() ?? 0,
        ageYears: (json['ageYears'] as num?)?.toInt() ?? 1,
        co2PerTreePerYearKg:
            (json['co2PerTreePerYearKg'] as num?)?.toDouble() ?? 20.0,
        annualCo2Kg: (json['annualCo2Kg'] as num?)?.toDouble() ?? 0.0,
        tenYearCo2Kg: (json['tenYearCo2Kg'] as num?)?.toDouble() ?? 0.0,
        carbonCredits10Yr:
            (json['carbonCredits10Yr'] as num?)?.toDouble() ?? 0.0,
        estimatedEarningsInr:
            (json['estimatedEarningsInr'] as num?)?.toDouble() ?? 0.0,
        formulaExplanation: json['formulaExplanation'] as String? ?? '',
      );
}

class AgroforestryScheme {
  final String id;
  final String name;
  final String vernacularName;
  final String department;
  final String subsidyAmount;
  final String eligibility;
  final List<String> documentsRequired;
  final String applicationProcess;
  final String portalUrl;
  final String status;

  const AgroforestryScheme({
    required this.id,
    required this.name,
    required this.vernacularName,
    required this.department,
    required this.subsidyAmount,
    required this.eligibility,
    required this.documentsRequired,
    required this.applicationProcess,
    required this.portalUrl,
    required this.status,
  });

  factory AgroforestryScheme.fromJson(Map<String, dynamic> json) =>
      AgroforestryScheme(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        vernacularName: json['vernacularName'] as String? ?? '',
        department: json['department'] as String? ?? '',
        subsidyAmount: json['subsidyAmount'] as String? ?? '',
        eligibility: json['eligibility'] as String? ?? '',
        documentsRequired:
            ((json['documentsRequired'] as List?) ?? const <dynamic>[])
                .map((e) => "$e")
                .toList(),
        applicationProcess: json['applicationProcess'] as String? ?? '',
        portalUrl: json['portalUrl'] as String? ?? '',
        status: json['status'] as String? ?? 'active',
      );
}

class SpeciesRecommendation {
  final String id;
  final String name;
  final String vernacularName;
  final int suitabilityScore;
  final String recommendedSpacing;
  final String gestationYears;
  final String expectedAnnualRevenue;
  final String carbonPotential;
  final String careSummary;

  const SpeciesRecommendation({
    required this.id,
    required this.name,
    required this.vernacularName,
    required this.suitabilityScore,
    required this.recommendedSpacing,
    required this.gestationYears,
    required this.expectedAnnualRevenue,
    required this.carbonPotential,
    required this.careSummary,
  });

  factory SpeciesRecommendation.fromJson(Map<String, dynamic> json) =>
      SpeciesRecommendation(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        vernacularName: json['vernacularName'] as String? ?? '',
        suitabilityScore: (json['suitabilityScore'] as num?)?.toInt() ?? 0,
        recommendedSpacing: json['recommendedSpacing'] as String? ?? '',
        gestationYears: json['gestationYears'] as String? ?? '',
        expectedAnnualRevenue: json['expectedAnnualRevenue'] as String? ?? '',
        carbonPotential: json['carbonPotential'] as String? ?? '',
        careSummary: json['careSummary'] as String? ?? '',
      );
}

class TreeAdoption {
  final String id;
  final String farmerId;
  final String sponsorName;
  final String csrPartner;
  final String treeSpecies;
  final int treesSponsored;
  final int fundsGranted;
  final int survivalBonusInr;
  final String adoptionDate;
  final String status;

  const TreeAdoption({
    required this.id,
    required this.farmerId,
    required this.sponsorName,
    required this.csrPartner,
    required this.treeSpecies,
    required this.treesSponsored,
    required this.fundsGranted,
    required this.survivalBonusInr,
    required this.adoptionDate,
    required this.status,
  });

  factory TreeAdoption.fromJson(Map<String, dynamic> json) => TreeAdoption(
        id: json['id'] as String? ?? '',
        farmerId: json['farmerId'] as String? ?? '',
        sponsorName: json['sponsorName'] as String? ?? '',
        csrPartner: json['csrPartner'] as String? ?? '',
        treeSpecies: json['treeSpecies'] as String? ?? '',
        treesSponsored: (json['treesSponsored'] as num?)?.toInt() ?? 0,
        fundsGranted: (json['fundsGranted'] as num?)?.toInt() ?? 0,
        survivalBonusInr: (json['survivalBonusInr'] as num?)?.toInt() ?? 0,
        adoptionDate: json['adoptionDate'] as String? ?? '',
        status: json['status'] as String? ?? 'active',
      );
}

