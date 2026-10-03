class LandRecord712 {
  final String id;
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

  const LandRecord712({
    required this.id,
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

  factory LandRecord712.fromJson(Map<String, dynamic> json) => LandRecord712(
        id: json['id'] as String? ?? '',
        gatNumber: json['gatNumber'] as String? ?? '',
        village: json['village'] as String? ?? '',
        district: json['district'] as String? ?? '',
        ownerName: json['ownerName'] as String? ?? '',
        khataNumber: json['khataNumber'] as String? ?? '',
        totalAreaHectares:
            (json['totalAreaHectares'] as num?)?.toDouble() ?? 0,
        totalAreaAcres: (json['totalAreaAcres'] as num?)?.toDouble() ?? 0,
        landClass: json['landClass'] as String? ?? '',
        ferfarNumber: json['ferfarNumber'] as String? ?? '',
        cropHistory: json['cropHistory'] as String? ?? '',
      );
}
