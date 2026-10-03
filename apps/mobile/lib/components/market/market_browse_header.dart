// Marketplace browse header — title, search bar & category filter chips.

import 'package:flutter/material.dart';

import '../../components/common/motion_animations.dart';
import '../../state/app_state.dart';

class MarketBrowseHeader extends StatelessWidget {
  final AppState state;
  final String? activeCategory;
  final ValueChanged<String?> onCategoryChanged;
  final ValueChanged<String> onSearchChanged;

  const MarketBrowseHeader({
    super.key,
    required this.state,
    required this.activeCategory,
    required this.onCategoryChanged,
    required this.onSearchChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(state.tr('eMarket'), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                Text(state.tr('reliableMarket'), style: const TextStyle(fontSize: 12, color: Color(0xFF90A4AE))),
              ],
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFECEFF1)),
          ),
          child: Row(
            children: [
              const Icon(Icons.search_rounded, color: Color(0xFF90A4AE), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  onChanged: onSearchChanged,
                  decoration: InputDecoration(
                    hintText: state.tr('marketplaceSearchHint'),
                    hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF90A4AE)),
                    border: InputBorder.none,
                  ),
                ),
              ),
              const Icon(Icons.mic_none_rounded, color: Color(0xFF90A4AE), size: 20),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            {'id': 'Seeds', 'label': state.tr('seedsCategory'), 'icon': '🌱'},
            {'id': 'Vehicles', 'label': state.tr('vehiclesCategory'), 'icon': '🚜'},
            {'id': 'Fertilizer', 'label': state.tr('fertilizersCategory'), 'icon': '🪨'},
            {'id': 'Pesticide', 'label': state.tr('pesticideCategory'), 'icon': '🧴'},
            {'id': 'Tools', 'label': state.tr('toolsCategory'), 'icon': '🧰'},
          ].map((c) {
            final isSel = activeCategory == c['id'];
            return BouncyPressable(
              onTap: () => onCategoryChanged(isSel ? null : c['id']),
              child: Container(
                width: 62,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: isSel ? const Color(0xFF43A047) : const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                    Text(c['icon']!, style: const TextStyle(fontSize: 22)),
                    const SizedBox(height: 4),
                    Text(
                      c['label']!,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: isSel ? Colors.white : const Color(0xFF2E7D32),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}
