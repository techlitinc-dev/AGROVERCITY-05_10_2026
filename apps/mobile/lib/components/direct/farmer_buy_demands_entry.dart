import 'package:flutter/material.dart';

import '../../components/common/motion_animations.dart';
import '../../state/app_state.dart';

class FarmerBuyDemandsEntry extends StatelessWidget {
  final AppState state;

  const FarmerBuyDemandsEntry({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    return BouncyPressable(
      onTap: () => state.navigateTo('buyDemands'),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF4F46E5), Color(0xFF4338CA)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF4F46E5).withValues(alpha: 0.3),
              blurRadius: 14,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.campaign_rounded,
                  color: Colors.white, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    state.tr('direct.buyDemandsTitle'),
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    state.tr('direct.buyDemandsSubtitle'),
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontSize: 11.5),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded,
                color: Colors.white, size: 22),
          ],
        ),
      ),
    );
  }
}
