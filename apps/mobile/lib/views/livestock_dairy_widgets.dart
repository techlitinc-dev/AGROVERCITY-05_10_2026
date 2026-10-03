// Livestock & Dairy — emergency bar + gaushala card (split from
// livestock_dairy_view.dart for the line cap; verbatim styling).

import 'package:flutter/material.dart';

import '../components/common/glass_card.dart';
import '../models/livestock_models.dart';
import '../state/app_state.dart';


class EmergencyVetBar extends StatelessWidget {
  final AppState state;
  final bool active;
  final VoidCallback onToggle;

  const EmergencyVetBar({super.key, required this.state, required this.active, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: active ? const Color(0xFFFEE2E2) : const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: active ? const Color(0xFFDC2626) : const Color(0xFFFECACA)),
      ),
      child: Row(
        children: [
          const Icon(Icons.phone_in_talk_rounded, color: Color(0xFFDC2626), size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(state.tr('livestock.emergencyTitle'), style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: Color(0xFF991B1B))),
                Text(state.tr('livestock.emergencySubtitle'), style: const TextStyle(fontSize: 11, color: Color(0xFF7F1D1D))),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: onToggle,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: Text(
              active ? state.tr('livestock.showAll') : state.tr('livestock.callEmergency'),
              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w900),
            ),
          ),        ],
      ),
    );
  }
}

class GaushalaCard extends StatelessWidget {
  final AppState state;
  final GaushalaItem gaushala;
  final VoidCallback onCall;
  final VoidCallback onOrderManure;

  const GaushalaCard({
    super.key,
    required this.state,
    required this.gaushala,
    required this.onCall,
    required this.onOrderManure,
  });

  @override
  Widget build(BuildContext context) {
    final g = gaushala;
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  g.vernacularName,
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '${g.cowCount} ${state.tr('livestock.cattleCount')}',
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: Color(0xFF92400E)),
                ),
              ),
            ],
          ),
          Text(
            "${g.trustName} • ${g.district} (${g.distanceKm} km)",
            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              ...g.breeds.map((b) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(6)),
                    child: Text(b, style: const TextStyle(fontSize: 10.5, color: Color(0xFF374151), fontWeight: FontWeight.w700)),
                  )),
              if (g.providesOrganicManure)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(6)),
                  child: Text(state.tr('livestock.organicManureAvailable'), style: const TextStyle(fontSize: 10.5, color: Color(0xFF15803D), fontWeight: FontWeight.w800)),
                ),
              if (g.offersCowAdoption)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFE0F2FE), borderRadius: BorderRadius.circular(6)),
                  child: Text(state.tr('livestock.cowAdoption'), style: const TextStyle(fontSize: 10.5, color: Color(0xFF0369A1), fontWeight: FontWeight.w800)),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${state.tr('livestock.facilities')} ${g.facilities}',
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF15803D), fontWeight: FontWeight.w600, height: 1.3),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onCall,
                  icon: const Icon(Icons.phone_rounded, size: 14),
                  label: Text(state.tr('livestock.contact'), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF78350F),
                    side: const BorderSide(color: Color(0xFF78350F)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: onOrderManure,
                  icon: const Icon(Icons.eco_rounded, size: 15, color: Colors.white),
                  label: Text(state.tr('livestock.bookManure'), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2E7D32),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

