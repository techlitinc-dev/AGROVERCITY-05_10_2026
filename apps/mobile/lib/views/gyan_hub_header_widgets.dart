// Header banner + tab button for the Gyan Hub view (split from
// gyan_hub_view.dart for the line cap).

import 'package:flutter/material.dart';

import '../components/common/audio_button.dart';
import '../state/app_state.dart';

class GyanHubHeaderBanner extends StatelessWidget {
  final AppState state;

  const GyanHubHeaderBanner({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1B4332), Color(0xFF2D6A4F), Color(0xFFBC6C25)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(color: const Color(0xFF1B4332).withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 6)),
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
                  color: const Color(0xFFE9C46A),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(state.tr('gyanHub.bannerBadge'), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF112A1F))),
              ),
              AudioButton(text: state.tr('gyanHub.audioWelcomeText')),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            state.tr('gyanHub.bannerTitle'),
            style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.3),
          ),
          const SizedBox(height: 4),
          Text(
            state.tr('gyanHub.bannerSubtitle'),
            style: TextStyle(fontSize: 12, color: Color(0xFFD8F3DC), height: 1.4),
          ),
        ],
      ),
    );
  }
}

class GyanHubTabButton extends StatelessWidget {
  final bool selected;
  final String label;
  final VoidCallback onTap;

  const GyanHubTabButton({
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
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8.5),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF1B4332) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: selected ? const Color(0xFF1B4332) : Colors.grey.shade300),
          boxShadow: [
            if (selected)
              BoxShadow(color: const Color(0xFF1B4332).withValues(alpha: 0.25), blurRadius: 8, offset: const Offset(0, 3)),
          ],
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            color: selected ? Colors.white : Colors.black87,
          ),
        ),
      ),
    );
  }
}
