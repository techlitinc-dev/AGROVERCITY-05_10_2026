// Motion Animation & UX Physics Library for Kisan Setu

import 'dart:math' as math;
import 'package:flutter/material.dart';

/// 1. Staggered Slide & Fade Entrance Animation
/// Orchestrates smooth cascading reveals for cards, grids, and list items
class StaggeredSlideFade extends StatefulWidget {
  final Widget child;
  final int delayMs;
  final Duration duration;
  final Offset offset;
  final Curve curve;

  const StaggeredSlideFade({
    super.key,
    required this.child,
    this.delayMs = 0,
    this.duration = const Duration(milliseconds: 550),
    this.offset = const Offset(0.0, 0.12),
    this.curve = Curves.easeOutCubic,
  });

  @override
  State<StaggeredSlideFade> createState() => _StaggeredSlideFadeState();
}

class _StaggeredSlideFadeState extends State<StaggeredSlideFade> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;
  late Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);

    _fadeAnim = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(begin: widget.offset, end: Offset.zero).animate(
      CurvedAnimation(parent: _controller, curve: widget.curve),
    );
    _scaleAnim = Tween<double>(begin: 0.95, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: widget.curve),
    );

    if (widget.delayMs > 0) {
      Future.delayed(Duration(milliseconds: widget.delayMs), () {
        if (mounted) _controller.forward();
      });
    } else {
      _controller.forward();
    }
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
      builder: (context, child) {
        return Opacity(
          opacity: _fadeAnim.value.clamp(0.0, 1.0),
          child: Transform.translate(
            offset: Offset(
              _slideAnim.value.dx * MediaQuery.of(context).size.width,
              _slideAnim.value.dy * MediaQuery.of(context).size.height,
            ),
            child: Transform.scale(
              scale: _scaleAnim.value,
              child: widget.child,
            ),
          ),
        );
      },
    );
  }
}

/// 2. Rotating Vinyl / Metallic Emblem (Inspired by Reference GIF)
/// Continuously rotating vinyl disc with concentric grooved rings and metallic sheen
class SpinningVinylEmblem extends StatefulWidget {
  final Widget centerIcon;
  final double size;
  final List<Color> ringColors;
  final Duration rotationPeriod;

  const SpinningVinylEmblem({
    super.key,
    required this.centerIcon,
    this.size = 72,
    this.ringColors = const [
      Color(0xFFE8F5E9),
      Color(0xFF81C784),
      Color(0xFF2E7D32),
      Color(0xFF1B5E20),
    ],
    this.rotationPeriod = const Duration(seconds: 14),
  });

  @override
  State<SpinningVinylEmblem> createState() => _SpinningVinylEmblemState();
}

class _SpinningVinylEmblemState extends State<SpinningVinylEmblem> with SingleTickerProviderStateMixin {
  late AnimationController _rotationController;

  @override
  void initState() {
    super.initState();
    _rotationController = AnimationController(
      vsync: this,
      duration: widget.rotationPeriod,
    )..repeat();
  }

  @override
  void dispose() {
    _rotationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _rotationController,
      builder: (context, child) {
        return Transform.rotate(
          angle: _rotationController.value * 2 * math.pi,
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: SweepGradient(
                colors: widget.ringColors,
                stops: const [0.0, 0.35, 0.7, 1.0],
              ),
              boxShadow: [
                BoxShadow(
                  color: widget.ringColors.last.withValues(alpha: 0.35),
                  blurRadius: 16,
                  spreadRadius: 2,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Concentric Grooved Vinyl Rings
                Container(
                  width: widget.size * 0.82,
                  height: widget.size * 0.82,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white.withValues(alpha: 0.35), width: 1.2),
                  ),
                ),
                Container(
                  width: widget.size * 0.65,
                  height: widget.size * 0.65,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white.withValues(alpha: 0.25), width: 1.0),
                  ),
                ),
                // Center Core Emblem with Reverse Counter-Rotation (keeps icon upright)
                Transform.rotate(
                  angle: -_rotationController.value * 2 * math.pi,
                  child: Container(
                    width: widget.size * 0.48,
                    height: widget.size * 0.48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                      border: Border.all(color: Colors.white, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.15),
                          blurRadius: 6,
                        ),
                      ],
                    ),
                    child: Center(child: widget.centerIcon),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// 3. Holographic Light Shimmer Sweep Effect
class ShimmerGlowEffect extends StatefulWidget {
  final Widget child;
  final Duration duration;
  final Color shimmerColor;

