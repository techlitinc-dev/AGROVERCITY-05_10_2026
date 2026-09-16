import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../common/motion_animations.dart';

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

    // Clean primary village name
    final villageShort = state.profile.village.contains(' ')
        ? state.profile.village.split(' ').first
        : state.profile.village;

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
          // 🌿 1. LEFT BRAND SECTION (Back Button + Squircle Logo + AGROVERCITY PRO + Location)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 🔙 Back Button (Themed icon only, no button name)
              if (state.canGoBack) ...[
                Tooltip(
                  message: "वापस जाएं (Back)",
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
                          "$villageShort • 27°C",
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

          // 🪙 2. RIGHT ACTIONS (Spray Alert + Coins + Dedicated Log Out Button)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // A. Dynamic Spray Alert Capsule
              GestureDetector(
                onTap: () => state.navigateTo('advisory'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4.5),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: state.urgentTaskDone ? const Color(0xFF22C55E) : const Color(0xFFE9C46A),
                      width: 1.1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: (state.urgentTaskDone ? const Color(0xFF22C55E) : const Color(0xFFE9C46A)).withValues(alpha: 0.25),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        state.urgentTaskDone ? Icons.check_circle_rounded : Icons.shield_rounded,
                        size: 12,
                        color: state.urgentTaskDone ? const Color(0xFF86EFAC) : const Color(0xFFE9C46A),
                      ),
                      const SizedBox(width: 3.5),
                      Text(
                        state.urgentTaskDone ? "पूरा ✅" : "9 AM",
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: state.urgentTaskDone ? const Color(0xFF86EFAC) : const Color(0xFFE9C46A),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 5),

              // B. AgriCoins Pill ($ 1450)
              GestureDetector(
                onTap: () => state.navigateTo('krishiRatna'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4.5),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF2A200B), Color(0xFF3D2D0F)],
                    ),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: const Color(0xFFE9C46A).withValues(alpha: 0.85),
                      width: 1.0,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.monetization_on_rounded, size: 12.5, color: Color(0xFFE9C46A)),
                      const SizedBox(width: 3),
                      Text(
                        "${state.profile.agriCoins}",
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFE9C46A),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 5),

              // C. 🚪 DEDICATED RED LOG OUT BUTTON (Always visible at top-right on every page)
              Tooltip(
                message: "लॉग आउट (Log Out)",
                child: BouncyPressable(
                  onTap: () => _showLogoutDialog(context, state),
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [
                          Color(0xFFEF4444),
                          Color(0xFFDC2626),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: Colors.white,
                        width: 1.4,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFDC2626).withValues(alpha: 0.55),
                          blurRadius: 5,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.logout_rounded,
                        size: 15,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showLogoutDialog(BuildContext context, AppState state) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: const BoxDecoration(
                color: Color(0xFFFEE2E2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626), size: 20),
            ),
            const SizedBox(width: 10),
            const Text(
              "लॉग आउट करें?",
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w900,
                color: Color(0xFF112A1F),
              ),
            ),
          ],
        ),
        content: const Text(
          "क्या आप वाकई AGROVERCITY से लॉग आउट करना चाहते हैं? आपका खाता व डेटा सुरक्षित रहेगा।",
          style: TextStyle(fontSize: 13, color: Color(0xFF4B5563), height: 1.4),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              "रद्द करें (Cancel)",
              style: TextStyle(
                color: Color(0xFF6B7280),
                fontWeight: FontWeight.w700,
                fontSize: 12.5,
              ),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              elevation: 2,
            ),
            onPressed: () {
              Navigator.pop(ctx);
              state.logout();
            },
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.logout_rounded, size: 14),
                SizedBox(width: 5),
                Text(
                  "लॉग आउट (Log Out)",
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
