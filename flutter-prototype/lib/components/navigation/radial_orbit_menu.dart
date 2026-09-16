// Circular Radial Orbit Menu (Wheel Navigation) for Kisan Setu

import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import '../../state/app_state.dart';

class RadialOrbitMenu extends StatefulWidget {
  final AppState state;
  final VoidCallback onOpenVoice;

  const RadialOrbitMenu({
    super.key,
    required this.state,
    required this.onOpenVoice,
  });

  @override
  State<RadialOrbitMenu> createState() => _RadialOrbitMenuState();
}

class _RadialOrbitMenuState extends State<RadialOrbitMenu> with SingleTickerProviderStateMixin {
  bool _isOpen = false;
  late AnimationController _animController;
  late Animation<double> _expandAnim;
  late Animation<double> _rotateAnim;

  final List<_RadialMenuItem> _menuItems = [
    _RadialMenuItem(
      id: 'advisory',
      title: 'AI रोग जांच',
      icon: Icons.edit_rounded,
      color: const Color(0xFF38BDF8),
    ),
    _RadialMenuItem(
      id: 'schemes',
      title: 'योजनाएं',
      icon: Icons.folder_rounded,
      color: const Color(0xFF60A5FA),
    ),
    _RadialMenuItem(
      id: 'mandi',
      title: 'मंडी भाव',
      icon: Icons.public_rounded,
      color: const Color(0xFF3B82F6),
    ),
    _RadialMenuItem(
      id: 'profitLoss',
      title: 'फार्म P&L',
      icon: Icons.power_settings_new_rounded,
      color: const Color(0xFF475569),
    ),
    _RadialMenuItem(
      id: 'gyanHub',
      title: 'ज्ञान सेतु',
      icon: Icons.info_rounded,
      color: const Color(0xFF334155),
    ),
    _RadialMenuItem(
      id: 'fpo',
      title: 'FPO हब',
      icon: Icons.groups_rounded,
      color: const Color(0xFF64748B),
    ),
    _RadialMenuItem(
      id: 'landLegal',
      title: 'खेत नक्शा',
      icon: Icons.map_rounded,
      color: const Color(0xFF6B7280),
    ),
    _RadialMenuItem(
      id: 'equipment',
      title: 'यंत्र लोकेशन',
      icon: Icons.location_on_rounded,
      color: const Color(0xFF5A738E),
    ),
  ];

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );

    _expandAnim = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutBack,
    );

    _rotateAnim = Tween<double>(begin: 0.0, end: math.pi / 4).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _toggleMenu() {
    setState(() {
      _isOpen = !_isOpen;
      if (_isOpen) {
        _animController.forward();
      } else {
        _animController.reverse();
      }
    });
  }

  void _handleItemSelect(String route) {
    widget.state.navigateTo(route);
    _toggleMenu();
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    final isDesktop = screenSize.width > 650;
    final radius = isDesktop ? 130.0 : 115.0;

    return Stack(
      children: [
        // Frosted Blur Overlay when Menu is Open
        if (_isOpen)
          Positioned.fill(
            child: GestureDetector(
              onTap: _toggleMenu,
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                child: Container(
                  color: const Color(0xFF0B141E).withValues(alpha: 0.75),
                ),
              ),
            ),
          ),

        // Radial Orbital Buttons (Blossom outward when open)
        if (_isOpen)
          Positioned.fill(
            child: Center(
              child: AnimatedBuilder(
                animation: _expandAnim,
                builder: (context, _) {
                  final currentRadius = radius * _expandAnim.value;
                  final count = _menuItems.length;

                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      // Radial Orbit Guide Ring
                      Container(
                        width: currentRadius * 2 + 10,
                        height: currentRadius * 2 + 10,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.12 * _expandAnim.value),
                            width: 1.5,
                          ),
                        ),
                      ),

                      // Orbital Circular Buttons
                      ...List.generate(count, (index) {
                        final item = _menuItems[index];
                        // Start from top (angle = -pi/2) and distribute evenly
                        final angle = (-math.pi / 2) + (2 * math.pi / count) * index;
                        final x = currentRadius * math.cos(angle);
                        final y = currentRadius * math.sin(angle);
                        final isCurrent = widget.state.currentRoute == item.id;

                        return Transform.translate(
                          offset: Offset(x, y),
                          child: Opacity(
                            opacity: _expandAnim.value.clamp(0.0, 1.0),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                GestureDetector(
                                  onTap: () => _handleItemSelect(item.id),
                                  child: Container(
                                    width: 52,
                                    height: 52,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: isCurrent ? const Color(0xFFE9C46A) : item.color,
                                      border: Border.all(
                                        color: isCurrent ? Colors.white : Colors.white.withValues(alpha: 0.35),
                                        width: isCurrent ? 2.5 : 1.2,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: (isCurrent ? const Color(0xFFE9C46A) : item.color).withValues(alpha: 0.6),
                                          blurRadius: 16,
                                          spreadRadius: 2,
                                          offset: const Offset(0, 4),
                                        ),
                                      ],
                                    ),
                                    child: Icon(
                                      item.icon,
                                      color: isCurrent ? const Color(0xFF112A1F) : Colors.white,
                                      size: 24,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.65),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    item.title,
                                    style: TextStyle(
                                      color: isCurrent ? const Color(0xFFE9C46A) : Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                    ],
                  );
                },
              ),
            ),
          ),

        // Center Pivot / Floating Trigger Button
        if (_isOpen)
          Positioned.fill(
            child: Center(
              child: GestureDetector(
                onTap: _toggleMenu,
                child: Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      colors: [Color(0xFFE11D48), Color(0xFFBE123C)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    border: Border.all(color: Colors.white, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFE11D48).withValues(alpha: 0.6),
                        blurRadius: 20,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                ),
              ),
            ),
          ),

        // Persistent Floating Radial Wheel Launcher Button (Bottom Right)
        if (!_isOpen)
          Positioned(
            bottom: 90,
            right: 20,
            child: GestureDetector(
              onTap: _toggleMenu,
              child: Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    colors: [Color(0xFF38BDF8), Color(0xFF0284C7), Color(0xFF1E3A8A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  border: Border.all(color: Colors.white, width: 2.2),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF38BDF8).withValues(alpha: 0.5),
                      blurRadius: 20,
                      spreadRadius: 2,
                      offset: const Offset(0, 4),
                    ),
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.4),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: RotationTransition(
                  turns: _rotateAnim,
                  child: const Icon(Icons.all_inclusive_rounded, color: Colors.white, size: 30),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _RadialMenuItem {
  final String id;
  final String title;
  final IconData icon;
  final Color color;

  _RadialMenuItem({
    required this.id,
    required this.title,
    required this.icon,
    required this.color,
  });
}