  const ShimmerGlowEffect({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 2400),
    this.shimmerColor = Colors.white,
  });

  @override
  State<ShimmerGlowEffect> createState() => _ShimmerGlowEffectState();
}

class _ShimmerGlowEffectState extends State<ShimmerGlowEffect> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration)..repeat();
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
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            final val = _controller.value;
            return LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.transparent,
                widget.shimmerColor.withValues(alpha: 0.28),
                Colors.transparent,
              ],
              stops: [
                (val - 0.25).clamp(0.0, 1.0),
                val.clamp(0.0, 1.0),
                (val + 0.25).clamp(0.0, 1.0),
              ],
            ).createShader(bounds);
          },
          child: widget.child,
        );
      },
      child: widget.child,
    );
  }
}

/// 4. Animated Equalizer / Waveform (Live Market / Audio Radar)
class AnimatedAudioWaveform extends StatefulWidget {
  final int barCount;
  final Color color;
  final double height;

  const AnimatedAudioWaveform({
    super.key,
    this.barCount = 6,
    this.color = const Color(0xFF2E7D32),
    this.height = 18,
  });

  @override
  State<AnimatedAudioWaveform> createState() => _AnimatedAudioWaveformState();
}

class _AnimatedAudioWaveformState extends State<AnimatedAudioWaveform> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
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
        return Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: List.generate(widget.barCount, (index) {
            final sinVal = math.sin((_controller.value * 2 * math.pi) + (index * 0.8)).abs();
            final barH = (widget.height * 0.25) + (widget.height * 0.75 * sinVal);
            return Container(
              width: 3,
              height: barH,
              margin: const EdgeInsets.symmetric(horizontal: 1.5),
              decoration: BoxDecoration(
                color: widget.color,
                borderRadius: BorderRadius.circular(2),
              ),
            );
          }),
        );
      },
    );
  }
}

/// 5. Pulsing Live Beacon Badge
class PulsingBeaconBadge extends StatefulWidget {
  final String label;
  final Color color;
  final IconData? icon;

  const PulsingBeaconBadge({
    super.key,
    required this.label,
    this.color = const Color(0xFF10B981),
    this.icon,
  });

  @override
  State<PulsingBeaconBadge> createState() => _PulsingBeaconBadgeState();
}

class _PulsingBeaconBadgeState extends State<PulsingBeaconBadge> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();

    _scaleAnimation = Tween<double>(begin: 1.0, end: 2.2).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
    _fadeAnimation = Tween<double>(begin: 0.8, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
      decoration: BoxDecoration(
        color: widget.color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: widget.color.withValues(alpha: 0.4), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              AnimatedBuilder(
                animation: _controller,
                builder: (context, _) {
                  return Transform.scale(
                    scale: _scaleAnimation.value,
                    child: Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: widget.color.withValues(alpha: _fadeAnimation.value),
                      ),
                    ),
                  );
                },
              ),
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: widget.color,
                ),
              ),
            ],
          ),
          const SizedBox(width: 5),
          if (widget.icon != null) ...[
            Icon(widget.icon, size: 11, color: widget.color),
            const SizedBox(width: 3),
          ],
          Text(
            widget.label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: widget.color,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

/// 6. Bouncy Spring Touch Feedback Wrapper
class BouncyPressable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double shrinkScale;

  const BouncyPressable({
    super.key,
    required this.child,
    this.onTap,
    this.shrinkScale = 0.96,
  });

  @override
  State<BouncyPressable> createState() => _BouncyPressableState();
}

class _BouncyPressableState extends State<BouncyPressable> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 120),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: widget.shrinkScale).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails _) {
    if (widget.onTap != null) _controller.forward();
  }

  void _onTapUp(TapUpDetails _) {
    if (widget.onTap != null) {
      _controller.reverse();
      widget.onTap!();
    }
  }

  void _onTapCancel() {
    if (widget.onTap != null) _controller.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _onTapDown,
      onTapUp: _onTapUp,
      onTapCancel: _onTapCancel,
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: widget.child,
          );
        },
      ),
    );
  }
}

