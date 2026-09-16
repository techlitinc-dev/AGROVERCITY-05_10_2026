// Dashboard Quick Multi-Profile Switcher Bar & Role Chips

import 'package:flutter/material.dart';
import '../../api/api_exception.dart';
import '../../state/app_state.dart';
import '../../models/user_profile_type.dart';
import '../common/motion_animations.dart';
import 'profile_switcher_sheet.dart';

class DashboardProfileSwitcherBar extends StatelessWidget {
  final AppState state;
  const DashboardProfileSwitcherBar({super.key, required this.state});

  void _openFullSwitcher(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ProfileSwitcherSheet(state: state),
    );
  }

  Future<void> _activate(BuildContext context, UserProfileType type) async {
    try {
      await state.activateProfileApi(type);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeMeta = state.activeProfileMeta;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: activeMeta.primaryColor.withValues(alpha: 0.25), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: activeMeta.primaryColor.withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row: Active Profile Label + Switcher Action Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color: activeMeta.primaryColor.withValues(alpha: 0.14),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(activeMeta.icon, size: 14, color: activeMeta.primaryColor),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    "भूमिका स्विच करें (Switch Role):",
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF1E293B),
                    ),
                  ),
                ],
              ),
              BouncyPressable(
                onTap: () => _openFullSwitcher(context),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                  decoration: BoxDecoration(
                    color: activeMeta.primaryColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: activeMeta.primaryColor.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.tune_rounded, size: 12, color: activeMeta.primaryColor),
                      const SizedBox(width: 3),
                      Text(
                        "सभी देखें (${state.linkedProfiles.length}) ▾",
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: activeMeta.primaryColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Horizontal Role Switcher Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                ...state.linkedProfiles.map((type) {
                  final meta = UserProfileRegistry.meta(type);
                  final isActive = state.activeProfile == type;

                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: BouncyPressable(
                      onTap: () => _activate(context, type),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 240),
                        curve: Curves.easeOutCubic,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          gradient: isActive
                              ? LinearGradient(
                                  colors: [meta.primaryColor, meta.accentColor],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                )
                              : null,
                          color: isActive ? null : Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isActive ? meta.primaryColor : Colors.grey.shade300,
                            width: isActive ? 1.5 : 1.0,
                          ),
                          boxShadow: isActive
                              ? [
                                  BoxShadow(
                                    color: meta.primaryColor.withValues(alpha: 0.35),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ]
                              : null,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              meta.icon,
                              size: 14,
                              color: isActive ? Colors.white : meta.primaryColor,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              meta.labelHi,
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: isActive ? FontWeight.w900 : FontWeight.w700,
                                color: isActive ? Colors.white : const Color(0xFF1E293B),
                              ),
                            ),
                            if (isActive) ...[
                              const SizedBox(width: 4),
                              Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  );
                }),

                // Add Role Chip Action
                BouncyPressable(
                  onTap: () => _openFullSwitcher(context),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.green.shade300, style: BorderStyle.solid),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add_circle_outline_rounded, size: 14, color: Color(0xFF16A34A)),
                        SizedBox(width: 4),
                        Text(
                          "जोड़ें +",
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF16A34A),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
