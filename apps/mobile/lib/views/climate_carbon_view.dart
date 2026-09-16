// Module J: Climate-Smart & Carbon Credits Flutter View

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';

class ClimateCarbonView extends StatelessWidget {
  final AppState state;
  const ClimateCarbonView({super.key, required this.state});

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
                  Text("जलवायु-अनुकूल खेती व कार्बन", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text("पुनर्योजी कृषि • कार्बन क्रेडिट आय • सूखा/बाढ़ किस्में", style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              const AudioButton(text: "जलवायु अनुकूल खेती अपनाकर आप प्रति वर्ष कार्बन क्रेडिट से अतिरिक्त आय कमा सकते हैं।"),
            ],
          ),
          const SizedBox(height: 14),

          // Carbon Credit Hero Box
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF064E3B), Color(0xFF065F46), Color(0xFF047857)]),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("🌍 अंतर्राष्ट्रीय कार्बन क्रेडिट आय क्षमता", style: TextStyle(color: Color(0xFFE9C46A), fontSize: 11, fontWeight: FontWeight.w700)),
                SizedBox(height: 8),
                Text("₹9,200 / वर्ष", style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900)),
                Text("4.6 MT CO2e अवशोषण (बायोचार, शून्य जुताई व हरी खाद द्वारा)", style: TextStyle(color: Color(0xFFA7F3D0), fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Resilient Varieties
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("🌾 जलवायु-सहिष्णु उन्नत किस्में", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                const Text("• बाजरा (ProAgro 9444): 45°C तापमान सहने योग्य, 60% कम पानी\n• स्वर्णा सब-1 धान: 14 दिन तक पानी में डूबने पर भी नष्ट नहीं होता", style: TextStyle(fontSize: 12, height: 1.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