/// 7. Biometric Laser Scanning Radar Animation
class BiometricScanRadar extends StatefulWidget {
  final double size;
  final Color primaryColor;
  final bool isScanning;
  final VoidCallback? onScanComplete;

  const BiometricScanRadar({
    super.key,
    this.size = 90,
    this.primaryColor = const Color(0xFF43A047),
    this.isScanning = false,
    this.onScanComplete,
  });

  @override
  State<BiometricScanRadar> createState() => _BiometricScanRadarState();
}

class _BiometricScanRadarState extends State<BiometricScanRadar> with SingleTickerProviderStateMixin {
  late AnimationController _scanController;
  late Animation<double> _scanAnimation;

  @override
  void initState() {
    super.initState();
    _scanController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );

    _scanAnimation = Tween<double>(begin: -1.0, end: 1.0).animate(
      CurvedAnimation(parent: _scanController, curve: Curves.easeInOut),
    );

    if (widget.isScanning) {
      _scanController.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(covariant BiometricScanRadar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isScanning && !_scanController.isAnimating) {
      _scanController.repeat(reverse: true);
    } else if (!widget.isScanning && _scanController.isAnimating) {
      _scanController.stop();
      _scanController.reset();
    }
  }

  @override
  void dispose() {
    _scanController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.size,
      height: widget.size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: widget.primaryColor.withValues(alpha: 0.08),
        border: Border.all(
          color: widget.primaryColor.withValues(alpha: widget.isScanning ? 0.8 : 0.35),
          width: widget.isScanning ? 2.5 : 1.5,
        ),
        boxShadow: widget.isScanning
            ? [
                BoxShadow(
                  color: widget.primaryColor.withValues(alpha: 0.3),
                  blurRadius: 20,
                  spreadRadius: 3,
                ),
              ]
            : null,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(widget.size / 2),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Icon(
              Icons.fingerprint_rounded,
              size: widget.size * 0.58,
              color: widget.isScanning ? widget.primaryColor : widget.primaryColor.withValues(alpha: 0.8),
            ),
            if (widget.isScanning)
              AnimatedBuilder(
                animation: _scanAnimation,
                builder: (context, child) {
                  return Positioned(
                    top: (widget.size / 2) + (_scanAnimation.value * (widget.size / 2.2)) - 2,
                    left: 0,
                    right: 0,
                    child: Container(
                      height: 4,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.transparent,
                            widget.primaryColor,
                            Colors.white,
                            widget.primaryColor,
                            Colors.transparent,
                          ],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: widget.primaryColor.withValues(alpha: 0.9),
                            blurRadius: 8,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

/// 8. Animated OTP PIN Boxes with focused glow and shake
class OtpPinField extends StatefulWidget {
  final int length;
  final ValueChanged<String>? onCompleted;
  final ValueChanged<String>? onChanged;
  final TextEditingController? controller;
  final Color activeColor;

  const OtpPinField({
    super.key,
    this.length = 4,
    this.onCompleted,
    this.onChanged,
    this.controller,
    this.activeColor = const Color(0xFF43A047),
  });

  @override
  State<OtpPinField> createState() => _OtpPinFieldState();
}

class _OtpPinFieldState extends State<OtpPinField> {
  late TextEditingController _textCtrl;
  final List<FocusNode> _focusNodes = [];

  @override
  void initState() {
    super.initState();
    _textCtrl = widget.controller ?? TextEditingController();
    for (int i = 0; i < widget.length; i++) {
      _focusNodes.add(FocusNode());
    }
  }

  @override
  void dispose() {
    if (widget.controller == null) {
      _textCtrl.dispose();
    }
    for (var f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final currentText = _textCtrl.text;

    return Stack(
      children: [
        // Hidden real textfield to capture all inputs smoothly
        Opacity(
          opacity: 0.0,
          child: TextField(
            controller: _textCtrl,
            keyboardType: TextInputType.number,
            maxLength: widget.length,
            autofocus: true,
            onChanged: (val) {
              setState(() {});
              widget.onChanged?.call(val);
              if (val.length == widget.length) {
                widget.onCompleted?.call(val);
              }
            },
          ),
        ),
        // Visual Custom Boxes
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(widget.length, (idx) {
            final isFilled = idx < currentText.length;
            final isFocused = idx == currentText.length;
            final char = isFilled ? currentText[idx] : "";

            return AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              margin: const EdgeInsets.symmetric(horizontal: 6),
              width: 52,
              height: 56,
              decoration: BoxDecoration(
                color: isFocused
                    ? Colors.white
                    : isFilled
                        ? widget.activeColor.withValues(alpha: 0.08)
                        : Colors.white.withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isFocused
                      ? widget.activeColor
                      : isFilled
                          ? widget.activeColor.withValues(alpha: 0.6)
                          : Colors.grey.shade300,
                  width: isFocused ? 2.2 : 1.2,
                ),
                boxShadow: isFocused
                    ? [
                        BoxShadow(
                          color: widget.activeColor.withValues(alpha: 0.35),
                          blurRadius: 12,
                          spreadRadius: 1,
                          offset: const Offset(0, 3),
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.03),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
              ),
              child: Center(
                child: Text(
                  char,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: widget.activeColor,
                  ),
                ),
              ),
            );
          }),
        ),
      ],
    );
  }
}

/// 9. Floating Animated Organic Particles Background
class FloatingParticlesBackground extends StatefulWidget {
  final Widget child;
  final int particleCount;
  final bool isWomenMode;

  const FloatingParticlesBackground({
    super.key,
    required this.child,
    this.particleCount = 14,
    this.isWomenMode = false,
  });

  @override
  State<FloatingParticlesBackground> createState() => _FloatingParticlesBackgroundState();
}

class _FloatingParticlesBackgroundState extends State<FloatingParticlesBackground> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<_Particle> _particles = [];
  final math.Random _random = math.Random();

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 18),
    )..repeat();

