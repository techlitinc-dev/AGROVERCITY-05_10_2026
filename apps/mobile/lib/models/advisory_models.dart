// Advisory module models — fields mirror the backend response shapes in
// backend/app/routers/advisory.py and backend/app/models/advisory.py.

class AlternativeCrop {
  final String crop;
  final double expectedPrice;

  const AlternativeCrop({required this.crop, required this.expectedPrice});

  factory AlternativeCrop.fromJson(Map<String, dynamic> json) =>
      AlternativeCrop(
        crop: json['crop'] as String? ?? '',
        expectedPrice: (json['expectedPrice'] as num?)?.toDouble() ?? 0,
      );
}

class SaturationAdvisory {
  final int sowingCount;
  final int radiusKm;
  final String expectedArrivalIncrease;
  final String riskLevel; // 'green' | 'yellow' | 'red'
  final double predictedPrice;
  final String predictedDate;
  final List<AlternativeCrop> alternativeCrops;

  const SaturationAdvisory({
    required this.sowingCount,
    required this.radiusKm,
    required this.expectedArrivalIncrease,
    required this.riskLevel,
    required this.predictedPrice,
    required this.predictedDate,
    required this.alternativeCrops,
  });

  factory SaturationAdvisory.fromJson(Map<String, dynamic> json) =>
      SaturationAdvisory(
        sowingCount: (json['sowingCount'] as num?)?.toInt() ?? 0,
        radiusKm: (json['radiusKm'] as num?)?.toInt() ?? 0,
        expectedArrivalIncrease:
            json['expectedArrivalIncrease'] as String? ?? '',
        riskLevel: json['riskLevel'] as String? ?? 'green',
        predictedPrice: (json['predictedPrice'] as num?)?.toDouble() ?? 0,
        predictedDate: json['predictedDate'] as String? ?? '',
        alternativeCrops: ((json['alternativeCrops'] as List?) ??
                const <dynamic>[])
            .map((e) => AlternativeCrop.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );
}

class SowingIntentResult {
  final bool recorded;
  final bool isIntent;

  const SowingIntentResult({required this.recorded, required this.isIntent});

  factory SowingIntentResult.fromJson(Map<String, dynamic> json) =>
      SowingIntentResult(
        recorded: json['recorded'] == true,
        isIntent: json['isIntent'] == true,
      );
}

class DiseaseScanResult {
  final String diseaseName;
  final String crop;
  final String pathogen;
  final double confidence;
  final String symptoms;
  final String chemicalTreatment;
  final String organicTreatment;
  final String dosage;
  final double estimatedCost;

  const DiseaseScanResult({
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

  factory DiseaseScanResult.fromJson(Map<String, dynamic> json) =>
      DiseaseScanResult(
        diseaseName: json['diseaseName'] as String? ?? '',
        crop: json['crop'] as String? ?? '',
        pathogen: json['pathogen'] as String? ?? '',
        confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
        symptoms: json['symptoms'] as String? ?? '',
        chemicalTreatment: json['chemicalTreatment'] as String? ?? '',
        organicTreatment: json['organicTreatment'] as String? ?? '',
        dosage: json['dosage'] as String? ?? '',
        estimatedCost: (json['estimatedCost'] as num?)?.toDouble() ?? 0,
      );
}

class NpkRecommendation {
  final List<String> recommendations;
  final double ureaKgPerAcre;
  final double dapKgPerAcre;
  final double mopKgPerAcre;

  const NpkRecommendation({
    required this.recommendations,
    required this.ureaKgPerAcre,
    required this.dapKgPerAcre,
    required this.mopKgPerAcre,
  });

  factory NpkRecommendation.fromJson(Map<String, dynamic> json) =>
      NpkRecommendation(
        recommendations: ((json['recommendations'] as List?) ?? const <dynamic>[])
            .map((e) => e.toString())
            .toList(),
        ureaKgPerAcre: (json['ureaKgPerAcre'] as num?)?.toDouble() ?? 0,
        dapKgPerAcre: (json['dapKgPerAcre'] as num?)?.toDouble() ?? 0,
        mopKgPerAcre: (json['mopKgPerAcre'] as num?)?.toDouble() ?? 0,
      );
}

class PestRadarItem {
  final String disease;
  final String crop;
  final double distanceKm;
  final String riskLevel; // 'green' | 'yellow' | 'red'
  final String reportedAt;

  const PestRadarItem({
    required this.disease,
    required this.crop,
    required this.distanceKm,
    required this.riskLevel,
    required this.reportedAt,
  });

  factory PestRadarItem.fromJson(Map<String, dynamic> json) => PestRadarItem(
        disease: json['disease'] as String? ?? '',
        crop: json['crop'] as String? ?? '',
        distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
        riskLevel: json['riskLevel'] as String? ?? 'green',
        reportedAt: json['reportedAt'] as String? ?? '',
      );
}
