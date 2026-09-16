// Kisan Mitra AI Floating Action Button with Animated AI Chatbot Icon & Interactive Click-to-Popup

import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../common/motion_animations.dart';

class KisanMitraFab extends StatefulWidget {
  final VoidCallback onTap;
  final bool isWomenMode;

  const KisanMitraFab({
    super.key,
    required this.onTap,
    this.isWomenMode = false,
  });

  @override
  State<KisanMitraFab> createState() => _KisanMitraFabState();
}

class _KisanMitraFabState extends State<KisanMitraFab> with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _rotateController;
  late AnimationController _popupController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _glowAnimation;
  late Animation<double> _popupScale;
  late Animation<double> _popupOpacity;

  bool _isPopupOpen = false;

  @override
  void initState() {
    super.initState();
    // 1. Breathing pulse animation
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.06).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _glowAnimation = Tween<double>(begin: 0.4, end: 0.9).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // 2. Rotating ambient halo ring
    _rotateController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat();

    // 3. Click-to-Popup animation
    _popupController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );

    _popupScale = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _popupController, curve: Curves.elasticOut),
    );

    _popupOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _popupController, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _rotateController.dispose();
    _popupController.dispose();
    super.dispose();
  }

  void _handleIconTap() {
    if (!_isPopupOpen) {
      setState(() => _isPopupOpen = true);
      _popupController.forward();
    } else {
      _popupController.reverse().then((_) {
        if (mounted) setState(() => _isPopupOpen = false);
      });
      widget.onTap();
    }
  }

  void _openChatDirectly() {
    _popupController.reverse().then((_) {
      if (mounted) setState(() => _isPopupOpen = false);
    });
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final baseColor = widget.isWomenMode ? const Color(0xFFBE123C) : const Color(0xFF1B5E20);
    final primaryColor = widget.isWomenMode ? const Color(0xFFE11D48) : const Color(0xFF2E7D32);
    final accentGold = widget.isWomenMode ? const Color(0xFFFBBF24) : const Color(0xFF43A047);
    final highlightSpark = widget.isWomenMode ? const Color(0xFFFDE047) : const Color(0xFF81C784);

    return Stack(
      alignment: Alignment.bottomRight,
      clipBehavior: Clip.none,
      children: [
        // 💬 Animated Click-to-Popup Speech Card (reveals "Kisan Mitra AI")
        if (_isPopupOpen)
          Positioned(
            bottom: 66,
            right: 0,
            child: AnimatedBuilder(
              animation: _popupController,
              builder: (context, child) {
                return Opacity(
                  opacity: _popupOpacity.value.clamp(0.0, 1.0),
                  child: Transform.scale(
                    scale: _popupScale.value,
                    alignment: Alignment.bottomRight,
                    child: Container(
                      width: 240,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.98),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: primaryColor.withValues(alpha: 0.4), width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.16),
                            blurRadius: 20,
                            spreadRadius: 2,
                            offset: const Offset(0, 8),
                          ),
                          BoxShadow(
                            color: primaryColor.withValues(alpha: 0.25),
                            blurRadius: 14,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(colors: [primaryColor, accentGold]),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.smart_toy_rounded, color: Colors.white, size: 16),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      "Kisan Mitra AI",
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w900,
                                        color: Color(0xFF112A1F),
                                        letterSpacing: 0.2,
                                      ),
                                    ),
                                    Text(
                                      "किसान मित्र AI • 24x7 Assistant",
                                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Colors.green.shade800),
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close_rounded, size: 18, color: Colors.grey),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                onPressed: () {
                                  _popupController.reverse().then((_) {
                                    if (mounted) setState(() => _isPopupOpen = false);
                                  });
                                },
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            "नमस्ते! फसल, मौसम, मंडी भाव या कीट सलाह हेतु तुरंत बात करें।",
                            style: TextStyle(fontSize: 11, color: Colors.grey.shade700, height: 1.3),
                          ),
                          const SizedBox(height: 10),
                          // CTA Button inside Popup
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: _openChatDirectly,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: primaryColor,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                elevation: 2,
                              ),
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.chat_bubble_outline_rounded, size: 14),
                                  SizedBox(width: 6),
                                  Text("चैट शुरू करें (Open AI) ➔", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

        // 🤖 Ultra-Attractive Animated AI Chatbot Icon Orb
        AnimatedBuilder(
          animation: Listenable.merge([_pulseController, _rotateController]),
          builder: (context, _) {
            return BouncyPressable(
              onTap: _handleIconTap,
              child: Transform.scale(
                scale: _scaleAnimation.value,
                child: Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      // Glowing Ambient Shadow
                      BoxShadow(
                        color: primaryColor.withValues(alpha: _glowAnimation.value * 0.65),
                        blurRadius: 20,
                        spreadRadius: 3,
                        offset: const Offset(0, 4),
                      ),
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.22),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // 1. Rotating Iridescent Halo Ring
                      Transform.rotate(
                        angle: _rotateController.value * 2 * math.pi,
                        child: Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: SweepGradient(
                              colors: [
                                highlightSpark,
                                accentGold,
                                primaryColor,
                                baseColor,
                                highlightSpark,
                              ],
                            ),
                          ),
                        ),
                      ),

                      // 2. Glassmorphic Core Container
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            center: const Alignment(-0.3, -0.3),
                            radius: 1.0,
                            colors: [
                              accentGold,
                              primaryColor,
                              baseColor,
                            ],
                          ),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 2.0),
                        ),
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            // Shimmer Highlight Arc
                            Positioned(
                              top: 3,
                              child: Container(
                                width: 26,
                                height: 8,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(10),
                                  gradient: LinearGradient(
                                    colors: [
                                      Colors.white.withValues(alpha: 0.6),
                                      Colors.transparent,
                                    ],
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                  ),
                                ),
                              ),
                            ),

                            // Main Animated Chatbot Robot Icon
                            const Icon(
                              Icons.smart_toy_rounded,
                              color: Colors.white,
                              size: 28,
                            ),

                            // Mini Sparkle Overlay
                            const Positioned(
                              top: 6,
                              right: 6,
                              child: Icon(
                                Icons.auto_awesome_rounded,
                                color: Color(0xFFFFF59D),
                                size: 11,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // 3. Live Online Status Beacon (Top Right)
                      Positioned(
                        top: 2,
                        right: 2,
                        child: Container(
                          width: 13,
                          height: 13,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFF22C55E),
                            border: Border.all(color: Colors.white, width: 2),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF22C55E).withValues(alpha: 0.8),
                                blurRadius: 6,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
