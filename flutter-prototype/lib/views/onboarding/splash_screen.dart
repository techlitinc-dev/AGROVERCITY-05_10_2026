// Step 1: Animated Splash Screen (DDS Logo Pop-Up <1s -> Kisan Setu Brand Reveal -> Language Selection)

import 'dart:async';
import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../components/common/motion_animations.dart';

class SplashScreen extends StatefulWidget {
  final AppState state;
  const SplashScreen({super.key, required this.state});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  // 'dds_popup' (Phase 1: <1 sec) -> 'kisan_setu' (Phase 2: Brand Reveal)
  String _currentPhase = 'dds_popup';

  late AnimationController _ddsScaleController;
  late Animation<double> _ddsScaleAnimation;
  late Animation<double> _ddsGlowAnimation;

  late AnimationController _fadeController;
  Timer? _ddsAutoAdvanceTimer;
  Timer? _kisanSetuAutoAdvanceTimer;

  @override
  void initState() {
    super.initState();

    // 1. Fade transition controller between phases
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    )..forward();

    // 2. Elastic Pop-up Controller for DDS Logo (< 1 sec entrance)
    _ddsScaleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 550),
    );

    _ddsScaleAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _ddsScaleController, curve: Curves.elasticOut),
    );

    _ddsGlowAnimation = Tween<double>(begin: 0.2, end: 0.85).animate(
      CurvedAnimation(parent: _ddsScaleController, curve: Curves.easeOut),
    );

    // Launch DDS Logo Pop-Up immediately
    _ddsScaleController.forward();

    // Automatically transition after 750ms (< 1 second)
    _ddsAutoAdvanceTimer = Timer(const Duration(milliseconds: 750), () {
      if (mounted) _transitionToKisanSetu();
    });
  }

  void _transitionToKisanSetu() {
    if (!mounted || _currentPhase == 'kisan_setu') return;

    _fadeController.reverse().then((_) {
      if (!mounted) return;
      setState(() {
        _currentPhase = 'kisan_setu';
      });
      _fadeController.forward();

      // Show Kisan Setu Brand for 1.8 seconds, then advance to language/onboarding
      _kisanSetuAutoAdvanceTimer = Timer(const Duration(milliseconds: 1800), () {
        if (mounted) _advanceToNext();
      });
    });
  }

  void _advanceToNext() {
    if (!mounted) return;
    _fadeController.reverse().then((_) {
      if (mounted) {
        widget.state.advanceFromSplash();
      }
    });
  }

  @override
  void dispose() {
    _ddsAutoAdvanceTimer?.cancel();
    _kisanSetuAutoAdvanceTimer?.cancel();
    _ddsScaleController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A1E14),
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          // Instant skip on tap
          if (_currentPhase == 'dds_popup') {
            _ddsAutoAdvanceTimer?.cancel();
            _transitionToKisanSetu();
          } else {
            _kisanSetuAutoAdvanceTimer?.cancel();
            _advanceToNext();
          }
        },
        child: FloatingParticlesBackground(
          isWomenMode: widget.state.isWomenMode,
          child: SafeArea(
            child: FadeTransition(
              opacity: _fadeController,
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 400),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeInCubic,
                child: _currentPhase == 'dds_popup'
                    ? _buildDdsLogoPhase(context)
                    : _buildKisanSetuLogoPhase(context),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ==========================================
  // PHASE 1: Fast DDS Logo Pop-Up (< 1 Sec)
  // ==========================================
  Widget _buildDdsLogoPhase(BuildContext context) {
    return KeyedSubtree(
      key: const ValueKey('dds_logo_phase'),
      child: Center(
        child: AnimatedBuilder(
          animation: _ddsScaleController,
          builder: (context, child) {
            return Transform.scale(
              scale: _ddsScaleAnimation.value,
              child: Container(
                width: 140,
                height: 140,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(32),
                  border: Border.all(color: const Color(0xFF81C784), width: 2.5),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF43A047).withValues(alpha: _ddsGlowAnimation.value * 0.7),
                      blurRadius: 36,
                      spreadRadius: 6,
                      offset: const Offset(0, 4),
                    ),
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: Image.asset(
                    'assets/dds logo.jpg.jpg',
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) {
                      return const Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.business_rounded, color: Color(0xFF2E7D32), size: 48),
                            SizedBox(height: 4),
                            Text(
                              "DDS",
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1B5E20),
                                letterSpacing: 2,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  // ==========================================
  // PHASE 2: AGROVERCITY Brand Logo Reveal
  // ==========================================
  Widget _buildKisanSetuLogoPhase(BuildContext context) {
    return KeyedSubtree(
      key: const ValueKey('kisan_setu_phase'),
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 🌾 Official AGROVERCITY Crop Logo with Glowing Border & Container
              StaggeredSlideFade(
                delayMs: 0,
                duration: const Duration(milliseconds: 600),
                child: Container(
                  width: 145,
                  height: 145,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(32),
                    border: Border.all(color: const Color(0xFF81C784), width: 2.5),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF43A047).withValues(alpha: 0.55),
                        blurRadius: 38,
                        spreadRadius: 6,
                        offset: const Offset(0, 4),
                      ),
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.35),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: Image.asset(
                      'assets/app_icon.png',
                      fit: BoxFit.contain,
                      errorBuilder: (context, error, stackTrace) {
                        return const Center(
                          child: Icon(
                            Icons.eco_rounded,
                            color: Color(0xFF2E7D32),
                            size: 64,
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 28),

              // 🌿 App Title with Glossy Green Finish & Subtitle
              StaggeredSlideFade(
                delayMs: 100,
                duration: const Duration(milliseconds: 500),
                child: Column(
                  children: [
                    ShaderMask(
                      shaderCallback: (bounds) => const LinearGradient(
                        colors: [
                          Color(0xFF0F5132),
                          Color(0xFF198754),
                          Color(0xFF20C997),
                          Color(0xFF198754),
                          Color(0xFF0F5132),
                        ],
                        stops: [0.0, 0.25, 0.5, 0.75, 1.0],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ).createShader(bounds),
                      child: const Text(
                        "AGROVERCITY",
                        style: TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: 4.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      "AGROVERCITY • डिजिटल कृषि प्लेटफॉर्म",
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF2E7D32),
                        letterSpacing: 0.8,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 38),

              // 🔘 1-Tap "Get Started / आगे बढ़ें" Action Button
              StaggeredSlideFade(
                delayMs: 250,
                duration: const Duration(milliseconds: 500),
                child: BouncyPressable(
                  onTap: _advanceToNext,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF43A047), Color(0xFF2E7D32)],
                      ),
                      borderRadius: BorderRadius.circular(28),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF2E7D32).withValues(alpha: 0.5),
                          blurRadius: 18,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          "शुरू करें (Get Started)",
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.3,
                          ),
                        ),
                        SizedBox(width: 8),
                        Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 16),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
