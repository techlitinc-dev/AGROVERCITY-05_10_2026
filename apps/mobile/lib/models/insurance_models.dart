// Crop & agri insurance API models — field names match /v1/insurance/* exactly

double _numToDouble(Object? v) => (v as num?)?.toDouble() ?? 0;

class CropInsurancePolicy {
  final String id;
  final String policyNumber;
  final String schemeName;
  final String cropName;
  final String season;
  final int year;
  final double landAreaAcres;
  final double sumInsured;
  final double farmerPremium;
  final double govtSubsidy;
  final String status;
  final String insuranceCompany;
  final String coverageStartDate;
  final String coverageEndDate;
  final String bankName;
  final String kccAccountNo;
  final String? certificateUrl;
  final String? userId;
  final String? farmerName;
  final String? farmerPhone;
  final String? village;
  final String? district;
  final String? state;
  final String? category;
  final String? khasraNumber;
  final String? sowingDate;
  final int? riskScore;
  final String? riskCategory;
  final String? appliedAt;
  final String? reviewedAt;
  final String? reviewedBy;
  final String? rejectionReason;
  final String? underwriterNotes;

  const CropInsurancePolicy({
    required this.id,
    required this.policyNumber,
    required this.schemeName,
    required this.cropName,
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
    this.certificateUrl,
    this.userId,
    this.farmerName,
    this.farmerPhone,
    this.village,
    this.district,
    this.state,
    this.category,
    this.khasraNumber,
    this.sowingDate,
    this.riskScore,
    this.riskCategory,
    this.appliedAt,
    this.reviewedAt,
    this.reviewedBy,
    this.rejectionReason,
    this.underwriterNotes,
  });

  bool get isPending => status == 'pending_approval' || status == 'pending';
  bool get isActive => status == 'active';
  bool get isRejected => status == 'rejected';

  factory CropInsurancePolicy.fromJson(Map<String, dynamic> json) =>
      CropInsurancePolicy(
        id: json['id'] as String? ?? '',
        policyNumber: json['policyNumber'] as String? ?? '',
        schemeName: json['schemeName'] as String? ?? '',
        cropName: json['cropName'] as String? ?? '',
        season: json['season'] as String? ?? '',
        year: (json['year'] as num?)?.toInt() ?? 0,
        landAreaAcres: _numToDouble(json['landAreaAcres']),
        sumInsured: _numToDouble(json['sumInsured']),
        farmerPremium: _numToDouble(json['farmerPremium']),
        govtSubsidy: _numToDouble(json['govtSubsidy']),
        status: json['status'] as String? ?? '',
        insuranceCompany: json['insuranceCompany'] as String? ?? '',
        coverageStartDate: json['coverageStartDate'] as String? ?? '',
        coverageEndDate: json['coverageEndDate'] as String? ?? '',
        bankName: json['bankName'] as String? ?? '',
        kccAccountNo: json['kccAccountNo'] as String? ?? '',
        certificateUrl: json['certificateUrl'] as String?,
        userId: json['userId'] as String?,
        farmerName: json['farmerName'] as String?,
        farmerPhone: json['farmerPhone'] as String?,
        village: json['village'] as String?,
        district: json['district'] as String?,
        state: json['state'] as String?,
        category: json['category'] as String?,
        khasraNumber: json['khasraNumber'] as String?,
        sowingDate: json['sowingDate'] as String?,
        riskScore: (json['riskScore'] as num?)?.toInt(),
        riskCategory: json['riskCategory'] as String?,
        appliedAt: json['appliedAt'] as String?,
        reviewedAt: json['reviewedAt'] as String?,
        reviewedBy: json['reviewedBy'] as String?,
        rejectionReason: json['rejectionReason'] as String?,
        underwriterNotes: json['underwriterNotes'] as String?,
      );
}

class CropPremiumRate {
  final String id;
  final String cropName;
  final String category;
  final String season;
  final double sumInsuredPerAcre;
  final double farmerSharePercent;
  final double totalActuarialRatePercent;
  final String cutoffDate;

  const CropPremiumRate({
    required this.id,
    required this.cropName,
    required this.category,
    required this.season,
    required this.sumInsuredPerAcre,
    required this.farmerSharePercent,
    required this.totalActuarialRatePercent,
    required this.cutoffDate,
  });

  factory CropPremiumRate.fromJson(Map<String, dynamic> json) =>
      CropPremiumRate(
        id: json['id'] as String? ?? '',
        cropName: json['cropName'] as String? ?? '',
        category: json['category'] as String? ?? '',
        season: json['season'] as String? ?? '',
        sumInsuredPerAcre: _numToDouble(json['sumInsuredPerAcre']),
        farmerSharePercent: _numToDouble(json['farmerSharePercent']),
        totalActuarialRatePercent:
            _numToDouble(json['totalActuarialRatePercent']),
        cutoffDate: json['cutoffDate'] as String? ?? '',
      );
}

