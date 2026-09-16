// Apple macOS Style Top Menu Bar with Frosted Glass & System Status Tray

import 'dart:ui';
import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../data/translations.dart';

class AppleMenuBar extends StatelessWidget {
  final AppState state;
  final VoidCallback onOpenVoice;
  final VoidCallback onOpenAllTools;

  const AppleMenuBar({
    super.key,
    required this.state,
    required this.onOpenVoice,
    required this.onOpenAllTools,
  });

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final timeString = "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}";

    return Container(
      height: 38,
      width: double.infinity,
      decoration: BoxDecoration(
        color: state.isWomenMode 
            ? const Color(0xFF881337).withValues(alpha: 0.85)
            : const Color(0xFF1B4332).withValues(alpha: 0.88),
        border: Border(
          bottom: BorderSide(
            color: Colors.white.withValues(alpha: 0.18),
            width: 1.0,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 10,
            offset: const Offset(0, 2),
          )
        ],
      ),
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              children: [
                // 🍏 Brand / Apple-style Setu Logo Dropdown
                PopupMenuButton<String>(
                  tooltip: "AGROVERCITY Menu",
                  offset: const Offset(0, 32),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  color: Colors.white.withValues(alpha: 0.96),
                  onSelected: (val) {
                    if (val == 'about') {
                      state.showToast("AGROVERCITY v2.0 • Aapki Zameen, Aapka Business");
                    } else if (val == 'tools') {
                      onOpenAllTools();
                    } else if (val == 'gyan') {
                      state.navigateTo('gyanHub');
                    } else if (val == 'replay') {
                      state.restartOnboarding();
                    } else if (val == 'sync') {
                      state.toggleOffline();
                    }
                  },
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: 'about',
                      child: Row(
                        children: [
                          Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFF1B4332)),
                          SizedBox(width: 8),
                          Text("AGROVERCITY के बारे में (About)", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                        ],
                      ),
                    ),
                    const PopupMenuDivider(),
                    const PopupMenuItem(
                      value: 'gyan',
                      child: Row(
                        children: [
                          Icon(Icons.school_rounded, size: 16, color: Color(0xFFD97706)),
                          SizedBox(width: 8),
                          Text("ज्ञान सेतु (Videos & Blogs)", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'tools',
                      child: Row(
                        children: [
                          Icon(Icons.apps_rounded, size: 16, color: Color(0xFF1B4332)),
                          SizedBox(width: 8),
                          Text("सभी 16 टूल्स खोलें (Launchpad)", style: TextStyle(fontSize: 13)),
                        ],
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'replay',
                      child: Row(
                        children: [
                          Icon(Icons.replay_rounded, size: 16, color: Color(0xFF0284C7)),
                          SizedBox(width: 8),
                          Text("ऑनबोर्डिंग पुनः चलाएं (Replay Flow)", style: TextStyle(fontSize: 13)),
                        ],
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'sync',
                      child: Row(
                        children: [
                          Icon(Icons.sync_rounded, size: 16, color: Color(0xFF1B4332)),
                          SizedBox(width: 8),
                          Text("डेटा सिंक स्थिति (Sync Status)", style: TextStyle(fontSize: 13)),
                        ],
                      ),
                    ),
                  ],
                  child: Row(
                    children: [
                      Container(
                        width: 22,
                        height: 22,
                        padding: const EdgeInsets.all(1.5),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFE9C46A).withValues(alpha: 0.3),
                              blurRadius: 4,
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: Image.asset(
                            'assets/app_icon.png',
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) => const Icon(
                              Icons.eco_rounded,
                              color: Color(0xFF2E7D32),
                              size: 14,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        "AGROVERCITY",
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 16),

                // macOS Menus
                _buildMenuTitle(context, "फसल (Crops)", [
                  _MenuItem("एआई रोग जांच (AI Scan)", 'advisory'),
                  _MenuItem("खाद बचत NPK (Fertilizer)", 'advisory'),
                  _MenuItem("सिंचाई नियंत्रण (Water)", 'water'),
                ]),
                _buildMenuTitle(context, "बाज़ार (Market)", [
                  _MenuItem("लाइव मंडी भाव (Mandi Rates)", 'mandi'),
                  _MenuItem("खाद-बीज बाज़ार (Input Store)", 'marketplace'),
                  _MenuItem("सीधा खरीदार अनुबंध (Contracts)", 'buyers'),
                ]),
                _buildMenuTitle(context, "ज्ञान (Media Hub)", [
                  _MenuItem("वैज्ञानिक मास्टरक्लास (Expert Talks)", 'gyanHub'),
                  _MenuItem("कृषि वीडियो ट्यूटोरियल (Videos)", 'gyanHub'),
                  _MenuItem("शोध ब्लॉग्स (Agronomy Blogs)", 'gyanHub'),
                ]),
                _buildMenuTitle(context, "वित्त (Finance)", [
                  _MenuItem("फार्म CEO P&L (Profit/Loss)", 'profitLoss'),
                  _MenuItem("किसान साख स्कोर (Credit 785)", 'finance'),
                  _MenuItem("तात्कालिक ऋण (₹50k Loan)", 'finance'),
                ]),
                _buildMenuTitle(context, "योजनाएं (Govt)", [
                  _MenuItem("पात्रता जांच (Auto-Checker)", 'schemes'),
                  _MenuItem("दस्तावेज़ वॉल्ट (Document Vault)", 'schemes'),
                ]),

                const Spacer(),

                // RIGHT SYSTEM STATUS TRAY (macOS Style)
                
                // 1. Online / Offline Sync Pill
                GestureDetector(
                  onTap: () => state.toggleOffline(),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: state.isOffline 
                          ? const Color(0xFFEF4444).withValues(alpha: 0.25)
                          : const Color(0xFF22C55E).withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: state.isOffline ? const Color(0xFFEF4444) : const Color(0xFF22C55E),
                        width: 0.8,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          state.isOffline ? Icons.wifi_off_rounded : Icons.wifi_rounded,
                          size: 13,
                          color: state.isOffline ? const Color(0xFFFCA5A5) : const Color(0xFF86EFAC),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          state.isOffline ? "ऑफलाइन (${state.syncQueueCount})" : "सिंक सक्रिय",
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            color: state.isOffline ? const Color(0xFFFCA5A5) : const Color(0xFF86EFAC),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(width: 8),

                // 2. Agri-Coins Widget
                GestureDetector(
                  onTap: () => state.navigateTo('krishiRatna'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE9C46A).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE9C46A), width: 0.8),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.monetization_on_rounded, size: 13, color: Color(0xFFE9C46A)),
                        const SizedBox(width: 4),
                        Text(
                          "${state.profile.agriCoins}",
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFE9C46A)),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(width: 8),

                // 3. Language Selector Pill
                PopupMenuButton<String>(
                  tooltip: "Select Language",
                  offset: const Offset(0, 30),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  color: Colors.white.withValues(alpha: 0.96),
                  onSelected: (lang) => state.setLanguage(lang),
                  itemBuilder: (context) => AppTranslations.languageNames.entries.map((entry) {
                    return PopupMenuItem(
                      value: entry.key,
                      child: Text(
                        entry.value,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: state.language == entry.key ? FontWeight.w800 : FontWeight.w500,
                          color: state.language == entry.key ? const Color(0xFF1B4332) : Colors.black87,
                        ),
                      ),
                    );
                  }).toList(),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.language_rounded, size: 13, color: Colors.white),
                        const SizedBox(width: 4),
                        Text(
                          state.language.toUpperCase(),
                          style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(width: 8),

                // 4. Mahila Kisan Mode Toggle
                GestureDetector(
                  onTap: () => state.toggleWomenMode(),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: state.isWomenMode ? const Color(0xFFE11D48) : Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.favorite_rounded,
                          size: 13,
                          color: state.isWomenMode ? Colors.white : const Color(0xFFFDA4AF),
                        ),
                        const SizedBox(width: 3),
                        const Text(
                          "महिला",
                          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(width: 8),

                // 5. Battery & Clock
                Row(
                  children: [
                    const Icon(Icons.battery_charging_full_rounded, size: 14, color: Color(0xFF86EFAC)),
                    const SizedBox(width: 6),
                    Text(
                      timeString,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMenuTitle(BuildContext context, String title, List<_MenuItem> items) {
    return PopupMenuButton<String>(
      offset: const Offset(0, 30),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: Colors.white.withValues(alpha: 0.96),
      onSelected: (route) => state.navigateTo(route),
      itemBuilder: (context) => items.map((item) {
        return PopupMenuItem<String>(
          value: item.route,
          child: Text(item.title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF112A1F))),
        );
      }).toList(),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Text(
          title,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _MenuItem {
  final String title;
  final String route;
  _MenuItem(this.title, this.route);
}
