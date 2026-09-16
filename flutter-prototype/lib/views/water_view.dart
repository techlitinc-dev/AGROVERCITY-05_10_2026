// Module G: Water Intelligence Flutter View

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';

class WaterView extends StatefulWidget {
  final AppState state;
  const WaterView({super.key, required this.state});

  @override
  State<WaterView> createState() => _WaterViewState();
}

class _WaterViewState extends State<WaterView> {
  bool _dripActive = false;
  double _acresDrip = 2.0;

  @override
  Widget build(BuildContext context) {
    final totalCost = (_acresDrip * 35000).toInt();
    final subsidy = (totalCost * 0.55).toInt();
    final farmerCost = totalCost - subsidy;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("जल बुद्धिमत्ता व सिंचाई नियंत्रण", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text("स्मार्ट सिंचाई शेड्यूल • भूजल स्तर • 55% ड्रिप सब्सिडी", style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              const AudioButton(text: "जल प्रबंधन में आज प्लॉट A टमाटर में शाम 5:30 बजे ड्रिप सिंचाई की सिफारिश है।"),
            ],
          ),
          const SizedBox(height: 14),

          // Plot A Schedule Card
          GlassCard(
            border: Border.all(color: const Color(0xFF0284C7), width: 1.5),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text("Plot A - टमाटर (1.5 एकड़)", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0369A1))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: const Color(0xFFE0F2FE), borderRadius: BorderRadius.circular(8)),
                      child: const Text("नमी: 52% (Dry)", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0369A1))),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text("सिफारिश: आज शाम 5:30 बजे 90 मिनट (4,500 लीटर) ड्रिप सिंचाई चालू करें।", style: TextStyle(fontSize: 12.5, color: Colors.black87)),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: () {
                    setState(() => _dripActive = true);
                    widget.state.showToast("ड्रिप टाइमर चालू हुआ! 90 मिनट बाद स्वतः बंद होगा।");
                  },
                  icon: const Icon(Icons.timer_rounded, size: 16),
                  label: Text(_dripActive ? "ड्रिप चालू है (4,500L) ✅" : "अभी 90 मिनट ड्रिप शुरू करें", style: const TextStyle(fontWeight: FontWeight.w700)),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7), foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 42)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // CGWB Groundwater Gauge & Canal Schedule
          Row(
            children: [
              Expanded(
                child: GlassCard(
                  child: Column(
                    children: [
                      const Text("केंद्रीय भूजल (CGWB)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey)),
                      const SizedBox(height: 4),
                      const Text("34.2 m", style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0369A1))),
                      const Text("सुरक्षित क्षेत्र (Safe Zone)", style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF16A34A))),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GlassCard(
                  child: Column(
                    children: [
                      const Text("पालखेड़ नहर आवर्तन", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey)),
                      const SizedBox(height: 4),
                      const Text("28 August", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1B4332))),
                      const Text("6 दिन का पानी आवर्तन", style: TextStyle(fontSize: 10.5, color: Colors.black54)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // PMKSY Drip Subsidy Calculator
          GlassCard(
            backgroundColor: const Color(0xFFF0FDF4),
            border: Border.all(color: const Color(0xFF86EFAC)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("PMKSY 55% ड्रिप सब्सिडी कैलकुलेटर", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF14532D))),
                const SizedBox(height: 10),
                Text("रकबा: ${_acresDrip.toStringAsFixed(1)} एकड़", style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                Slider(min: 0.5, max: 5.0, divisions: 9, value: _acresDrip, onChanged: (v) => setState(() => _acresDrip = v), activeColor: const Color(0xFF16A34A)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("लागत: ₹$totalCost", style: const TextStyle(fontSize: 11.5)),
                    Text("55% सब्सिडी: -₹$subsidy", style: const TextStyle(fontSize: 11.5, color: Color(0xFF16A34A), fontWeight: FontWeight.w700)),
                  ],
                ),
                const Divider(),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text("किसान का शुद्ध अंशदान:", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                    Text("₹$farmerCost", style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF1B4332))),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
