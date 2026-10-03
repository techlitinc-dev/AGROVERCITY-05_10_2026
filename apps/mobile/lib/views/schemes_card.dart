// Scheme card widget for SchemesView (ported styling from flutter-prototype).

import 'package:flutter/material.dart';

import '../components/common/glass_card.dart';
import '../components/common/motion_animations.dart';
import '../models/govt_scheme.dart';
import '../state/app_state.dart';

class SchemeCard extends StatelessWidget {
  final AppState state;
  final GovtScheme scheme;
  final String categoryLabel;
  final String? soilBookingStatus;
  final VoidCallback onApply;
  final VoidCallback onPortal;
  final VoidCallback onBookSoilTest;

  const SchemeCard({
    super.key,
    required this.state,
    required this.scheme,
    required this.categoryLabel,
    required this.onApply,
    required this.onPortal,
    required this.onBookSoilTest,
    this.soilBookingStatus,
  });

  @override
  Widget build(BuildContext context) {
    final s = scheme;
    return GlassCard(
      backgroundColor: Colors.white,
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          categoryLabel,
                          style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF43A047),
                              fontWeight: FontWeight.w800),
                        ),
                        if (s.eligible) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(state.tr('schemes.eligible'),
                                style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF15803D))),
                          ),
                        ],
                      ],
                    ),
                    Text(s.name,
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF263238))),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                    color: const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(8)),
                child: Text(s.benefitAmount,
                    style: const TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF2E7D32))),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(s.description,
              style: const TextStyle(fontSize: 12, color: Colors.black87)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
                color: const Color(0xFFF5F7FA),
                borderRadius: BorderRadius.circular(8)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${state.tr('schemes.status')}: ${s.status}',
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF263238))),
                Text('${state.tr('schemes.deadline')}: ${s.nextDeadline}',
                    style:
                        const TextStyle(fontSize: 10.5, color: Colors.grey)),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: BouncyPressable(
                  onTap: onApply,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 9),
                    decoration: BoxDecoration(
                      color: const Color(0xFF43A047),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.check_rounded,
                            size: 14, color: Colors.white),
                        const SizedBox(width: 4),
                        Text(state.tr('schemes.applyFromApp'),
                            style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                                color: Colors.white)),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: BouncyPressable(
                  onTap: onPortal,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF2E7D32)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.open_in_new_rounded,
                            size: 14, color: Color(0xFF2E7D32)),
                        const SizedBox(width: 4),
                        Text(state.tr('schemes.officialPortalBtn'),
                            style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF2E7D32))),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (s.category == 'soil') ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onBookSoilTest,
                    icon: const Icon(Icons.science_rounded, size: 15),
                    label: Text(state.tr('schemes.bookSoilTest'),
                        style: const TextStyle(
                            fontSize: 11.5, fontWeight: FontWeight.w800)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF2E7D32),
                    ),
                  ),
                ),
                if (soilBookingStatus != null) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF8E1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      soilBookingStatus!,
                      style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFF57F17)),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class SchemesHeader extends StatelessWidget {
  final AppState state;
  final VoidCallback onOpenVault;

  const SchemesHeader(
      {super.key, required this.state, required this.onOpenVault});

  @override
  Widget build(BuildContext context) {
    return StaggeredSlideFade(
      delayMs: 0,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(state.tr('schemes'),
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF263238))),
              Text(state.tr('schemes.hybridAccess'),
                  style: const TextStyle(
                      fontSize: 11.5, color: Color(0xFF90A4AE))),
            ],
          ),
          BouncyPressable(
            onTap: onOpenVault,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF43A047)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.lock_outline_rounded,
                      size: 14, color: Color(0xFF43A047)),
                  const SizedBox(width: 4),
                  Text(state.tr('schemes.vault'),
                      style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF43A047))),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
