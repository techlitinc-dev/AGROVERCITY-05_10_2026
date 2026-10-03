// Cold Storage & Godown Management Models

class ColdStorageChamber {
  final String id;
  final String name;
  final String chamberType;
  final double capacityMT;
  final double currentOccupancyMT;
  final String tempRange;
  final String status;

  const ColdStorageChamber({
    required this.id,
    required this.name,
    this.chamberType = 'cold_storage',
    required this.capacityMT,
    this.currentOccupancyMT = 0.0,
    this.tempRange = '2-8°C',
    this.status = 'active',
  });

  factory ColdStorageChamber.fromJson(Map<String, dynamic> json) =>
      ColdStorageChamber(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? 'Chamber',
        chamberType: json['chamberType'] as String? ?? 'cold_storage',
        capacityMT: (json['capacityMT'] as num?)?.toDouble() ?? 0.0,
        currentOccupancyMT: (json['currentOccupancyMT'] as num?)?.toDouble() ?? 0.0,
        tempRange: json['tempRange'] as String? ?? '2-8°C',
        status: json['status'] as String? ?? 'active',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'chamberType': chamberType,
        'capacityMT': capacityMT,
        'currentOccupancyMT': currentOccupancyMT,
        'tempRange': tempRange,
        'status': status,
      };
}

class ColdStorageBookingRecord {
  final String id;
  final String facilityId;
  final String facilityName;
  final String farmerUid;
  final String farmerName;
  final String farmerPhone;
  final String cropName;
  final String? variety;
  final double quantityQuintals;
  final String packagingType;
  final int bagsCount;
  final String fromDate;
  final int months;
  final double ratePerQuintalMonth;
  final double estimatedMonthlyRent;
  final double totalEstimatedRent;
  final String status; // pending, booked, approved, inwarded, release_requested, partially_released, released, rejected
  final String bookedAt;
  final String? reviewedAt;
  final String? reviewedBy;
  final String? rejectionReason;
  final String? providerNotes;
  final String? allocatedChamberId;
  final String? allocatedChamberName;
  final String? lotNumber;
  final double? inwardGrossWeightKg;
  final double? inwardTareWeightKg;
  final double? inwardNetQuintals;
  final int? inwardBags;
  final String? inwardDate;
  final double? moisturePercent;
  final String? qcGrade;
  final String? receiptNumber;
  final double? valuationRupees;
  final double outwardReleasedQuintals;
  final double? remainingQuintals;
  final String? outwardDate;
  final String? gatePassNumber;
  final double rentPaid;
  final String paymentStatus;
  final List<Map<String, dynamic>> timeline;

  const ColdStorageBookingRecord({
    required this.id,
    required this.facilityId,
    required this.facilityName,
    this.farmerUid = '',
    this.farmerName = 'किसान',
    this.farmerPhone = '',
    required this.cropName,
    this.variety,
    required this.quantityQuintals,
    this.packagingType = 'Jute Bags',
    this.bagsCount = 0,
    required this.fromDate,
    required this.months,
    this.ratePerQuintalMonth = 12.0,
    this.estimatedMonthlyRent = 0.0,
    this.totalEstimatedRent = 0.0,
    required this.status,
    required this.bookedAt,
    this.reviewedAt,
    this.reviewedBy,
    this.rejectionReason,
    this.providerNotes,
    this.allocatedChamberId,
    this.allocatedChamberName,
    this.lotNumber,
    this.inwardGrossWeightKg,
    this.inwardTareWeightKg,
    this.inwardNetQuintals,
    this.inwardBags,
    this.inwardDate,
    this.moisturePercent,
    this.qcGrade,
    this.receiptNumber,
    this.valuationRupees,
    this.outwardReleasedQuintals = 0.0,
    this.remainingQuintals,
    this.outwardDate,
    this.gatePassNumber,
    this.rentPaid = 0.0,
    this.paymentStatus = 'unpaid',
    this.timeline = const [],
  });

  bool get isPending => status == 'pending' || status == 'booked';
  bool get isApproved => status == 'approved';
  bool get isInwarded => status == 'inwarded';
  bool get isReleaseRequested => status == 'release_requested';
  bool get isReleased => status == 'released';
  bool get isRejected => status == 'rejected';