class ClaimTimelineEntry {
  final String status;
  final String at;
  final String note;

  const ClaimTimelineEntry({
    required this.status,
    required this.at,
    required this.note,
  });

  factory ClaimTimelineEntry.fromJson(Map<String, dynamic> json) =>
      ClaimTimelineEntry(
        status: json['status'] as String? ?? '',
        at: json['at'] as String? ?? '',
        note: json['note'] as String? ?? '',
      );
}

class InsuranceClaimRecord {
  final String id;
  final String claimNumber;
  final String policyId;
  final String cropName;
  final String calamityType;
  final String dateOfDamage;
  final String cropStage;
  final double estimatedLossPercent;
  final double requestedAmount;
  final double? approvedAmount;
  final String status;
  final String statusText;
  final String? surveyorName;
  final String? surveyorPhone;
  final String? surveyorVisitDate;
  final String gpsCoordinates;
  final String village;
  final List<String> damagePhotos;
  final String submittedAt;
  final String? dbtTransactionId;
  final String? bankAccountLast4;
  final List<ClaimTimelineEntry> timeline;
  final int appealCount;
  final String? rejectionReason;
  final String? userId;
  final String? farmerName;
  final String? farmerPhone;
  final String? farmerDistrict;
  final String? farmerState;
  final double? assessedLossPercent;
  final String? disbursedAt;

  const InsuranceClaimRecord({
    required this.id,
    required this.claimNumber,
    required this.policyId,
    required this.cropName,
    required this.calamityType,
    required this.dateOfDamage,
    required this.cropStage,
    required this.estimatedLossPercent,
    required this.requestedAmount,
    this.approvedAmount,
    required this.status,
    required this.statusText,
    this.surveyorName,
    this.surveyorPhone,
    this.surveyorVisitDate,
    required this.gpsCoordinates,
    required this.village,
    required this.damagePhotos,
    required this.submittedAt,
    this.dbtTransactionId,
    this.bankAccountLast4,
    required this.timeline,
    this.appealCount = 0,
    this.rejectionReason,
    this.userId,
    this.farmerName,
    this.farmerPhone,
    this.farmerDistrict,
    this.farmerState,
    this.assessedLossPercent,
    this.disbursedAt,
  });

  bool get isTerminal => status == 'disbursed' || status == 'rejected';

  factory InsuranceClaimRecord.fromJson(Map<String, dynamic> json) =>
      InsuranceClaimRecord(
        id: json['id'] as String? ?? '',
        claimNumber: json['claimNumber'] as String? ?? '',
        policyId: json['policyId'] as String? ?? '',
        cropName: json['cropName'] as String? ?? '',
        calamityType: json['calamityType'] as String? ?? '',
        dateOfDamage: json['dateOfDamage'] as String? ?? '',
        cropStage: json['cropStage'] as String? ?? '',
        estimatedLossPercent: _numToDouble(json['estimatedLossPercent']),
        requestedAmount: _numToDouble(json['requestedAmount']),
        approvedAmount: (json['approvedAmount'] as num?)?.toDouble(),
        status: json['status'] as String? ?? '',
        statusText: json['statusText'] as String? ?? '',
        surveyorName: json['surveyorName'] as String?,
        surveyorPhone: json['surveyorPhone'] as String?,
        surveyorVisitDate: json['surveyorVisitDate'] as String?,
        gpsCoordinates: json['gpsCoordinates'] as String? ?? '',
        village: json['village'] as String? ?? '',
        damagePhotos: ((json['damagePhotos'] as List?) ?? const <dynamic>[])
            .map((e) => '$e')
            .toList(),
        submittedAt: json['submittedAt'] as String? ?? '',
        dbtTransactionId: json['dbtTransactionId'] as String?,
        bankAccountLast4: json['bankAccountLast4'] as String?,
        timeline: ((json['timeline'] as List?) ?? const <dynamic>[])
            .map((e) =>
                ClaimTimelineEntry.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
        appealCount: (json['appealCount'] as num?)?.toInt() ?? 0,
        rejectionReason: json['rejectionReason'] as String?,
        userId: json['userId'] as String?,
        farmerName: json['farmerName'] as String?,
        farmerPhone: json['farmerPhone'] as String?,
        farmerDistrict: json['farmerDistrict'] as String?,
        farmerState: json['farmerState'] as String?,
        assessedLossPercent: (json['assessedLossPercent'] as num?)?.toDouble(),
        disbursedAt: json['disbursedAt'] as String?,
      );
}

class InsuranceScheme {
  final String id;
  final String code;
  final String titleEn;
  final String titleHi;
  final String descriptionEn;
  final String descriptionHi;
  final String category;
  final String premiumShareRules;
  final List<String> applicableCrops;
  final String cutoffNotice;
  final int claimWindowHours;

