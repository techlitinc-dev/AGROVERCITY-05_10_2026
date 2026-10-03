// Product review — fields match GET/POST /v1/products/{id}/reviews exactly.

import '../data/translations.dart';

class ProductReview {
  final String id;
  final String userId;
  final String userName;
  final int rating;
  final String comment;
  final String createdAt;
  final String updatedAt;

  const ProductReview({
    required this.id,
    required this.userId,
    required this.userName,
    required this.rating,
    required this.comment,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ProductReview.fromJson(Map<String, dynamic> json) => ProductReview(
        id: json['id'] as String? ?? '',
        userId: json['userId'] as String? ?? '',
        userName: json['userName'] as String? ?? '',
        rating: (json['rating'] as num?)?.toInt() ?? 0,
        comment: json['comment'] as String? ?? '',
        createdAt: json['createdAt'] as String? ?? '',
        updatedAt: json['updatedAt'] as String? ?? '',
      );

  String timeAgo(String lang) {
    final parsed = DateTime.tryParse(updatedAt);
    if (parsed == null) return updatedAt;
    final diff = DateTime.now().difference(parsed.toLocal());
    if (diff.inDays < 1) return AppTranslations.get('reviews.today', lang);
    if (diff.inDays < 7) {
      return AppTranslations.get('reviews.daysAgo', lang)
          .replaceAll('{count}', '${diff.inDays}');
    }
    if (diff.inDays < 30) {
      return AppTranslations.get('reviews.weeksAgo', lang)
          .replaceAll('{count}', '${diff.inDays ~/ 7}');
    }
    return "${parsed.day}/${parsed.month}/${parsed.year}";
  }
}
