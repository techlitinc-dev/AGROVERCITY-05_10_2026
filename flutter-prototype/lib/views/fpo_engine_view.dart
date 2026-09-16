// Module H: FPO Growth Engine Flutter View

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';

class FpoEngineView extends StatelessWidget {
  final AppState state;
  const FpoEngineView({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
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
                  Text("एफपीओ विकास इंजन (FPO Hub)", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text("सामूहिक खरीद • साझा यंत्र • एफपीओ एनालिटिक्स", style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              const AudioButton(text: "सह्याद्री एफपीओ में नैनो यूरिया के सामूहिक आर्डर पर 18 प्रतिशत की छूट उपलब्ध है।"),
            ],
          ),
          const SizedBox(height: 14),

          // FPO Profile Banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF1B4332), Color(0xFF2D6A4F)]),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Sahyadri Farmer Producer Co. Ltd.", style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                SizedBox(height: 4),
                Text("सदस्य: 420 किसान • सचिव: राजेश पटेल • नासिक", style: TextStyle(color: Color(0xFFD8F3DC), fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Bulk Procurement Pool
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("📦 सामूहिक नैनो यूरिया खरीद पूल", style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800)),
                    Text("18% छूट अनलॉक!", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF16A34A))),
                  ],
                ),
                const SizedBox(height: 8),
                const Text("380 / 500 बोतलें बुक हो चुकी हैं (समय शेष: 3 दिन)", style: TextStyle(fontSize: 11.5, color: Colors.grey)),
                const SizedBox(height: 8),
                LinearProgressIndicator(value: 0.76, backgroundColor: Colors.grey.shade200, valueColor: const AlwaysStoppedAnimation(Color(0xFF16A34A))),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: () => state.showToast("एफपीओ बल्क आर्डर में 5 बोतलें जोड़ी गईं!"),
                  icon: const Icon(Icons.add_shopping_cart_rounded, size: 16),
                  label: const Text("ग्रुप पूल में 5 यूनिट आर्डर जोड़ें (₹184/बोतल)", style: TextStyle(fontWeight: FontWeight.w700)),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 40)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Shared Machinery
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("🚜 FPO साझा मशीनरी कैलेंडर", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                _machineryItem("John Deere 5050D Tractor (50 HP)", "₹650/घंटा", "उपलब्ध (चालक सहित)"),
                const Divider(),
                _machineryItem("Kubota Combine Harvester DC-68G", "₹1,800/घंटा", "गुरुवार तक बुक"),
                const Divider(),
                _machineryItem("10L Agriculture Drone Sprayer", "₹350/एकड़", "उपलब्ध"),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _machineryItem(String name, String rate, String st) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
            Text(rate, style: const TextStyle(fontSize: 11, color: Color(0xFF16A34A), fontWeight: FontWeight.w700)),
          ],
        ),
        Text(st, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
  }
}
