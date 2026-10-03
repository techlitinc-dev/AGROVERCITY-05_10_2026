// Shared helpers for the advisory tabs.

import 'package:flutter/material.dart';

import '../../../state/app_state.dart';

(double, double) farmCentroid(AppState state) {
  final points = state.profile.farmBoundaryPoints;
  if (points.isEmpty) return (20.0, 73.8);
  final lat =
      points.map((p) => p['lat'] ?? 0.0).reduce((a, b) => a + b) / points.length;
  final lng =
      points.map((p) => p['lng'] ?? 0.0).reduce((a, b) => a + b) / points.length;
  return (lat, lng);
}

Color riskColor(String level) => switch (level) {
      'red' => Colors.red,
      'yellow' => Colors.orange,
      _ => Colors.green,
    };

String riskLabel(AppState state, String level) => switch (level) {
      'red' => state.tr('advisory.riskRed'),
      'yellow' => state.tr('advisory.riskYellow'),
      _ => state.tr('advisory.riskGreen'),
    };

class AdvisoryAsyncError extends StatelessWidget {
  const AdvisoryAsyncError({super.key, required this.state, required this.onRetry});

  final AppState state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFDBA74)),
      ),
      child: Column(
        children: [
          const Icon(Icons.cloud_off_rounded, color: Color(0xFFEA580C), size: 22),
          const SizedBox(height: 6),
          Text(
            state.tr('common.loadFailed'),
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF9A3412)),
          ),
          TextButton(
            onPressed: onRetry,
            child: Text(
              state.tr('retry'),
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFFEA580C)),
            ),
          ),
        ],
      ),
    );
  }
}

class AdvisoryLoading extends StatelessWidget {
  const AdvisoryLoading({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < 2; i++)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            height: 84,
            decoration: BoxDecoration(
              color: Colors.grey.shade200,
              borderRadius: BorderRadius.circular(16),
            ),
          ),
      ],
    );
  }
}
