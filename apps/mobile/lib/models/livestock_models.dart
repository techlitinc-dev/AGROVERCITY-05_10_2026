// Livestock & Dairy models — fields match GET /v1/gaushalas, /v1/nurseries,
// /v1/vets, /v1/dairy-products exactly. Vernacular getters keep the ported
// prototype template unchanged (seeds carry names in the main fields).

class GaushalaItem {
  final String id;
  final String name;
  final String trustName;
  final String address;
  final String district;
  final double distanceKm;
  final int cowCount;
  final List<String> breeds;
  final String phone;
  final bool providesOrganicManure;
  final bool offersCowAdoption;
  final double rating;
  final String facilities;

  const GaushalaItem({
    required this.id,
    required this.name,
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

  String get vernacularName => name;

  factory GaushalaItem.fromJson(Map<String, dynamic> json) => GaushalaItem(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        trustName: json['trustName'] as String? ?? '',
        address: json['address'] as String? ?? '',
        district: json['district'] as String? ?? '',
        distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
        cowCount: (json['cowCount'] as num?)?.toInt() ?? 0,
        breeds: ((json['breeds'] as List?) ?? const <dynamic>[])
            .map((e) => "$e")
            .toList(),
        phone: json['phone'] as String? ?? '',
        providesOrganicManure: json['providesOrganicManure'] == true,
        offersCowAdoption: json['offersCowAdoption'] == true,
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        facilities: json['facilities'] as String? ?? '',
      );
}

class PlantNursery {
  final String id;
  final String name;
  final String ownerName;
  final String location;
  final double distanceKm;
  final String phone;
  final double rating;
  final bool isGovtCertified;
  final List<String> availableSaplings;
  final String priceRange;

  const PlantNursery({
    required this.id,
    required this.name,
    required this.ownerName,
    required this.location,
    required this.distanceKm,
    required this.phone,
    required this.rating,
    required this.isGovtCertified,
    required this.availableSaplings,
    required this.priceRange,
  });

  String get vernacularName => name;

  factory PlantNursery.fromJson(Map<String, dynamic> json) => PlantNursery(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        ownerName: json['ownerName'] as String? ?? '',
        location: json['location'] as String? ?? '',
        distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
        phone: json['phone'] as String? ?? '',
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        isGovtCertified: json['isGovtCertified'] == true,
        availableSaplings:
            ((json['availableSaplings'] as List?) ?? const <dynamic>[])
                .map((e) => "$e")
                .toList(),
        priceRange: json['priceRange'] as String? ?? '',
      );
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
  final int consultationFeeRupees;
  final double rating;
  final bool availableForFarmVisit;
  final bool emergencyAvailable;
  final String nextAvailableSlot;

  const VetDoctor({
    required this.id,
    required this.name,
    required this.qualification,
    required this.specialization,
    required this.clinicAddress,
    required this.distanceKm,
    required this.phone,
    required this.experienceYears,
    required this.consultationFeeRupees,
    required this.rating,
    required this.availableForFarmVisit,
    required this.emergencyAvailable,
    required this.nextAvailableSlot,
  });

  factory VetDoctor.fromJson(Map<String, dynamic> json) => VetDoctor(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        qualification: json['qualification'] as String? ?? '',
        specialization: json['specialization'] as String? ?? '',
        clinicAddress: json['clinicAddress'] as String? ?? '',
        distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
        phone: json['phone'] as String? ?? '',
        experienceYears: (json['experienceYears'] as num?)?.toInt() ?? 0,
        consultationFeeRupees:
            (json['consultationFeeRupees'] as num?)?.toInt() ?? 0,
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        availableForFarmVisit: json['availableForFarmVisit'] == true,
        emergencyAvailable: json['emergencyAvailable'] == true,
        nextAvailableSlot: json['nextAvailableSlot'] as String? ?? '',
      );
}

class DairyProductItem {
  final String id;
  final String title;
  final String farmName;
  final String category;
  final int price;
  final String unit;
  final double rating;
  final int reviewsCount;
  final String purityCertification;
  final bool inStock;
  final String description;

  const DairyProductItem({
    required this.id,
    required this.title,
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

  String get vernacularTitle => title;

  factory DairyProductItem.fromJson(Map<String, dynamic> json) =>
      DairyProductItem(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        farmName: json['farmName'] as String? ?? '',
        category: json['category'] as String? ?? '',
        price: (json['price'] as num?)?.toInt() ?? 0,
        unit: json['unit'] as String? ?? '',
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        reviewsCount: (json['reviewsCount'] as num?)?.toInt() ?? 0,
        purityCertification: json['purityCertification'] as String? ?? '',
        inStock: json['inStock'] == true,
        description: json['description'] as String? ?? '',
      );
}

// -------------------------------------------------------------
// Livestock & Dairy Manager Models (8th User Profile)
// -------------------------------------------------------------

class Animal {
  final String id;
  final String ownerId;
  final String tagId;
  final String name;
  final String species;
  final String breed;
  final String dateOfBirth;
  final String lactationStage;
  final int lactationNumber;
  final double dailyAvgYield;
  final String healthStatus;
  final String? insuranceId;
  final String? photoUrl;
  final String? createdAt;
  final String? updatedAt;

  const Animal({
    required this.id,
    required this.ownerId,
    required this.tagId,
    required this.name,
    required this.species,
    required this.breed,
    required this.dateOfBirth,
    required this.lactationStage,
    required this.lactationNumber,
    required this.dailyAvgYield,
    required this.healthStatus,
    this.insuranceId,
    this.photoUrl,
    this.createdAt,
    this.updatedAt,
  });

  factory Animal.fromJson(Map<String, dynamic> json) => Animal(
        id: json['id'] as String? ?? '',
        ownerId: json['ownerId'] as String? ?? '',
        tagId: json['tagId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        species: json['species'] as String? ?? 'cow',
        breed: json['breed'] as String? ?? '',
        dateOfBirth: json['dateOfBirth'] as String? ?? '',
        lactationStage: json['lactationStage'] as String? ?? 'milking',
        lactationNumber: (json['lactationNumber'] as num?)?.toInt() ?? 0,
        dailyAvgYield: (json['dailyAvgYield'] as num?)?.toDouble() ?? 0.0,
        healthStatus: json['healthStatus'] as String? ?? 'healthy',
        insuranceId: json['insuranceId'] as String?,
        photoUrl: json['photoUrl'] as String?,
        createdAt: json['createdAt'] as String?,
        updatedAt: json['updatedAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'tagId': tagId,
        'name': name,
        'species': species,
        'breed': breed,
        'dateOfBirth': dateOfBirth,
        'lactationStage': lactationStage,
        'lactationNumber': lactationNumber,
        'dailyAvgYield': dailyAvgYield,
        'healthStatus': healthStatus,
        if (insuranceId != null) 'insuranceId': insuranceId,
        if (photoUrl != null) 'photoUrl': photoUrl,
      };
}

class AnimalYieldLog {
  final String id;
  final String animalId;
  final String date;
  final String shift;
  final double quantityLiters;
  final double fatPercentage;
  final double snfPercentage;
  final String? notes;
  final String? createdAt;

  const AnimalYieldLog({
    required this.id,
    required this.animalId,
    required this.date,
    required this.shift,
    required this.quantityLiters,
    required this.fatPercentage,
    required this.snfPercentage,
    this.notes,
    this.createdAt,
  });

  factory AnimalYieldLog.fromJson(Map<String, dynamic> json) => AnimalYieldLog(
        id: json['id'] as String? ?? '',
        animalId: json['animalId'] as String? ?? '',
        date: json['date'] as String? ?? '',
        shift: json['shift'] as String? ?? 'morning',
        quantityLiters: (json['quantityLiters'] as num?)?.toDouble() ?? 0.0,
        fatPercentage: (json['fatPercentage'] as num?)?.toDouble() ?? 0.0,
        snfPercentage: (json['snfPercentage'] as num?)?.toDouble() ?? 0.0,
        notes: json['notes'] as String?,
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'date': date,
        'shift': shift,
        'quantityLiters': quantityLiters,
        'fatPercentage': fatPercentage,
        'snfPercentage': snfPercentage,
        if (notes != null) 'notes': notes,
      };
}

class MilkCollection {
  final String id;
  final String farmerId;
  final String farmerName;
  final String farmerPhone;
  final String date;
  final String shift;
  final String cattleType;
  final double quantityLiters;
  final double fatPercentage;
  final double snfPercentage;
  final double ratePerLiter;
  final double totalPayout;
  final String slipNumber;
  final String paymentStatus;
  final String collectedBy;
  final String? createdAt;

  const MilkCollection({
    required this.id,
    required this.farmerId,
    required this.farmerName,
    required this.farmerPhone,
    required this.date,
    required this.shift,
    required this.cattleType,
    required this.quantityLiters,
    required this.fatPercentage,
    required this.snfPercentage,
    required this.ratePerLiter,
    required this.totalPayout,
    required this.slipNumber,
    required this.paymentStatus,
    required this.collectedBy,
    this.createdAt,
  });

  factory MilkCollection.fromJson(Map<String, dynamic> json) => MilkCollection(
        id: json['id'] as String? ?? '',
        farmerId: json['farmerId'] as String? ?? '',
        farmerName: json['farmerName'] as String? ?? '',
        farmerPhone: json['farmerPhone'] as String? ?? '',
        date: json['date'] as String? ?? '',
        shift: json['shift'] as String? ?? 'morning',
        cattleType: json['cattleType'] as String? ?? 'cow',
        quantityLiters: (json['quantityLiters'] as num?)?.toDouble() ?? 0.0,
        fatPercentage: (json['fatPercentage'] as num?)?.toDouble() ?? 0.0,
        snfPercentage: (json['snfPercentage'] as num?)?.toDouble() ?? 0.0,
        ratePerLiter: (json['ratePerLiter'] as num?)?.toDouble() ?? 0.0,
        totalPayout: (json['totalPayout'] as num?)?.toDouble() ?? 0.0,
        slipNumber: json['slipNumber'] as String? ?? '',
        paymentStatus: json['paymentStatus'] as String? ?? 'pending',
        collectedBy: json['collectedBy'] as String? ?? '',
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'farmerName': farmerName,
        'farmerPhone': farmerPhone,
        'date': date,
        'shift': shift,
        'cattleType': cattleType,
        'quantityLiters': quantityLiters,
        'fatPercentage': fatPercentage,
        'snfPercentage': snfPercentage,
        if (paymentStatus.isNotEmpty) 'paymentStatus': paymentStatus,
      };
}

class RateChartCalcResult {
  final String cattleType;
  final double fatPercentage;
  final double snfPercentage;
  final double quantityLiters;
  final double ratePerLiter;
  final double totalPayout;
  final double baseRate;
  final double fatBonus;
  final double snfBonus;

  const RateChartCalcResult({
    required this.cattleType,
    required this.fatPercentage,
    required this.snfPercentage,
    required this.quantityLiters,
    required this.ratePerLiter,
    required this.totalPayout,
    required this.baseRate,
    required this.fatBonus,
    required this.snfBonus,
  });

  factory RateChartCalcResult.fromJson(Map<String, dynamic> json) =>
      RateChartCalcResult(
        cattleType: json['cattleType'] as String? ?? 'cow',
        fatPercentage: (json['fatPercentage'] as num?)?.toDouble() ?? 0.0,
        snfPercentage: (json['snfPercentage'] as num?)?.toDouble() ?? 0.0,
        quantityLiters: (json['quantityLiters'] as num?)?.toDouble() ?? 0.0,
        ratePerLiter: (json['ratePerLiter'] as num?)?.toDouble() ?? 0.0,
        totalPayout: (json['totalPayout'] as num?)?.toDouble() ?? 0.0,
        baseRate: (json['baseRate'] as num?)?.toDouble() ?? 0.0,
        fatBonus: (json['fatBonus'] as num?)?.toDouble() ?? 0.0,
        snfBonus: (json['snfBonus'] as num?)?.toDouble() ?? 0.0,
      );
}

class MilkProcurementSummary {
  final String date;
  final double totalMorningLiters;
  final double totalEveningLiters;
  final double totalLiters;
  final double averageFat;
  final double averageSnf;
  final double totalPayoutRupees;
  final int farmerCount;
  final int collectionCount;

  const MilkProcurementSummary({
    required this.date,
    required this.totalMorningLiters,
    required this.totalEveningLiters,
    required this.totalLiters,
    required this.averageFat,
    required this.averageSnf,
    required this.totalPayoutRupees,
    required this.farmerCount,
    required this.collectionCount,
  });

  factory MilkProcurementSummary.fromJson(Map<String, dynamic> json) =>
      MilkProcurementSummary(
        date: json['date'] as String? ?? '',
        totalMorningLiters:
            (json['totalMorningLiters'] as num?)?.toDouble() ?? 0.0,
        totalEveningLiters:
            (json['totalEveningLiters'] as num?)?.toDouble() ?? 0.0,
        totalLiters: (json['totalLiters'] as num?)?.toDouble() ?? 0.0,
        averageFat: (json['averageFat'] as num?)?.toDouble() ?? 0.0,
        averageSnf: (json['averageSnf'] as num?)?.toDouble() ?? 0.0,
        totalPayoutRupees:
            (json['totalPayoutRupees'] as num?)?.toDouble() ?? 0.0,
        farmerCount: (json['farmerCount'] as num?)?.toInt() ?? 0,
        collectionCount: (json['collectionCount'] as num?)?.toInt() ?? 0,
      );
}

class BreedingCycle {
  final String id;
  final String animalId;
  final String tagId;
  final String heatDate;
  final String? aiDate;
  final String? bullSemenStrawId;
  final String? technicianName;
  final String? pdDate;
  final String pdStatus;
  final String? expectedCalvingDate;
  final String? calvingDate;
  final String? calvingOutcome;
  final String? notes;
  final String? createdAt;

  const BreedingCycle({
    required this.id,
    required this.animalId,
    required this.tagId,
    required this.heatDate,
    this.aiDate,
    this.bullSemenStrawId,
    this.technicianName,
    this.pdDate,
    required this.pdStatus,
    this.expectedCalvingDate,
    this.calvingDate,
    this.calvingOutcome,
    this.notes,
    this.createdAt,
  });

  factory BreedingCycle.fromJson(Map<String, dynamic> json) => BreedingCycle(
        id: json['id'] as String? ?? '',
        animalId: json['animalId'] as String? ?? '',
        tagId: json['tagId'] as String? ?? '',
        heatDate: json['heatDate'] as String? ?? '',
        aiDate: json['aiDate'] as String?,
        bullSemenStrawId: json['bullSemenStrawId'] as String?,
        technicianName: json['technicianName'] as String?,
        pdDate: json['pdDate'] as String?,
        pdStatus: json['pdStatus'] as String? ?? 'pending',
        expectedCalvingDate: json['expectedCalvingDate'] as String?,
        calvingDate: json['calvingDate'] as String?,
        calvingOutcome: json['calvingOutcome'] as String?,
        notes: json['notes'] as String?,
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'animalId': animalId,
        'tagId': tagId,
        'heatDate': heatDate,
        if (aiDate != null) 'aiDate': aiDate,
        if (bullSemenStrawId != null) 'bullSemenStrawId': bullSemenStrawId,
        if (technicianName != null) 'technicianName': technicianName,
        if (pdDate != null) 'pdDate': pdDate,
        'pdStatus': pdStatus,
        if (expectedCalvingDate != null)
          'expectedCalvingDate': expectedCalvingDate,
        if (calvingDate != null) 'calvingDate': calvingDate,
        if (calvingOutcome != null) 'calvingOutcome': calvingOutcome,
        if (notes != null) 'notes': notes,
      };
}

class VetRecord {
  final String id;
  final String animalId;
  final String tagId;
  final String vetDoctorId;
  final String vetDoctorName;
  final String examinationDate;
  final String symptoms;
  final String clinicalDiagnosis;
  final List<String> treatmentsGiven;
  final List<Map<String, dynamic>> prescriptions;
  final String? followUpDate;
  final int milkWithdrawalDays;
  final String status;
  final String? createdAt;

  const VetRecord({
    required this.id,
    required this.animalId,
    required this.tagId,
    required this.vetDoctorId,
    required this.vetDoctorName,
    required this.examinationDate,
    required this.symptoms,
    required this.clinicalDiagnosis,
    required this.treatmentsGiven,
    required this.prescriptions,
    this.followUpDate,
    required this.milkWithdrawalDays,
    required this.status,
    this.createdAt,
  });

  factory VetRecord.fromJson(Map<String, dynamic> json) => VetRecord(
        id: json['id'] as String? ?? '',
        animalId: json['animalId'] as String? ?? '',
        tagId: json['tagId'] as String? ?? '',
        vetDoctorId: json['vetDoctorId'] as String? ?? '',
        vetDoctorName: json['vetDoctorName'] as String? ?? '',
        examinationDate: json['examinationDate'] as String? ?? '',
        symptoms: json['symptoms'] as String? ?? '',
        clinicalDiagnosis: json['clinicalDiagnosis'] as String? ?? '',
        treatmentsGiven: ((json['treatmentsGiven'] as List?) ?? const <dynamic>[])
            .map((e) => "$e")
            .toList(),
        prescriptions: ((json['prescriptions'] as List?) ?? const <dynamic>[])
            .map((e) => (e as Map).cast<String, dynamic>())
            .toList(),
        followUpDate: json['followUpDate'] as String?,
        milkWithdrawalDays:
            (json['milkWithdrawalDays'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'open',
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'animalId': animalId,
        'tagId': tagId,
        'vetDoctorName': vetDoctorName,
        'examinationDate': examinationDate,
        'symptoms': symptoms,
        'clinicalDiagnosis': clinicalDiagnosis,
        'treatmentsGiven': treatmentsGiven,
        'prescriptions': prescriptions,
        if (followUpDate != null) 'followUpDate': followUpDate,
        'milkWithdrawalDays': milkWithdrawalDays,
        'status': status,
      };
}

class VaccinationSchedule {
  final String id;
  final String animalId;
  final String tagId;
  final String vaccineName;
  final String diseaseTarget;
  final String scheduledDate;
  final String? administeredDate;
  final String? batchNumber;
  final String? administeredBy;
  final String? boosterDueDate;
  final String status;
  final String? createdAt;

  const VaccinationSchedule({
    required this.id,
    required this.animalId,
    required this.tagId,
    required this.vaccineName,
    required this.diseaseTarget,
    required this.scheduledDate,
    this.administeredDate,
    this.batchNumber,
    this.administeredBy,
    this.boosterDueDate,
    required this.status,
    this.createdAt,
  });

  factory VaccinationSchedule.fromJson(Map<String, dynamic> json) =>
      VaccinationSchedule(
        id: json['id'] as String? ?? '',
        animalId: json['animalId'] as String? ?? '',
        tagId: json['tagId'] as String? ?? '',
        vaccineName: json['vaccineName'] as String? ?? '',
        diseaseTarget: json['diseaseTarget'] as String? ?? '',
        scheduledDate: json['scheduledDate'] as String? ?? '',
        administeredDate: json['administeredDate'] as String?,
        batchNumber: json['batchNumber'] as String?,
        administeredBy: json['administeredBy'] as String?,
        boosterDueDate: json['boosterDueDate'] as String?,
        status: json['status'] as String? ?? 'scheduled',
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'animalId': animalId,
        'tagId': tagId,
        'vaccineName': vaccineName,
        'diseaseTarget': diseaseTarget,
        'scheduledDate': scheduledDate,
        if (administeredDate != null) 'administeredDate': administeredDate,
        if (batchNumber != null) 'batchNumber': batchNumber,
        if (administeredBy != null) 'administeredBy': administeredBy,
        if (boosterDueDate != null) 'boosterDueDate': boosterDueDate,
        'status': status,
      };
}

class CowAdoption {
  final String id;
  final String gaushalaId;
  final String gaushalaName;
  final String cowTagId;
  final String cowName;
  final String donorName;
  final String donorPhone;
  final String? donorEmail;
  final String? donorPan;
  final String adoptionTier;
  final int amountRupees;
  final int durationMonths;
  final String startDate;
  final String endDate;
  final bool taxExemption80GIssued;
  final String receiptNumber;
  final String status;
  final String? createdAt;

  const CowAdoption({
    required this.id,
    required this.gaushalaId,
    required this.gaushalaName,
    required this.cowTagId,
    required this.cowName,
    required this.donorName,
    required this.donorPhone,
    this.donorEmail,
    this.donorPan,
    required this.adoptionTier,
    required this.amountRupees,
    required this.durationMonths,
    required this.startDate,
    required this.endDate,
    required this.taxExemption80GIssued,
    required this.receiptNumber,
    required this.status,
    this.createdAt,
  });

  factory CowAdoption.fromJson(Map<String, dynamic> json) => CowAdoption(
        id: json['id'] as String? ?? '',
        gaushalaId: json['gaushalaId'] as String? ?? '',
        gaushalaName: json['gaushalaName'] as String? ?? '',
        cowTagId: json['cowTagId'] as String? ?? '',
        cowName: json['cowName'] as String? ?? '',
        donorName: json['donorName'] as String? ?? '',
        donorPhone: json['donorPhone'] as String? ?? '',
        donorEmail: json['donorEmail'] as String?,
        donorPan: json['donorPan'] as String?,
        adoptionTier: json['adoptionTier'] as String? ?? 'gau_gras',
        amountRupees: (json['amountRupees'] as num?)?.toInt() ?? 0,
        durationMonths: (json['durationMonths'] as num?)?.toInt() ?? 1,
        startDate: json['startDate'] as String? ?? '',
        endDate: json['endDate'] as String? ?? '',
        taxExemption80GIssued: json['taxExemption80GIssued'] == true,
        receiptNumber: json['receiptNumber'] as String? ?? '',
        status: json['status'] as String? ?? 'active',
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'gaushalaId': gaushalaId,
        'cowTagId': cowTagId,
        'cowName': cowName,
        'donorName': donorName,
        'donorPhone': donorPhone,
        if (donorEmail != null) 'donorEmail': donorEmail,
        if (donorPan != null) 'donorPan': donorPan,
        'adoptionTier': adoptionTier,
        'amountRupees': amountRupees,
        'durationMonths': durationMonths,
        'startDate': startDate,
      };
}

class FodderDonation {
  final String id;
  final String gaushalaId;
  final String gaushalaName;
  final String donorName;
  final String donorPhone;
  final String fodderType;
  final double quantityKg;
  final int monetaryEquivalentRupees;
  final String receiptNumber;
  final String? createdAt;

  const FodderDonation({
    required this.id,
    required this.gaushalaId,
    required this.gaushalaName,
    required this.donorName,
    required this.donorPhone,
    required this.fodderType,
    required this.quantityKg,
    required this.monetaryEquivalentRupees,
    required this.receiptNumber,
    this.createdAt,
  });

  factory FodderDonation.fromJson(Map<String, dynamic> json) => FodderDonation(
        id: json['id'] as String? ?? '',
        gaushalaId: json['gaushalaId'] as String? ?? '',
        gaushalaName: json['gaushalaName'] as String? ?? '',
        donorName: json['donorName'] as String? ?? '',
        donorPhone: json['donorPhone'] as String? ?? '',
        fodderType: json['fodderType'] as String? ?? 'green_grass',
        quantityKg: (json['quantityKg'] as num?)?.toDouble() ?? 0.0,
        monetaryEquivalentRupees:
            (json['monetaryEquivalentRupees'] as num?)?.toInt() ?? 0,
        receiptNumber: json['receiptNumber'] as String? ?? '',
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'gaushalaId': gaushalaId,
        'donorName': donorName,
        'donorPhone': donorPhone,
        'fodderType': fodderType,
        'quantityKg': quantityKg,
        if (monetaryEquivalentRupees > 0)
          'monetaryEquivalentRupees': monetaryEquivalentRupees,
      };
}

class PanchagavyaProduct {
  final String id;
  final String gaushalaId;
  final String gaushalaName;
  final String title;
  final String category;
  final int price;
  final String unit;
  final int stockQuantity;
  final bool purityCertified;
  final String description;

  const PanchagavyaProduct({
    required this.id,
    required this.gaushalaId,
    required this.gaushalaName,
    required this.title,
    required this.category,
    required this.price,
    required this.unit,
    required this.stockQuantity,
    required this.purityCertified,
    required this.description,
  });

  factory PanchagavyaProduct.fromJson(Map<String, dynamic> json) =>
      PanchagavyaProduct(
        id: json['id'] as String? ?? '',
        gaushalaId: json['gaushalaId'] as String? ?? '',
        gaushalaName: json['gaushalaName'] as String? ?? '',
        title: json['title'] as String? ?? '',
        category: json['category'] as String? ?? '',
        price: (json['price'] as num?)?.toInt() ?? 0,
        unit: json['unit'] as String? ?? '',
        stockQuantity: (json['stockQuantity'] as num?)?.toInt() ?? 0,
        purityCertified: json['purityCertified'] == true,
        description: json['description'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'gaushalaId': gaushalaId,
        'title': title,
        'category': category,
        'price': price,
        'unit': unit,
        'stockQuantity': stockQuantity,
        'purityCertified': purityCertified,
        'description': description,
      };
}