  const InsuranceScheme({
    required this.id,
    required this.code,
    required this.titleEn,
    required this.titleHi,
    required this.descriptionEn,
    required this.descriptionHi,
    required this.category,
    required this.premiumShareRules,
    required this.applicableCrops,
    required this.cutoffNotice,
    this.claimWindowHours = 72,
  });

  factory InsuranceScheme.fromJson(Map<String, dynamic> json) =>
      InsuranceScheme(
        id: json['id'] as String? ?? '',
        code: json['code'] as String? ?? '',
        titleEn: json['titleEn'] as String? ?? '',
        titleHi: json['titleHi'] as String? ?? '',
        descriptionEn: json['descriptionEn'] as String? ?? '',
        descriptionHi: json['descriptionHi'] as String? ?? '',
        category: json['category'] as String? ?? 'crop',
        premiumShareRules: json['premiumShareRules'] as String? ?? '',
        applicableCrops: ((json['applicableCrops'] as List?) ?? const <dynamic>[])
            .map((e) => '$e')
            .toList(),
        cutoffNotice: json['cutoffNotice'] as String? ?? '',
        claimWindowHours: (json['claimWindowHours'] as num?)?.toInt() ?? 72,
      );
}

class InsuranceProviderStats {
  final int totalPolicies;
  final int pendingPolicies;
  final int activePolicies;
  final int rejectedPolicies;
  final double totalSumInsured;
  final double totalFarmerPremium;
  final double totalGovtSubsidy;
  final int totalClaims;
  final int pendingClaims;
  final int approvedClaims;
  final int disbursedClaims;
  final double totalClaimRequested;
  final double totalClaimApproved;
  final double totalClaimDisbursed;
  final double lossRatioPercent;
  final Map<String, int> byPolicyStatus;
  final Map<String, int> byClaimStatus;
  final Map<String, int> byCrop;
  final Map<String, int> byCalamity;

  const InsuranceProviderStats({
    required this.totalPolicies,
    required this.pendingPolicies,
    required this.activePolicies,
    required this.rejectedPolicies,
    required this.totalSumInsured,
    required this.totalFarmerPremium,
    required this.totalGovtSubsidy,
    required this.totalClaims,
    required this.pendingClaims,
    required this.approvedClaims,
    required this.disbursedClaims,
    required this.totalClaimRequested,
    required this.totalClaimApproved,
    required this.totalClaimDisbursed,
    required this.lossRatioPercent,
    required this.byPolicyStatus,
    required this.byClaimStatus,
    required this.byCrop,
    required this.byCalamity,
  });

  factory InsuranceProviderStats.fromJson(Map<String, dynamic> json) {
    Map<String, int> _mapInt(dynamic m) {
      if (m is! Map) return {};
      return m.map((k, v) => MapEntry('$k', (v as num?)?.toInt() ?? 0));
    }

    return InsuranceProviderStats(
      totalPolicies: (json['totalPolicies'] as num?)?.toInt() ?? 0,
      pendingPolicies: (json['pendingPolicies'] as num?)?.toInt() ?? 0,
      activePolicies: (json['activePolicies'] as num?)?.toInt() ?? 0,
      rejectedPolicies: (json['rejectedPolicies'] as num?)?.toInt() ?? 0,
      totalSumInsured: _numToDouble(json['totalSumInsured']),
      totalFarmerPremium: _numToDouble(json['totalFarmerPremium']),
      totalGovtSubsidy: _numToDouble(json['totalGovtSubsidy']),
      totalClaims: (json['totalClaims'] as num?)?.toInt() ?? 0,
      pendingClaims: (json['pendingClaims'] as num?)?.toInt() ?? 0,
      approvedClaims: (json['approvedClaims'] as num?)?.toInt() ?? 0,
      disbursedClaims: (json['disbursedClaims'] as num?)?.toInt() ?? 0,
      totalClaimRequested: _numToDouble(json['totalClaimRequested']),
      totalClaimApproved: _numToDouble(json['totalClaimApproved']),
      totalClaimDisbursed: _numToDouble(json['totalClaimDisbursed']),
      lossRatioPercent: _numToDouble(json['lossRatioPercent']),
      byPolicyStatus: _mapInt(json['byPolicyStatus']),
      byClaimStatus: _mapInt(json['byClaimStatus']),
      byCrop: _mapInt(json['byCrop']),
      byCalamity: _mapInt(json['byCalamity']),
    );
  }
}
