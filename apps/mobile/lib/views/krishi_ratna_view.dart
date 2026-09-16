// Module P: Krishi Ratna Gamification & Rewards Store Flutter View

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';

class KrishiRatnaView extends StatelessWidget {
  final AppState state;
  const KrishiRatnaView({super.key, required this.state});

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
                  Text("कृषि रत्न व पुरस्कार वॉलेट", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text("दैनिक स्ट्रीक • लेवल 4 • 1450 सिक्के", style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              const AudioButton(text: "कृषि रत्न में आपके पास 1450 कृषि सिक्के हैं। आप इनसे खाद छूट वाउचर व मुफ्त वैज्ञानिक कॉल रिडीम कर सकते हैं।"),
            ],
          ),
          const SizedBox(height: 14),

          // Hero Level Banner
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF1B4332), Color(0xFF2D6A4F), Color(0xFFD4A373)]),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: const Color(0xFFE9C46A), borderRadius: BorderRadius.circular(10)),
                      child: const Text("Level 4: Krishi Daksh (कृषि दक्ष)", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF112A1F))),
                    ),
                    Row(
                      children: [
                        const Icon(Icons.monetization_on_rounded, color: Color(0xFFE9C46A), size: 18),
                        const SizedBox(width: 4),
                        Text("${state.profile.agriCoins} Coins", style: const TextStyle(color: Color(0xFFE9C46A), fontWeight: FontWeight.w900, fontSize: 14)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text("🔥 ${state.profile.streakDays} दिन की लगातार सक्रियता (Streak)", style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                const Text("अगले स्तर (Level 5 Farm CEO) हेतु 250 XP शेष हैं।", style: TextStyle(color: Color(0xFFD8F3DC), fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Rewards Store
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("🎁 कृषि सिक्का रिवार्ड स्टोर", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                _rewardItem("₹200 इफको खाद छूट वाउचर", 300, "नैनो डीएपी खरीद पर मान्य"),
                const Divider(),
                _rewardItem("मुफ्त मिट्टी पोषण सूक्ष्म परीक्षण (Soil Test)", 500, "12 पोषक तत्वों की लैब जांच"),
                const Divider(),
                _rewardItem("वरिष्ठ कृषि वैज्ञानिक 1-on-1 वीडियो कॉल", 800, "30 मिनट का व्यक्तिगत परामर्श"),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _rewardItem(String title, int cost, String desc) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            Text(desc, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
        ElevatedButton(
          onPressed: () => state.redeemCoupon(title, cost),
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE9C46A), foregroundColor: const Color(0xFF112A1F)),
          child: Text("$cost Coins", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
        ),
      ],
    );
  }
}
