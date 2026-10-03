// Tree Plantation — article + NGO cards (split from tree_plantation_view.dart
// for the line cap; verbatim styling).

import 'package:flutter/material.dart';

import '../components/common/glass_card.dart';
import '../components/common/motion_animations.dart';
import '../models/tree_models.dart';
import '../state/app_state.dart';

class TreeArticleCard extends StatelessWidget {
  final TreeArticle article;
  final AppState state;
  final VoidCallback onReadMore;

  const TreeArticleCard({
    super.key,
    required this.article,
    required this.state,
    required this.onReadMore,
  });

  @override
  Widget build(BuildContext context) {
    final art = article;
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
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  art.category,
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32)),
                ),
              ),
              Text("${state.tr('tree.readTimeLabel')}: ${art.readTime}", style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            art.vernacularTitle,
            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
          ),
          const SizedBox(height: 4),
          Text(
            art.summary,
            style: const TextStyle(fontSize: 12, color: Color(0xFF4B5563), height: 1.4),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("✍️ ${art.author}", style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
              BouncyPressable(
                onTap: onReadMore,
                child: Text(
                  state.tr('tree.readMore'),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF2E7D32)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class NgoCard extends StatelessWidget {
  final NgoOrganization ngo;
  final AppState state;
  final VoidCallback onCall;
  final VoidCallback onRequestSaplings;

  const NgoCard({
    super.key,
    required this.ngo,
    required this.state,
    required this.onCall,
    required this.onRequestSaplings,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.nature_people_rounded, color: Color(0xFF1B5E20), size: 24),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      ngo.vernacularName,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                    ),
                    Text(
                      "${state.tr('tree.serviceArea')}: ${ngo.location}",
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                    ),
                    Row(
                      children: [
                        const Icon(Icons.star_rounded, size: 14, color: Color(0xFFEAB308)),
                        Text(" ${ngo.rating} • ${ngo.treesPlantedCount ~/ 1000}K+ ${state.tr('tree.treesPlanted')}", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ],
                ),
              ),
              if (ngo.providesFreeSaplings)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF86EFAC)),
                  ),
                  child: Text(state.tr('tree.freeSaplings'), style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFF15803D))),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: ngo.servicesOffered.map((s) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(s, style: const TextStyle(fontSize: 10.5, color: Color(0xFF374151), fontWeight: FontWeight.w600)),
            )).toList(),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onCall,
                  icon: const Icon(Icons.phone_rounded, size: 14),
                  label: Text(state.tr('tree.callNgo'), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF1B4332),
                    side: const BorderSide(color: Color(0xFF1B4332)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: onRequestSaplings,
                  icon: const Icon(Icons.forest_rounded, size: 15, color: Colors.white),
                  label: Text(state.tr('tree.applyFreeSaplings'), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.white)),
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