  factory ColdStorageBookingRecord.fromJson(Map<String, dynamic> json) =>
      ColdStorageBookingRecord(
        id: json['id'] as String? ?? '',
        facilityId: json['facilityId'] as String? ?? '',
        facilityName: json['facilityName'] as String? ?? 'Cold Storage',
        farmerUid: json['farmerUid'] as String? ?? '',
        farmerName: json['farmerName'] as String? ?? 'किसान',
        farmerPhone: json['farmerPhone'] as String? ?? '',
        cropName: json['cropName'] as String? ?? 'General Produce',
        variety: json['variety'] as String?,
        quantityQuintals: (json['quantityQuintals'] as num?)?.toDouble() ?? 0.0,
        packagingType: json['packagingType'] as String? ?? 'Jute Bags',
        bagsCount: (json['bagsCount'] as num?)?.toInt() ?? 0,
        fromDate: json['fromDate'] as String? ?? '',
        months: (json['months'] as num?)?.toInt() ?? 1,
        ratePerQuintalMonth: (json['ratePerQuintalMonth'] as num?)?.toDouble() ?? 12.0,
        estimatedMonthlyRent: (json['estimatedMonthlyRent'] as num?)?.toDouble() ?? 0.0,
        totalEstimatedRent: (json['totalEstimatedRent'] as num?)?.toDouble() ?? 0.0,
        status: json['status'] as String? ?? 'booked',
        bookedAt: json['bookedAt'] as String? ?? '',
        reviewedAt: json['reviewedAt'] as String?,
        reviewedBy: json['reviewedBy'] as String?,
        rejectionReason: json['rejectionReason'] as String?,
        providerNotes: json['providerNotes'] as String?,
        allocatedChamberId: json['allocatedChamberId'] as String?,
        allocatedChamberName: json['allocatedChamberName'] as String?,
        lotNumber: json['lotNumber'] as String?,
        inwardGrossWeightKg: (json['inwardGrossWeightKg'] as num?)?.toDouble(),
        inwardTareWeightKg: (json['inwardTareWeightKg'] as num?)?.toDouble(),
        inwardNetQuintals: (json['inwardNetQuintals'] as num?)?.toDouble(),
        inwardBags: (json['inwardBags'] as num?)?.toInt(),
        inwardDate: json['inwardDate'] as String?,
        moisturePercent: (json['moisturePercent'] as num?)?.toDouble(),
        qcGrade: json['qcGrade'] as String?,
        receiptNumber: json['receiptNumber'] as String?,
        valuationRupees: (json['valuationRupees'] as num?)?.toDouble(),
        outwardReleasedQuintals: (json['outwardReleasedQuintals'] as num?)?.toDouble() ?? 0.0,
        remainingQuintals: (json['remainingQuintals'] as num?)?.toDouble(),
        outwardDate: json['outwardDate'] as String?,
        gatePassNumber: json['gatePassNumber'] as String?,
        rentPaid: (json['rentPaid'] as num?)?.toDouble() ?? 0.0,
        paymentStatus: json['paymentStatus'] as String? ?? 'unpaid',
        timeline: (json['timeline'] as List?)
                ?.map((e) => (e as Map).cast<String, dynamic>())
                .toList() ??
            const [],
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'facilityId': facilityId,
        'facilityName': facilityName,
        'farmerUid': farmerUid,
        'farmerName': farmerName,
        'farmerPhone': farmerPhone,
        'cropName': cropName,
        'variety': variety,
        'quantityQuintals': quantityQuintals,
        'packagingType': packagingType,
        'bagsCount': bagsCount,
        'fromDate': fromDate,
        'months': months,
        'ratePerQuintalMonth': ratePerQuintalMonth,
        'estimatedMonthlyRent': estimatedMonthlyRent,
        'totalEstimatedRent': totalEstimatedRent,
        'status': status,
        'bookedAt': bookedAt,
        'reviewedAt': reviewedAt,
        'reviewedBy': reviewedBy,
        'rejectionReason': rejectionReason,
        'providerNotes': providerNotes,
        'allocatedChamberId': allocatedChamberId,
        'allocatedChamberName': allocatedChamberName,
        'lotNumber': lotNumber,
        'inwardGrossWeightKg': inwardGrossWeightKg,
        'inwardTareWeightKg': inwardTareWeightKg,
        'inwardNetQuintals': inwardNetQuintals,
        'inwardBags': inwardBags,
        'inwardDate': inwardDate,
        'moisturePercent': moisturePercent,
        'qcGrade': qcGrade,
        'receiptNumber': receiptNumber,
        'valuationRupees': valuationRupees,
        'outwardReleasedQuintals': outwardReleasedQuintals,
        'remainingQuintals': remainingQuintals,
        'outwardDate': outwardDate,
        'gatePassNumber': gatePassNumber,
        'rentPaid': rentPaid,
        'paymentStatus': paymentStatus,
        'timeline': timeline,
      };
}

