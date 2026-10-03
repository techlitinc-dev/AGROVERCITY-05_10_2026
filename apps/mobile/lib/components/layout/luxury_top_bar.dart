import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../state/profile_routes.dart';
import '../common/motion_animations.dart';
import 'luxury_top_bar_actions.dart';

class LuxuryTopBar extends StatelessWidget {
  final AppState state;
  final VoidCallback onOpenVoice;
  final VoidCallback onOpenAllTools;

  const LuxuryTopBar({
    super.key,
    required this.state,
    required this.onOpenVoice,
    required this.onOpenAllTools,
  });

  @override
  Widget build(BuildContext context) {
    final isWomen = state.isWomenMode;
    final themeColor = isWomen ? const Color(0xFFFDA4AF) : const Color(0xFFE9C46A);

    // Clean primary village name — hidden entirely until the profile is
    // hydrated from the backend (no fabricated location or temperature).
    final village = state.profile.village;
    final villageShort =
        village.contains(' ') ? village.split(' ').first : village;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        // 🌿 Pure Rich Glossy Green Bar (or Rose/Ruby in Women Mode)
        gradient: LinearGradient(
          colors: isWomen
              ? const [
                  Color(0xFF700C2B),
                  Color(0xFF9F1239),
                  Color(0xFFBE123C),
                ]
              : const [
                  Color(0xFF135022),
                  Color(0xFF1B6B2E),
                  Color(0xFF28833F),
                ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        border: Border(
          top: BorderSide(
            color: Colors.white.withValues(alpha: 0.22),
            width: 1.0,
          ),
          bottom: BorderSide(
            color: Colors.black.withValues(alpha: 0.25),
            width: 1.0,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // 🌿 1. LEFT BRAND SECTION (Back/Home Buttons + Squircle Logo + AGROVERCITY PRO + Location)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 🔙 Back Button (Themed icon only, no button name)
              if (state.canGoBack) ...[
                Tooltip(
                  message: state.tr('back'),
                  child: BouncyPressable(
                    onTap: () => state.navigateBack(),
                    child: Container(
                      width: 30,
                      height: 30,
                      margin: const EdgeInsets.only(right: 6),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isWomen
                              ? [
                                  const Color(0xFF881337).withValues(alpha: 0.9),
                                  const Color(0xFF9F1239).withValues(alpha: 0.7),
                                ]
                              : [
                                  const Color(0xFF0F3818).withValues(alpha: 0.9),
                                  const Color(0xFF165324).withValues(alpha: 0.7),
                                ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: themeColor,
                          width: 1.4,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: themeColor.withValues(alpha: 0.35),
                            blurRadius: 5,
                            offset: const Offset(0, 1.5),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Icon(
                          Icons.arrow_back_rounded,
                          size: 17,
                          color: themeColor,
                        ),
                      ),
                    ),
                  ),
                ),
              ],

              // 🏠 Home Button — back to the dashboard shown right after registration
              Tooltip(
                message: state.tr('home'),
                child: BouncyPressable(
                  onTap: () => state
                      .navigateTo(ProfileRoutes.defaultRouteFor(state.activeProfile)),
                  child: Container(
                    width: 30,
                    height: 30,
                    margin: const EdgeInsets.only(right: 6),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: isWomen
                            ? [
                                const Color(0xFF881337).withValues(alpha: 0.9),
                                const Color(0xFF9F1239).withValues(alpha: 0.7),
                              ]
                            : [
                                const Color(0xFF0F3818).withValues(alpha: 0.9),
                                const Color(0xFF165324).withValues(alpha: 0.7),
                              ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: themeColor,
                        width: 1.4,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: themeColor.withValues(alpha: 0.35),
                          blurRadius: 5,
                          offset: const Offset(0, 1.5),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Icon(
                        Icons.home_rounded,
                        size: 17,
                        color: themeColor,
                      ),
                    ),
                  ),
                ),
              ),

              // Squircle Logo Emblem
              GestureDetector(
                onTap: onOpenAllTools,
                child: Container(
                  width: 32,
                  height: 32,
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(
                      color: const Color(0xFFE9C46A),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFE9C46A).withValues(alpha: 0.45),
                        blurRadius: 6,
                        offset: const Offset(0, 1.5),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: Image.asset(
                      'assets/app_icon.png',
                      fit: BoxFit.contain,
                      errorBuilder: (context, error, stackTrace) => const Icon(
                        Icons.eco_rounded,
                        color: Color(0xFF2E7D32),
                        size: 18,
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(width: 7),

              // Brand Title & Location
              GestureDetector(
                onTap: onOpenAllTools,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          state.tr('appName'),
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4.5, vertical: 1),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE9C46A),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            "PRO",
                            style: TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF112A1F),
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (village.isNotEmpty)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.location_on_rounded,
                            size: 10,
                            color: Color(0xFF86EFAC),
                          ),
                          const SizedBox(width: 2.5),
                          Text(
                            villageShort,
                            style: const TextStyle(
                              fontSize: 10.5,
                              color: Color(0xFFD8F3DC),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ],
          ),

          // 🪙 2. RIGHT ACTIONS (Spray Alert + Coins + Bell + Avatar + Log Out)
          TopBarActions(state: state, isWomen: isWomen),
        ],
      ),
    );
  }
}
