// Hero banner + tab pill for the Livestock & Dairy view (split from
// livestock_dairy_view.dart for the line cap).

import 'package:flutter/material.dart';

import '../components/common/audio_button.dart';
import '../components/common/motion_animations.dart';
import '../state/app_state.dart';

class LivestockHeroBanner extends StatelessWidget {
  final AppState state;

  const LivestockHeroBanner({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    return StaggeredSlideFade(
      delayMs: 0,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF78350F), Color(0xFFB45309), Color(0xFFD97706)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFB45309).withValues(alpha: 0.35),
              blurRadius: 18,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.pets_rounded, size: 14, color: Color(0xFF78350F)),
                      const SizedBox(width: 4),
                      Text(state.tr('livestock.heroTag'), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF78350F))),
                    ],
                  ),
                ),
                AudioButton(text: state.tr('livestock.heroAudio')),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              state.tr('livestock.heroTitle'),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.3),
            ),
            const SizedBox(height: 4),
            Text(
              state.tr('livestock.heroSubtitle'),
              style: const TextStyle(fontSize: 12, color: Color(0xFFFEF3C7), height: 1.35),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                LivestockHeroBadge(top: '380+ ${state.tr('livestock.cattleCount')}', bottom: state.tr('livestock.badgePanchavati')),
                const SizedBox(width: 8),
                LivestockHeroBadge(top: '24x7 ${state.tr('livestock.badgeHelp')}', bottom: state.tr('livestock.badgeDoctorHelpline')),
                const SizedBox(width: 8),
                LivestockHeroBadge(top: '100% ${state.tr('livestock.pure')}', bottom: state.tr('livestock.badgeA2Desi')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class LivestockHeroBadge extends StatelessWidget {
  final String top;
  final String bottom;

  const LivestockHeroBadge({super.key, required this.top, required this.bottom});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(top, style: const TextStyle(color: Color(0xFFFEF3C7), fontSize: 11.5, fontWeight: FontWeight.w900)),
          Text(bottom, style: const TextStyle(color: Colors.white70, fontSize: 9, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class LivestockTabPill extends StatelessWidget {
  final bool selected;
  final String label;
  final VoidCallback onTap;

  const LivestockTabPill({
    super.key,
    required this.selected,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF78350F) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? const Color(0xFF78350F) : Colors.grey.shade300,
            width: selected ? 1.5 : 1.0,
          ),
          boxShadow: [
            if (selected)
              BoxShadow(
                color: const Color(0xFF78350F).withValues(alpha: 0.25),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
          ],
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w900 : FontWeight.w700,
            color: selected ? Colors.white : const Color(0xFF374151),
          ),
        ),
      ),
    );
  }
}
