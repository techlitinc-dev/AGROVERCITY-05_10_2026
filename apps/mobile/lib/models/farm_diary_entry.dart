import 'app_models.dart' show FarmDiaryType;

class FarmDiaryEntry {
  final String id;
  final String title;
  final String category;
  final FarmDiaryType type;
  final double amount; // 0 for farmActivity
  final String date; // YYYY-MM-DD
  final String cropName;
  final String notes;
  final List<String> photos;
  final double? quantity; // farmActivity only
  final String? unit; // farmActivity only
  final String createdAt;
  final String updatedAt;

  const FarmDiaryEntry({
    required this.id,
    required this.title,
    required this.category,
    required this.type,
    required this.amount,
    required this.date,
    required this.cropName,
    required this.notes,
    this.photos = const [],
    this.quantity,
    this.unit,
    this.createdAt = '',
    this.updatedAt = '',
  });

  factory FarmDiaryEntry.fromJson(Map<String, dynamic> json) => FarmDiaryEntry(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        category: json['category'] as String? ?? '',
        type: FarmDiaryType.values.firstWhere(
          (t) => t.name == json['type'],
          orElse: () => FarmDiaryType.farmActivity,
        ),
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
        date: json['date'] as String? ?? '',
        cropName: json['cropName'] as String? ?? '',
        notes: json['notes'] as String? ?? '',
        photos: ((json['photos'] as List?) ?? const <dynamic>[])
            .map((p) => '$p')
            .toList(),
        quantity: (json['quantity'] as num?)?.toDouble(),
        unit: json['unit'] as String?,
        createdAt: json['createdAt'] as String? ?? '',
        updatedAt: json['updatedAt'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'title': title,
        'category': category,
        'type': type.name,
        'amount': amount,
        'date': date,
        'cropName': cropName,
        'notes': notes,
        'photos': photos,
        'quantity': quantity,
        'unit': unit,
      };
}
