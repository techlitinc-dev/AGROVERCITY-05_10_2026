// Module D: AI Advisory Engine (API-wired) — market saturation, leaf scan,
// NPK optimizer, pest radar + Kisan Mitra chatbot launcher.

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../api/advisory_api.dart';
import '../components/common/glass_card.dart';
import '../components/voice/kisan_mitra_chatbot_sheet.dart';
import '../components/common/motion_animations.dart';
import 'advisory/disease_scan_tab.dart';
import 'advisory/npk_tab.dart';
import 'advisory/pest_radar_tab.dart';
import 'advisory/saturation_tab.dart';

class AdvisoryView extends StatefulWidget {
  final AppState state;
  final AdvisoryApi? advisoryApi;
  final LeafImagePicker? pickLeafImage;

  const AdvisoryView({
    super.key,
    required this.state,
    this.advisoryApi,
    this.pickLeafImage,
  });

  @override
  State<AdvisoryView> createState() => _AdvisoryViewState();
}

class _AdvisoryViewState extends State<AdvisoryView> {
  late final AdvisoryApi _api = widget.advisoryApi ?? AdvisoryApi();
  int _selectedTab = 0; // 0: Market Saturation, 1: Leaf Scan, 2: NPK Soil, 3: 5km Radar

  void _openChatbotSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => KisanMitraChatbotSheet(state: widget.state),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StaggeredSlideFade(
            delayMs: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("AI Crop Advisory & Market Risk", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                    Text("Leaf Scan • Demand Forecast • Saturation Radar", style: TextStyle(fontSize: 11.5, color: Color(0xFF90A4AE))),
                  ],
                ),
                BouncyPressable(
                  onTap: _openChatbotSheet,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.smart_toy_rounded, color: Color(0xFF43A047), size: 24),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          StaggeredSlideFade(
            delayMs: 80,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildTabBtn(0, "📈 Market Saturation"),
                  _buildTabBtn(1, "📸 Leaf Disease Scan"),
                  _buildTabBtn(2, "🧪 NPK Soil Calculator"),
                  _buildTabBtn(3, "📡 5km Pest Radar"),
                  _buildTabBtn(4, "💬 Kisan Mitra Chatbot"),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          StaggeredSlideFade(
            delayMs: 160,
            child: Builder(
              builder: (context) {
                if (_selectedTab == 0) {
                  return SaturationTab(state: widget.state, api: _api);
                }
                if (_selectedTab == 1) {
                  return DiseaseScanTab(
                    state: widget.state,
                    api: _api,
                    pickImage: widget.pickLeafImage ?? defaultLeafImagePicker,
                  );
                }
                if (_selectedTab == 2) {
                  return NpkTab(state: widget.state, api: _api);
                }
                if (_selectedTab == 3) {
                  return PestRadarTab(state: widget.state, api: _api);
                }
                if (_selectedTab == 4) return _buildChatLauncherCard();
                return const SizedBox.shrink();
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBtn(int index, String label) {
    final active = _selectedTab == index;
    return BouncyPressable(
      onTap: () {
        if (index == 4) {
          _openChatbotSheet();
        } else {
          setState(() => _selectedTab = index);
        }
      },
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF43A047) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: active ? const Color(0xFF43A047) : Colors.grey.shade300),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: const Color(0xFF43A047).withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  )
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: active ? FontWeight.w800 : FontWeight.w600,
            color: active ? Colors.white : Colors.black87,
          ),
        ),
      ),
    );
  }

  Widget _buildChatLauncherCard() {
    return GlassCard(
      backgroundColor: Colors.white,
      child: Column(
        children: [
          const Icon(Icons.forum_rounded, size: 48, color: Color(0xFF43A047)),
          const SizedBox(height: 10),
          const Text("Kisan Mitra Dedicated Chatbot", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
          const SizedBox(height: 6),
          const Text("Ask questions in voice or text. Get quick replies and expert handoff.", textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 14),
          ElevatedButton.icon(
            onPressed: _openChatbotSheet,
            icon: const Icon(Icons.chat_bubble_outline_rounded, size: 16),
            label: const Text("Open Kisan Mitra Sheet", style: TextStyle(fontWeight: FontWeight.w800)),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF43A047), foregroundColor: Colors.white),
          ),
        ],
      ),
    );
  }
}
