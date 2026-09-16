// Refer & Earn Point System (शेतकरी मित्र जोडा आणि कमवा)

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../state/app_state.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';
import '../components/common/motion_animations.dart';

class ReferEarnView extends StatefulWidget {
  final AppState state;
  const ReferEarnView({super.key, required this.state});

  @override
  State<ReferEarnView> createState() => _ReferEarnViewState();
}

class _ReferEarnViewState extends State<ReferEarnView> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  void _openInviteDialog() {
    _nameController.clear();
    _phoneController.clear();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFFFEF3C7),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.person_add_alt_1_rounded, color: Color(0xFFD97706), size: 22),
            ),
            const SizedBox(width: 10),
            const Text(
              "शेतकरी मित्राला जोडा",
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("मित्राचे नाव:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                hintText: "उदा. विठ्ठल जाधव",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              ),
            ),
            const SizedBox(height: 10),
            const Text("मोबाईल क्रमांक:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                prefixText: "+91 ",
                hintText: "98221 00000",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("रद्द करा")),
          ElevatedButton(
            onPressed: () {
              final name = _nameController.text.trim().isEmpty ? "शेतकरी मित्र" : _nameController.text.trim();
              final phone = _phoneController.text.trim().isEmpty ? "+91 98221 *****" : "+91 ${_phoneController.text.trim()}";
              Navigator.pop(ctx);
              widget.state.inviteFarmer(name: name, phone: phone);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1B4332),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text("आमंत्रण पाठवा (+100 नाणी)", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
  }

  void _copyReferralCode() {
    Clipboard.setData(ClipboardData(text: widget.state.referralCode));
    widget.state.showToast("📋 रेफरल कोड कॉपी झाला: ${widget.state.referralCode}");
  }

  @override
  Widget build(BuildContext context) {
    final totalReferred = widget.state.referrals.length;
    final totalCoinsEarned = widget.state.referrals.fold(0, (sum, r) => sum + r.rewardCoins);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Header with Audio
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.card_giftcard_rounded, color: Color(0xFFCA8A04), size: 22),
                      SizedBox(width: 6),
                      Text(
                        "रेफर करा व नाणी कमवा",
                        style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                      ),
                    ],
                  ),
                  Text(
                    "शेतकरी मित्रांना जोडून मोफत खत व सवलत मिळवा",
                    style: TextStyle(fontSize: 11.5, color: Colors.grey, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const AudioButton(text: "शेतकरी मित्र जोडा आणि कमवा योजनेत आपले स्वागत आहे. प्रत्येक मित्राला जोडल्यावर शंभर कृषी नाणी मिळतात."),
            ],
          ),
          const SizedBox(height: 14),

          // 2. Main Referral Hero Card
          StaggeredSlideFade(
            delayMs: 0,
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF713F12), Color(0xFF854D0E), Color(0xFFCA8A04)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFCA8A04).withValues(alpha: 0.35),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        "तुमचा वैयक्तिक रेफरल कोड",
                        style: TextStyle(fontSize: 12, color: Color(0xFFFEF3C7), fontWeight: FontWeight.w700),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          "एकूण नाणी: $totalCoinsEarned 🪙",
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Code Pill Box
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFFEF08A), width: 1.2),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          widget.state.referralCode,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: 2.0,
                          ),
                        ),
                        Row(
                          children: [
                            BouncyPressable(
                              onTap: _copyReferralCode,
                              child: Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(Icons.copy_rounded, size: 16, color: Color(0xFF713F12)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // 1-Tap Share Buttons
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            widget.state.showToast("📲 व्हॉट्सअ‍ॅपवर आमंत्रण लिंक पाठवली जात आहे...");
                          },
                          icon: const Icon(Icons.share_rounded, size: 16, color: Colors.white),
                          label: const Text("WhatsApp शेअर", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF16A34A),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _openInviteDialog,
                          icon: const Icon(Icons.person_add_rounded, size: 16, color: Color(0xFF713F12)),
                          label: const Text("मित्राला जोडा", style: TextStyle(color: Color(0xFF713F12), fontWeight: FontWeight.w900, fontSize: 12)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFFEF08A),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // 3. Milestone Rewards Progress Bar
          GlassCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "🏆 रेफरल बक्षीस टप्पे (Milestone Rewards)",
                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                ),
                const SizedBox(height: 10),
                _milestoneItem("१ शेतकरी जोडला", "+100 कृषी नाणी जमा", totalReferred >= 1),
                _milestoneItem("५ शेतकरी जोडले", "मोफत माती परीक्षण व्हाऊचर (₹500 मूल्य)", totalReferred >= 5),
                _milestoneItem("१० शेतकरी जोडले", "यंत्र भाड्यावर ₹500 ची थेट सूट", totalReferred >= 10),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 4. Referred Farmers List
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "जोडलेले शेतकरी मित्र ($totalReferred)",
                style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
              ),
              Text(
                "+$totalCoinsEarned Coins",
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF15803D)),
              ),
            ],
          ),
          const SizedBox(height: 10),

          ...widget.state.referrals.map((ref) {
            return GlassCard(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: const Color(0xFFE8F5E9),
                    radius: 18,
                    child: Text(
                      ref.farmerName.substring(0, 1),
                      style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF1B5E20)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(ref.farmerName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                        Text("${ref.village} • ${ref.joinDate}", style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text("+${ref.rewardCoins} 🪙", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF92400E))),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _milestoneItem(String target, String reward, bool isAchieved) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            isAchieved ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
            size: 16,
            color: isAchieved ? const Color(0xFF16A34A) : Colors.grey,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(fontSize: 12, color: Color(0xFF374151)),
                children: [
                  TextSpan(text: "$target: ", style: const TextStyle(fontWeight: FontWeight.w800)),
                  TextSpan(
                    text: reward,
                    style: TextStyle(
                      color: isAchieved ? const Color(0xFF15803D) : Colors.grey.shade700,
                      fontWeight: isAchieved ? FontWeight.w800 : FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
