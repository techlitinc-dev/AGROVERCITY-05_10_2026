// Generic "module under construction" placeholder screen.
//
// Used for bottom-menu-bar destinations that do not have a real backend
// module yet (e.g. Wallet, Profile hub). Renders a static empty state —
// no mock data, no fabricated content — localized via translation keys.

import 'package:flutter/material.dart';
import '../../models/user_profile_type.dart';
import '../../state/app_state.dart';
import '../../components/common/motion_animations.dart';

class ModulePlaceholderView extends StatelessWidget {
  final AppState state;
  final IconData icon;
  final String titleKey;
  final String subtitleKey;

  const ModulePlaceholderView({
    super.key,
    required this.state,
    required this.icon,
    required this.titleKey,
    required this.subtitleKey,
  });

  @override
  Widget build(BuildContext context) {
    final personaColor =
        UserProfileRegistry.meta(state.activeProfile).primaryColor;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      children: [
        StaggeredSlideFade(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.96),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.7),
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              children: [
                Container(
                  width: 84,
                  height: 84,
                  decoration: BoxDecoration(
                    color: personaColor.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: personaColor.withValues(alpha: 0.45),
                      width: 1.6,
                    ),
                  ),
                  child: Icon(icon, size: 38, color: personaColor),
                ),
                const SizedBox(height: 20),
                Text(
                  state.tr(titleKey),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1B4332),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  state.tr(subtitleKey),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.5,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade700,
                  ),
                ),
                const SizedBox(height: 18),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: personaColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: personaColor.withValues(alpha: 0.5),
                      width: 1.2,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.schedule_rounded,
                          size: 13, color: personaColor),
                      const SizedBox(width: 6),
                      Text(
                        state.tr('navigation.comingSoon'),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: personaColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
