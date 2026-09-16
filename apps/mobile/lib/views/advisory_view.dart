// Module D: AI Advisory Engine Flutter View (CRD Change 9 & Change 8) & Motion Animations

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../data/demo_data.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';
import '../components/voice/kisan_mitra_chatbot_sheet.dart';
import '../components/common/motion_animations.dart';

class AdvisoryView extends StatefulWidget {
  final AppState state;
  const AdvisoryView({super.key, required this.state});

  @override
  State<AdvisoryView> createState() => _AdvisoryViewState();
}

class _AdvisoryViewState extends State<AdvisoryView> {
  int _selectedTab = 0; // 0: Market Saturation (CRD Change 9), 1: Leaf Scan, 2: NPK Soil, 3: 5km Radar, 4: Chatbot (CRD Change 8)
  PestDisease _selectedDisease = dummyDiseases[0];
  bool _isScanning = false;

  // NPK sliders
  double _nitrogen = 140;
  double _phosphorus = 35;
  double _potassium = 160;

  void _scanSample(PestDisease d) {
    setState(() => _isScanning = true);
    Future.delayed(const Duration(milliseconds: 1400), () {
      if (mounted) {
        setState(() {
          _selectedDisease = d;
          _isScanning = false;
        });
        widget.state.showToast("AI Diagnosis Complete: ${d.diseaseName} (${d.confidence}%)");
      }
    });
  }

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
          // Header
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

