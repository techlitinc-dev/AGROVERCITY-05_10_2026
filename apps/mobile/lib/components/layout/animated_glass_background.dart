// Animated Radiant Glassmorphic Mesh Background with Floating Color Orbs

import 'dart:math' as math;
import 'package:flutter/material.dart';

class AnimatedGlassBackground extends StatefulWidget {
  final Widget child;
  final bool isWomenMode;

  const AnimatedGlassBackground({
    super.key,
    required this.child,
    this.isWomenMode = false,
  });

  @override
  State<AnimatedGlassBackground> createState() => _AnimatedGlassBackgroundState();
}

class _AnimatedGlassBackgroundState extends State<AnimatedGlassBackground>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final val = _controller.value;
        final sinVal = math.sin(val * math.pi);
        final cosVal = math.cos(val * math.pi);

        return Stack(
          children: [
            // Deep Luxury Canvas Base
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: widget.isWomenMode
                        ? [
                            const Color(0xFF2A0815),
                            const Color(0xFF4C0519),
                            const Color(0xFF1F040E),
                          ]
                        : [
                            const Color(0xFFF5F7FA),
                            const Color(0xFFEFF5EF),
                            const Color(0xFFF5F7FA),
                          ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
            ),

            // 🟢 Orb 1: Soft Emerald Orb (Top-Left Drifter)
            Positioned(
              top: -60 + sinVal * 40,
              left: -40 + cosVal * 30,
              child: Container(
                width: 320,
                height: 320,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: widget.isWomenMode
                        ? [
                            const Color(0xFFF43F5E).withValues(alpha: 0.45),
                            const Color(0xFFBE123C).withValues(alpha: 0.15),
                            Colors.transparent,
                          ]
                        : [
                            const Color(0xFF81C784).withValues(alpha: 0.25),
                            const Color(0xFFC8E6C9).withValues(alpha: 0.10),
                            Colors.transparent,
                          ],
                  ),
                ),
              ),
            ),

            // 🟡 Orb 2: Soft Golden Amber Glow (Top-Right Drifter)
            Positioned(
              top: 40 + cosVal * 50,
              right: -50 + sinVal * 40,
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: widget.isWomenMode
                        ? [
                            const Color(0xFFFB7185).withValues(alpha: 0.4),
                            const Color(0xFFE11D48).withValues(alpha: 0.12),
                            Colors.transparent,
                          ]
                        : [
                            const Color(0xFFFFF176).withValues(alpha: 0.25),
                            const Color(0xFFFFF9C4).withValues(alpha: 0.10),
                            Colors.transparent,
                          ],
                  ),
                ),
              ),
            ),

            // 🔵 Orb 3: Cyan Azure Glow (Bottom-Left Drifter)
            Positioned(
              bottom: 80 - cosVal * 40,
              left: -30 + sinVal * 30,
              child: Container(
                width: 280,
                height: 280,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: widget.isWomenMode
                        ? [
                            const Color(0xFFFDA4AF).withValues(alpha: 0.35),
                            const Color(0xFF9F1239).withValues(alpha: 0.1),
                            Colors.transparent,
                          ]
                        : [
                            const Color(0xFF80DEEA).withValues(alpha: 0.20),
                            const Color(0xFFE0F7FA).withValues(alpha: 0.08),
                            Colors.transparent,
                          ],
                  ),
                ),
              ),
            ),


            // 🟠 Orb 4: Warm Saffron / Peach Glow (Bottom-Right Drifter)
            Positioned(
              bottom: -40 + sinVal * 30,
              right: -30 - cosVal * 40,
              child: Container(
                width: 320,
                height: 320,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: widget.isWomenMode
                        ? [
                            const Color(0xFFF43F5E).withValues(alpha: 0.35),
                            const Color(0xFF881337).withValues(alpha: 0.12),
                            Colors.transparent,
                          ]
                        : [
                            const Color(0xFFEA580C).withValues(alpha: 0.35),
                            const Color(0xFFBC6C25).withValues(alpha: 0.12),
                            Colors.transparent,
                          ],
                  ),
                ),
              ),
            ),

            // Foreground Content
            Positioned.fill(child: widget.child),
          ],
        );
      },
    );
  }
}
