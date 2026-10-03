// Plot irrigation schedule card for WaterView (ported styling).

import 'package:flutter/material.dart';

import '../components/common/glass_card.dart';
import '../state/app_state.dart';

class WaterPlotCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final AppState state;
  final bool dripActive;
  final ValueChanged<int> onStartDrip;

  const WaterPlotCard({
    super.key,
    required this.entry,
    required this.state,
    required this.dripActive,
    required this.onStartDrip,
  });

  @override
  Widget build(BuildContext context) {
    final plotName = entry['plotName'] as String? ?? state.tr('water.plotFallback');
    final moisture = (entry['moisturePercent'] as num?)?.toInt() ?? 0;
    final minutes = (entry['recommendedMinutes'] as num?)?.toInt() ?? 0;
    final method = entry['method'] as String? ?? 'drip';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        border: Border.all(color: const Color(0xFF0284C7), width: 1.5),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(plotName,
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0369A1))),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                      color: const Color(0xFFE0F2FE),
                      borderRadius: BorderRadius.circular(8)),
                  child: Text(
                      state.tr('water.moistureLabel').replaceAll('{percent}', '$moisture'),
                      style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0369A1))),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
                state
                    .tr('water.recommendation')
                    .replaceAll('{minutes}', '$minutes')
                    .replaceAll('{method}', method),
                style:
                    const TextStyle(fontSize: 12.5, color: Colors.black87)),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: () => onStartDrip(minutes),
              icon: const Icon(Icons.timer_rounded, size: 16),
              label: Text(
                dripActive
                    ? state.tr('water.dripRunning')
                    : state.tr('water.startDripNow').replaceAll('{minutes}', '$minutes'),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0284C7),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 42)),
            ),
          ],
        ),
      ),
    );
  }
}
