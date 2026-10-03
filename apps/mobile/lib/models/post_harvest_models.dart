// Post-harvest models — fields match GET /v1/post-harvest/cold-storage and
// POST /v1/post-harvest/grade (Day 14 Tasks A2/A7).

class ColdStorageFacility {
  final String id;
  final String name;
  final double distanceKm;
  final String tempRange;
  final double availableMT;
  final double ratePerQuintalMonth;

  const ColdStorageFacility({
    required this.id,
    required this.name,
    required this.distanceKm,
    required this.tempRange,
    required this.availableMT,
    required this.ratePerQuintalMonth,
  });

  factory ColdStorageFacility.fromJson(Map<String, dynamic> json) =>
      ColdStorageFacility(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
        tempRange: json['tempRange'] as String? ?? '',
        availableMT: (json['availableMT'] as num?)?.toDouble() ?? 0,
        ratePerQuintalMonth:
            (json['ratePerQuintalMonth'] as num?)?.toDouble() ?? 0,
      );
}

class GradeResult {
  final String grade;
  final int uniformityPercent;
  final int shelfLifeDays;
  final int recommendedPrice;

  const GradeResult({
    required this.grade,
    required this.uniformityPercent,
    required this.shelfLifeDays,
    required this.recommendedPrice,
  });

  factory GradeResult.fromJson(Map<String, dynamic> json) => GradeResult(
        grade: json['grade'] as String? ?? '',
        uniformityPercent: (json['uniformityPercent'] as num?)?.toInt() ?? 0,
        shelfLifeDays: (json['shelfLifeDays'] as num?)?.toInt() ?? 0,
        recommendedPrice: (json['recommendedPrice'] as num?)?.toInt() ?? 0,
      );
}