          // Sub Tabs
          StaggeredSlideFade(
            delayMs: 80,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildTabBtn(0, "📈 Market Saturation (CRD 9)"),
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
                if (_selectedTab == 0) return _buildMarketSaturationAdvisory();
                if (_selectedTab == 1) return _buildCameraDiagnosis();
                if (_selectedTab == 2) return _buildNpkOptimizer();
                if (_selectedTab == 3) return _buildRadarAlerts();
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


  // CRD Change 9: Market Saturation Advisory / AI Demand Forecasting Card
  Widget _buildMarketSaturationAdvisory() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Sowing Intent Prompt Simulation
        GlassCard(
          backgroundColor: Colors.white,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("🎯 Sowing Intent Query:", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF263238))),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFF5F7FA), borderRadius: BorderRadius.circular(12)),
                child: const Text(
                  "\"Is saal tamatar (Tomato) ugane ka soch raha hoon...\"",
                  style: TextStyle(fontSize: 13, fontStyle: FontStyle.italic, color: Color(0xFF2E7D32), fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Rich Saturation Alert Card
        GlassCard(
          backgroundColor: const Color(0xFFFFF8E1),
          border: Border.all(color: const Color(0xFFFFB300), width: 1.5),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 22),
                      SizedBox(width: 8),
                      Text("MARKET SATURATION ADVISORY", style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFFB71C1C))),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: Colors.red.shade100, borderRadius: BorderRadius.circular(8)),
                    child: const Text("HIGH RISK", style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: Colors.red)),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // 5km Local Sowing Count & Arrival Spike
              const Text("📍 Local 5km Sowing Data:", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF263238))),
              const SizedBox(height: 4),
              const Text("• 5km radius mein 12 kisano ne Tomato buoyi hai (Excess Supply Alert).", style: TextStyle(fontSize: 12, color: Colors.black87)),
              const Text("• Mandi aavak 200% badhne ki sambhavna hai (Expected Arrival Spike).", style: TextStyle(fontSize: 12, color: Colors.black87)),
              const SizedBox(height: 12),

              // 3-Month Forecast Risk Meter (Red / Yellow / Green)
              const Text("📊 3-Month Price Risk Forecast:", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF263238))),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 10,
                      decoration: BoxDecoration(
                        color: Colors.green,
                        borderRadius: const BorderRadius.horizontal(left: Radius.circular(5)),
                      ),
                      child: const Center(child: Text("Low", style: TextStyle(fontSize: 8, color: Colors.white))),
                    ),
                  ),
                  Expanded(
                    child: Container(
                      height: 10,
                      color: Colors.amber,
                      child: const Center(child: Text("Med", style: TextStyle(fontSize: 8, color: Colors.black))),
                    ),
                  ),
                  Expanded(
                    child: Container(
                      height: 10,
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.horizontal(right: Radius.circular(5)),
                      ),
                      child: const Center(child: Text("HIGH RISK", style: TextStyle(fontSize: 8, color: Colors.white, fontWeight: FontWeight.bold))),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Align(
                alignment: Alignment.centerRight,
                child: Text("Price Risk: HIGH (₹8-10/kg crash expected in 90 days)", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.red)),
              ),
              const SizedBox(height: 14),

              // Alternative Crop Recommendation
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFA5D6A7))),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("💡 AI Recommended Alternative Crop:", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: Color(0xFF2E7D32))),
                    const SizedBox(height: 4),
                    const Text("Shimla Mirch (Capsicum) lagayein — Local demand high hai, 3 mahine baad ₹45/kg bhav milne ki 85% sambhavna hai.", style: TextStyle(fontSize: 12, height: 1.4, color: Color(0xFF1B5E20))),
                    const SizedBox(height: 10),
                    ElevatedButton.icon(
                      onPressed: _openChatbotSheet,
                      icon: const Icon(Icons.forum_rounded, size: 15),
                      label: const Text("Discuss with Kisan Mitra Chatbot →", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF43A047), foregroundColor: Colors.white),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCameraDiagnosis() {
    return Column(
      children: [
        // Camera Viewfinder Card
        GlassCard(
          backgroundColor: Colors.white,
          child: Column(
            children: [
              Container(
                height: 180,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFF263238),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _isScanning ? Icons.qr_code_scanner_rounded : Icons.camera_alt_rounded,
                          size: 44,
                          color: const Color(0xFF43A047),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _isScanning ? "🔍 AI Neural Scan in progress..." : "Active Leaf: ${_selectedDisease.crop}",
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              const Align(
                alignment: Alignment.centerLeft,
                child: Text("Test Sample Leaves:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: dummyDiseases.map((d) {
                  final sel = _selectedDisease.id == d.id;
                  return ChoiceChip(
                    label: Text("${d.crop} - ${d.diseaseName.split(' ')[0]}"),
                    selected: sel,
                    selectedColor: const Color(0xFFE8F5E9),
                    onSelected: (_) => _scanSample(d),
                  );
                }).toList(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Diagnosis Results Card
        GlassCard(
          backgroundColor: Colors.white,
          border: Border.all(color: const Color(0xFF43A047), width: 1.5),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(_selectedDisease.diseaseName, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(10)),
                    child: Text("${_selectedDisease.confidence}% AI Accuracy", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32))),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text("Symptoms: ${_selectedDisease.symptoms}", style: const TextStyle(fontSize: 12.5, color: Colors.black87)),
              const SizedBox(height: 10),

              // Chemical
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFA5D6A7))),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("💊 Chemical Treatment:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF1B5E20))),
                    const SizedBox(height: 3),
                    Text(_selectedDisease.chemicalTreatment, style: const TextStyle(fontSize: 12, color: Color(0xFF2E7D32))),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildNpkOptimizer() {
    return GlassCard(
      backgroundColor: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("🧪 Soil Test & Fertilizer Optimizer", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 14),

          Text("Nitrogen (N): ${_nitrogen.toInt()} kg/ha", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          Slider(min: 80, max: 250, value: _nitrogen, onChanged: (v) => setState(() => _nitrogen = v), activeColor: const Color(0xFF43A047)),

          Text("Phosphorus (P): ${_phosphorus.toInt()} kg/ha", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          Slider(min: 15, max: 80, value: _phosphorus, onChanged: (v) => setState(() => _phosphorus = v), activeColor: const Color(0xFF43A047)),

          Text("Potassium (K): ${_potassium.toInt()} kg/ha", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          Slider(min: 100, max: 300, value: _potassium, onChanged: (v) => setState(() => _potassium = v), activeColor: const Color(0xFF43A047)),
        ],
      ),
    );
  }

  Widget _buildRadarAlerts() {
    return GlassCard(
      backgroundColor: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("📡 5km Regional Pest Radar", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _buildRadarItem("Sukene (3.2 km)", "Fall Armyworm in Maize", "High Risk", Colors.red),
          const Divider(),
          _buildRadarItem("Niphad (4.8 km)", "Pink Bollworm in Cotton", "Medium", Colors.orange),
        ],
      ),
    );
  }

  Widget _buildRadarItem(String loc, String pest, String risk, Color c) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(pest, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            Text(loc, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(color: c.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
          child: Text(risk, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: c)),
        ),
      ],
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