class WarehouseReceiptRecord {
  final String receiptNumber;
  final String bookingId;
  final String facilityId;
  final String facilityName;
  final String? wdraRegNo;
  final String depositorName;
  final String depositorPhone;
  final String cropName;
  final String? variety;
  final double netQuintals;
  final int bagsCount;
  final String qcGrade;
  final double? moisturePercent;
  final String chamberName;
  final String lotNumber;
  final double valuationRupees;
  final String issueDate;
  final bool pledgeFinancingEligible;
  final String status;

  const WarehouseReceiptRecord({
    required this.receiptNumber,
    required this.bookingId,
    required this.facilityId,
    required this.facilityName,
    this.wdraRegNo,
    required this.depositorName,
    required this.depositorPhone,
    required this.cropName,
    this.variety,
    required this.netQuintals,
    required this.bagsCount,
    required this.qcGrade,
    this.moisturePercent,
    required this.chamberName,
    required this.lotNumber,
    required this.valuationRupees,
    required this.issueDate,
    this.pledgeFinancingEligible = true,
    this.status = 'active',
  });

  factory WarehouseReceiptRecord.fromJson(Map<String, dynamic> json) =>
      WarehouseReceiptRecord(
        receiptNumber: json['receiptNumber'] as String? ?? '',
        bookingId: json['bookingId'] as String? ?? '',
        facilityId: json['facilityId'] as String? ?? '',
        facilityName: json['facilityName'] as String? ?? 'Cold Storage',
        wdraRegNo: json['wdraRegNo'] as String?,
        depositorName: json['depositorName'] as String? ?? '',
        depositorPhone: json['depositorPhone'] as String? ?? '',
        cropName: json['cropName'] as String? ?? '',
        variety: json['variety'] as String?,
        netQuintals: (json['netQuintals'] as num?)?.toDouble() ?? 0.0,
        bagsCount: (json['bagsCount'] as num?)?.toInt() ?? 0,
        qcGrade: json['qcGrade'] as String? ?? 'Grade A',
        moisturePercent: (json['moisturePercent'] as num?)?.toDouble(),
        chamberName: json['chamberName'] as String? ?? '',
        lotNumber: json['lotNumber'] as String? ?? '',
        valuationRupees: (json['valuationRupees'] as num?)?.toDouble() ?? 0.0,
        issueDate: json['issueDate'] as String? ?? '',
        pledgeFinancingEligible: json['pledgeFinancingEligible'] as bool? ?? true,
        status: json['status'] as String? ?? 'active',
      );

  Map<String, dynamic> toJson() => {
        'receiptNumber': receiptNumber,
        'bookingId': bookingId,
        'facilityId': facilityId,
        'facilityName': facilityName,
        'wdraRegNo': wdraRegNo,
        'depositorName': depositorName,
        'depositorPhone': depositorPhone,
        'cropName': cropName,
        'variety': variety,
        'netQuintals': netQuintals,
        'bagsCount': bagsCount,
        'qcGrade': qcGrade,
        'moisturePercent': moisturePercent,
        'chamberName': chamberName,
        'lotNumber': lotNumber,
        'valuationRupees': valuationRupees,
        'issueDate': issueDate,
        'pledgeFinancingEligible': pledgeFinancingEligible,
        'status': status,
      };
}

class ColdStorageProviderStats {
  final double totalCapacityMT;
  final double occupiedMT;
  final double availableMT;
  final double occupancyPercent;
  final int pendingBookingsCount;
  final int activeStoredLotsCount;
  final int totalFarmersCount;
  final double totalAccruedRent;
  final double totalValuationStored;

  const ColdStorageProviderStats({
    required this.totalCapacityMT,
    required this.occupiedMT,
    required this.availableMT,
    required this.occupancyPercent,
    required this.pendingBookingsCount,
    required this.activeStoredLotsCount,
    required this.totalFarmersCount,
    required this.totalAccruedRent,
    required this.totalValuationStored,
  });

  factory ColdStorageProviderStats.fromJson(Map<String, dynamic> json) =>
      ColdStorageProviderStats(
        totalCapacityMT: (json['totalCapacityMT'] as num?)?.toDouble() ?? 0.0,
        occupiedMT: (json['occupiedMT'] as num?)?.toDouble() ?? 0.0,
        availableMT: (json['availableMT'] as num?)?.toDouble() ?? 0.0,
        occupancyPercent: (json['occupancyPercent'] as num?)?.toDouble() ?? 0.0,
        pendingBookingsCount: (json['pendingBookingsCount'] as num?)?.toInt() ?? 0,
        activeStoredLotsCount: (json['activeStoredLotsCount'] as num?)?.toInt() ?? 0,
        totalFarmersCount: (json['totalFarmersCount'] as num?)?.toInt() ?? 0,
        totalAccruedRent: (json['totalAccruedRent'] as num?)?.toDouble() ?? 0.0,
        totalValuationStored: (json['totalValuationStored'] as num?)?.toDouble() ?? 0.0,
      );