    for (int i = 0; i < widget.particleCount; i++) {
      _particles.add(_Particle(
        x: _random.nextDouble(),
        y: _random.nextDouble(),
        size: 4.0 + _random.nextDouble() * 12.0,
        speed: 0.04 + _random.nextDouble() * 0.1,
        opacity: 0.15 + _random.nextDouble() * 0.35,
        iconIndex: _random.nextInt(3),
      ));
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final baseColor = widget.isWomenMode ? const Color(0xFFBE123C) : const Color(0xFF2E7D32);
    final accentGold = widget.isWomenMode ? const Color(0xFFFBBF24) : const Color(0xFF81C784);

    return Stack(
      children: [
        // Ambient Mesh Gradient Background
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: widget.isWomenMode
                  ? [
                      const Color(0xFF3F071B),
                      const Color(0xFF230510),
                      const Color(0xFF140209),
                    ]
                  : [
                      const Color(0xFFE8F5E9),
                      const Color(0xFFF1F8E9),
                      const Color(0xFFFAFAF7),
                    ],
            ),
          ),
        ),

        // Glowing Ambient Orbs
        Positioned(
          top: -60,
          right: -60,
          child: Container(
            width: 240,
            height: 240,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  accentGold.withValues(alpha: widget.isWomenMode ? 0.35 : 0.25),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),
        Positioned(
          bottom: -40,
          left: -40,
          child: Container(
            width: 200,
            height: 200,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  baseColor.withValues(alpha: widget.isWomenMode ? 0.4 : 0.2),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),

        // Animated Drifting Particles
        AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final t = _controller.value;
            return Stack(
              children: _particles.map((p) {
                final currentY = (p.y - (t * p.speed * 6)) % 1.0;
                final currentX = (p.x + math.sin((t * 2 * math.pi) + (p.y * 5)) * 0.05) % 1.0;

                final icons = [Icons.spa_rounded, Icons.grain_rounded, Icons.eco_rounded];

                return Positioned(
                  left: currentX * MediaQuery.of(context).size.width,
                  top: currentY * MediaQuery.of(context).size.height,
                  child: Opacity(
                    opacity: p.opacity,
                    child: Icon(
                      icons[p.iconIndex],
                      size: p.size,
                      color: widget.isWomenMode ? const Color(0xFFF472B6) : const Color(0xFF66BB6A),
                    ),
                  ),
                );
              }).toList(),
            );
          },
        ),

        // Main Foreground Content
        widget.child,
      ],
    );
  }
}

class _Particle {
  final double x;
  final double y;
  final double size;
  final double speed;
  final double opacity;
  final int iconIndex;

  _Particle({
    required this.x,
    required this.y,
    required this.size,
    required this.speed,
    required this.opacity,
    required this.iconIndex,
  });
}

