// Segmented 4-tab switcher for the crop insurance view (split from
// crop_insurance_view.dart for the line cap).

import 'package:flutter/material.dart';

import '../../components/common/motion_animations.dart';

class InsuranceTabBar extends StatelessWidget {
  final int selected;
  final int policyCount;
  final int claimCount;
  final void Function(int index) onSelect;

  const InsuranceTabBar({
    super.key,
    required this.selected,
    required this.policyCount,
    required this.claimCount,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final tabs = [
      {'title': 'मेरी पॉलिसी', 'icon': Icons.description_rounded, 'badge': '$policyCount'},
      {'title': 'दावा सूचना', 'icon': Icons.report_problem_rounded, 'badge': '72h'},
      {'title': 'कैलकुलेटर', 'icon': Icons.calculate_rounded, 'badge': null},
      {'title': 'दावा स्थिति', 'icon': Icons.track_changes_rounded, 'badge': '$claimCount'},
    ];

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: List.generate(tabs.length, (index) {
          final isSelected = selected == index;
          final tab = tabs[index];

          return Expanded(
            child: BouncyPressable(
              onTap: () => onSelect(index),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  gradient: isSelected
                      ? const LinearGradient(
                          colors: [Color(0xFF047857), Color(0xFF065F46)],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        )
                      : null,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Icon(
                          tab['icon'] as IconData,
                          size: 18,
                          color: isSelected ? const Color(0xFFFBBF24) : Colors.grey.shade600,
                        ),
                        if (tab['badge'] != null)
                          Positioned(
                            right: -10,
                            top: -4,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: isSelected ? const Color(0xFFDC2626) : const Color(0xFF047857),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                tab['badge'] as String,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 8,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      tab['title'] as String,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                        color: isSelected ? Colors.white : Colors.grey.shade700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