  Map<String, dynamic> toJson() => {
        'totalCapacityMT': totalCapacityMT,
        'occupiedMT': occupiedMT,
        'availableMT': availableMT,
        'occupancyPercent': occupancyPercent,
        'pendingBookingsCount': pendingBookingsCount,
        'activeStoredLotsCount': activeStoredLotsCount,
        'totalFarmersCount': totalFarmersCount,
        'totalAccruedRent': totalAccruedRent,
        'totalValuationStored': totalValuationStored,
      };
}

class ColdStorageFacilityRecord {
  final String id;
  final String name;
  final String? ownerUid;
  final String? managerName;
  final String? contactPhone;
  final String? address;
  final String district;
  final String state;
  final String facilityType;
  final double distanceKm;
  final String tempRange;
  final double availableMT;
  final double totalCapacityMT;
  final double bookedQuintals;
  final double ratePerQuintalMonth;
  final bool wdraRegistered;
  final String? wdraRegNo;
  final List<String> supportedCrops;
  final List<ColdStorageChamber> chambers;

  const ColdStorageFacilityRecord({
    required this.id,
    required this.name,
    this.ownerUid,
    this.managerName,
    this.contactPhone,
    this.address,
    this.district = 'Nashik',
    this.state = 'Maharashtra',
    this.facilityType = 'cold_storage',
    this.distanceKm = 0.0,
    this.tempRange = '2-8°C',
    required this.availableMT,
    required this.totalCapacityMT,
    this.bookedQuintals = 0.0,
    required this.ratePerQuintalMonth,
    this.wdraRegistered = true,
    this.wdraRegNo,
    this.supportedCrops = const [],
    this.chambers = const [],
  });

  bool get isColdStorage => facilityType == 'cold_storage';
  bool get isGodown =>
      facilityType == 'dry_godown' ||
      facilityType == 'godown' ||
      facilityType == 'warehouse';
  bool get isSilo => facilityType == 'silo';

  factory ColdStorageFacilityRecord.fromJson(Map<String, dynamic> json) {
    final chambersList = (json['chambers'] as List?) ?? [];
    return ColdStorageFacilityRecord(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      ownerUid: json['ownerUid'] as String?,
      managerName: json['managerName'] as String?,
      contactPhone: json['contactPhone'] as String?,
      address: json['address'] as String?,
      district: json['district'] as String? ?? 'Nashik',
      state: json['state'] as String? ?? 'Maharashtra',
      facilityType: json['facilityType'] as String? ?? 'cold_storage',
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0.0,
      tempRange: json['tempRange'] as String? ?? '2-8°C',
      availableMT: (json['availableMT'] as num?)?.toDouble() ?? 0.0,
      totalCapacityMT: (json['totalCapacityMT'] as num?)?.toDouble() ??
          (json['availableMT'] as num?)?.toDouble() ??
          0.0,
      bookedQuintals: (json['bookedQuintals'] as num?)?.toDouble() ?? 0.0,
      ratePerQuintalMonth:
          (json['ratePerQuintalMonth'] as num?)?.toDouble() ?? 0.0,
      wdraRegistered: json['wdraRegistered'] as bool? ?? true,
      wdraRegNo: json['wdraRegNo'] as String?,
      supportedCrops: (json['supportedCrops'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      chambers: chambersList
          .map((e) => ColdStorageChamber.fromJson(
              (e as Map).cast<String, dynamic>()))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'ownerUid': ownerUid,
        'managerName': managerName,
        'contactPhone': contactPhone,
        'address': address,
        'district': district,
        'state': state,
        'facilityType': facilityType,
        'distanceKm': distanceKm,
        'tempRange': tempRange,
        'availableMT': availableMT,
        'totalCapacityMT': totalCapacityMT,
        'bookedQuintals': bookedQuintals,
        'ratePerQuintalMonth': ratePerQuintalMonth,
        'wdraRegistered': wdraRegistered,
        'wdraRegNo': wdraRegNo,
        'supportedCrops': supportedCrops,
        'chambers': chambers.map((c) => c.toJson()).toList(),
      };
}
