// Shared course/podcast UI helpers (module 27).

import 'package:flutter/material.dart';
import '../../state/app_state.dart';

IconData courseKindIcon(String kind) => switch (kind) {
      'courseMaterial' => Icons.menu_book_rounded,
      'audioPodcast' => Icons.graphic_eq_rounded,
      _ => Icons.play_circle_fill_rounded,
    };

String courseKindLabel(AppState state, String kind) => switch (kind) {
      'courseMaterial' => state.tr('kindCourseMaterial'),
      'audioPodcast' => state.tr('kindAudioPodcast'),
      _ => state.tr('kindVideoPodcast'),
    };

String courseStatusLabel(AppState state, String status) => switch (status) {
      'published' => state.tr('statusPublished'),
      'rejected' => state.tr('statusRejected'),
      _ => state.tr('statusPendingReview'),
    };

Color courseStatusColor(String status) => switch (status) {
      'published' => const Color(0xFF16A34A),
      'rejected' => const Color(0xFFDC2626),
      _ => const Color(0xFFD97706),
    };

String coursePriceLabel(AppState state, Map<String, dynamic> course) {
  final price = (course['priceRupees'] as num?)?.toDouble() ?? 0;
  return price == 0 ? state.tr('freeLabel') : '₹${price.round()}';
}

/// Small coloured status chip used in the instructor studio list.
Widget courseStatusChip(AppState state, String status) {
  final color = courseStatusColor(status);
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: color.withValues(alpha: 0.4)),
    ),
    child: Text(
      courseStatusLabel(state, status),
      style: TextStyle(
          fontSize: 10, fontWeight: FontWeight.w900, color: color),
    ),
  );
}

/// Course card artwork: thumbnail if present, otherwise a kind-tinted tile.
Widget courseArtwork(Map<String, dynamic> course,
    {double height = 120, double iconSize = 40}) {
  final thumbnail = course['thumbnailUrl'] as String?;
  final kind = course['kind'] as String? ?? 'videoPodcast';
  final base = switch (kind) {
    'courseMaterial' => const Color(0xFF0284C7),
    'audioPodcast' => const Color(0xFFEA580C),
    _ => const Color(0xFF7C3AED),
  };
  if (thumbnail != null && thumbnail.isNotEmpty) {
    return Image.network(
      thumbnail,
      height: height,
      width: double.infinity,
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) =>
          _artworkPlaceholder(base, kind, height, iconSize),
    );
  }
  return _artworkPlaceholder(base, kind, height, iconSize);
}

Widget _artworkPlaceholder(Color base, String kind, double height, double iconSize) {
  return Container(
    height: height,
    width: double.infinity,
    decoration: BoxDecoration(
      gradient: LinearGradient(
        colors: [base, base.withValues(alpha: 0.7)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    ),
    child: Icon(courseKindIcon(kind), color: Colors.white, size: iconSize),
  );
}
