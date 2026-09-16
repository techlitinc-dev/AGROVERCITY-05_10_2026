// Module O: Post-Harvest Supply Chain Flutter View

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';

class PostHarvestView extends StatelessWidget {
  final AppState state;
  const PostHarvestView({super.key, required this.state});

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
                  Text("कटाई-उपरांत आपूर्ति श्रृंखला", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text("कोल्ड स्टोरेज • प्रोसेसिंग मिलें • गुणवत्ता ग्रेडिंग", style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              const AudioButton(text: "कटाई उपरांत श्रृंखला में नजदीकी कोल्ड स्टोरेज में बारह सौ मीट्रिक टन क्षमता उपलब्ध है।"),
            ],
          ),
          const SizedBox(height: 14),

          // Cold Storages
          _csCard("Sahyadri Mega Agro Cold Chain Ltd.", "7.2 km दूर • 2°C to 4°C", "उपलब्ध: 1,200 MT (कुल: 5,000 MT)", "₹95 / क्विंटल / माह"),
          const SizedBox(height: 10),
          _csCard("Niphad Onion & Agri Warehouse", "14.0 km दूर • Ambient Ventilated", "उपलब्ध: 450 MT (कुल: 2,000 MT)", "₹60 / क्विंटल / माह"),
          const SizedBox(height: 14),

          // Quality Grading
          GlassCard(
            backgroundColor: const Color(0xFFF0FDF4),
            border: Border.all(color: const Color(0xFF86EFAC)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("🔬 एआई उत्पाद गुणवत्ता ग्रेडिंग", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF14532D))),
                    Text("AGMARK Grade A ✅", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF16A34A))),
                  ],
                ),
                const SizedBox(height: 6),
                const Text("94% आकार व रंग एकरूपता • 14 दिन शेल्फ लाइफ • अनुशंसित भाव: ₹24 - ₹28/kg", style: TextStyle(fontSize: 12, color: Colors.black87)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _csCard(String name, String temp, String cap, String rate) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
          Text(temp, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          const SizedBox(height: 6),
          Text(cap, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF16A34A))),
          Text("दर: $rate", style: const TextStyle(fontSize: 12, color: Colors.black87)),
        ],
      ),
    );
  }
}
