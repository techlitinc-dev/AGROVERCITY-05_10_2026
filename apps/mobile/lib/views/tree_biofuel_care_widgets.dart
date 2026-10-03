// Tree Plantation — biofuel tree card + care guide card (split from
// tree_plantation_view.dart for the line cap; verbatim styling).

import 'package:flutter/material.dart';

import '../components/common/glass_card.dart';
import '../models/tree_models.dart';
import '../state/app_state.dart';

class BiofuelTreeCard extends StatelessWidget {
  final BiofuelTree tree;
  final AppState state;
  const BiofuelTreeCard({super.key, required this.tree, required this.state});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                tree.name,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Text(
                  tree.oilContentPercent,
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: Color(0xFF92400E)),
                ),
              ),
            ],
          ),
          Text(
            "${state.tr('tree.botanicalNameLabel')}: ${tree.botanicalName}",
            style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 8),
          Text(
            tree.vernacularName,
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF1B5E20)),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF9FAFB),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              children: [
                _infoRow("${state.tr('tree.expectedProfit')}:", tree.expectedReturnPerAcre, Colors.green.shade800),
                _infoRow("${state.tr('tree.duration')}:", tree.gestationPeriod, Colors.black87),
                _infoRow("${state.tr('tree.soilSuitability')}:", tree.suitability, Colors.black87),
                _infoRow("${state.tr('tree.subsidyScheme')}:", tree.subsidyScheme, const Color(0xFF1D4ED8)),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(
            "${state.tr('tree.buyerMarket')}: ${tree.buyerMarket}",
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value, Color valColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 105,
            child: Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w600)),
          ),
          Expanded(
            child: Text(value, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: valColor)),
          ),
        ],
      ),
    );
  }
}

class CareGuideCard extends StatelessWidget {
  final TreeCareGuide guide;
  final AppState state;
  const CareGuideCard({super.key, required this.guide, required this.state});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFF1B4332),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  "${guide.stepNumber}",
                  style: const TextStyle(color: Color(0xFFE9C46A), fontSize: 12, fontWeight: FontWeight.w900),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      guide.vernacularTitle,
                      style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                    ),
                    Text("${state.tr('tree.duration')}: ${guide.stage}", style: const TextStyle(fontSize: 11, color: Color(0xFF2E7D32), fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(guide.instructions, style: const TextStyle(fontSize: 12.5, color: Color(0xFF263238), height: 1.4)),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _careDetailRow(Icons.water_drop_rounded, "${state.tr('tree.watering')}:", guide.wateringRule, const Color(0xFF0284C7)),
                const SizedBox(height: 4),
                _careDetailRow(Icons.science_rounded, "${state.tr('tree.fertilizerSchedule')}:", guide.fertilizerSchedule, const Color(0xFF15803D)),
                const SizedBox(height: 4),
                _careDetailRow(Icons.shield_rounded, "${state.tr('tree.pestProtection')}:", guide.pestProtection, const Color(0xFFB45309)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _careDetailRow(IconData icon, String title, String detail, Color iconColor) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 14, color: iconColor),
        const SizedBox(width: 6),
        Text(title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF1F2937))),
        const SizedBox(width: 4),
        Expanded(
          child: Text(detail, style: const TextStyle(fontSize: 11, color: Color(0xFF4B5563), height: 1.3)),
        ),
      ],
    );
  }
}
