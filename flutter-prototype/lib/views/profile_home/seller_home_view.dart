import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../components/common/motion_animations.dart';
import '../../components/navigation/dashboard_profile_switcher_bar.dart';
import '../../components/navigation/profile_switcher_sheet.dart';

class SellerHomeView extends StatelessWidget {
  final AppState state;
  const SellerHomeView({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFFEA580C);
    const accentColor = Color(0xFFC2410C);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        children: [
          // 1. Vyapari Banner Header
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [primaryColor, accentColor],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: primaryColor.withValues(alpha: 0.35),
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
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.storefront_rounded, color: Colors.white, size: 16),
                          SizedBox(width: 6),
                          Text("व्यापारी व आढ़ती डैशबोर्ड", style: TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                    BouncyPressable(
                      onTap: () {
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (ctx) => ProfileSwitcherSheet(state: state),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.22),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.4)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.swap_horiz_rounded, color: Colors.white, size: 13),
                            SizedBox(width: 4),
                            Text("स्विच ▾", style: TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w900)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                const Text(
                  "मंडी खरीद-बिक्री व स्टॉक लेजर",
                  style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  "लाइव एपीएमसी दरें, किसान खरीद एंट्री, थोक बिक्री और भुगतान ट्रैकिंग।",
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12),
                ),
                const SizedBox(height: 16),

                // Metrics Row
                Row(
                  children: [
                    _buildMetricPill("आज का टर्नओवर", "₹1,45,000", Icons.currency_rupee_rounded),
                    const SizedBox(width: 8),
                    _buildMetricPill("स्टॉक उपलब्ध", "280 क्विंटल", Icons.inventory_2_rounded),
                    const SizedBox(width: 8),
                    _buildMetricPill("सक्रिय खरीदार", "14 फर्म", Icons.people_rounded),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 1.5. Dashboard Multi-Profile Switcher Bar
          DashboardProfileSwitcherBar(state: state),
          const SizedBox(height: 14),

          // 2. Quick Action Modules Grid
          const Text(
            "व्यापार टूल्स व सेवाएं (Trading Tools):",
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: "लाइव मंडी भाव",
                  subtitle: "APMC नासिक, लासलगाव रेट",
                  icon: Icons.analytics_rounded,
                  color: const Color(0xFFEA580C),
                  onTap: () => state.navigateTo('mandi'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionCard(
                  title: "खरीदार डायरेक्टरी",
                  subtitle: "थोक व्यापारी व निर्यातक",
                  icon: Icons.business_center_rounded,
                  color: const Color(0xFF0284C7),
                  onTap: () => state.navigateTo('buyers'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: "मुनाफा व लेजर",
                  subtitle: "बिक्री मार्जिन व हिसाब-किताब",
                  icon: Icons.account_balance_wallet_rounded,
                  color: const Color(0xFF16A34A),
                  onTap: () => state.navigateTo('profitLoss'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionCard(
                  title: "उपज मार्केटप्लेस",
                  subtitle: "सीधा किसान लॉट खरीद",
                  icon: Icons.store_rounded,
                  color: const Color(0xFF8B5CF6),
                  onTap: () => state.navigateTo('marketplace'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // 3. Live Mandi Procurement Ledger
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.grey.shade200),
              boxShadow: [
                BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 10),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("आज की प्रमुख खरीद (Procurement Ledger):", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
                    Text("लाइव APMC", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFEA580C))),
                  ],
                ),
                const SizedBox(height: 12),
                _buildCommodityRow("प्याज (Nashik Red Onion)", "खरीद: 120 क्विंटल • ₹2,450/क्विंटल", "₹2,94,000", "+5.2% 📈"),
                const Divider(height: 18),
                _buildCommodityRow("टमाटर (Hybrid Tomato)", "खरीद: 85 कैरेट • ₹480/कैरेट", "₹40,800", "स्थिर ⚪"),
                const Divider(height: 18),
                _buildCommodityRow("सोयाबीन (Yellow Grade-A)", "खरीद: 60 क्विंटल • ₹4,800/क्विंटल", "₹2,88,000", "+2.8% 📈"),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricPill(String title, String value, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          children: [
            Icon(icon, size: 16, color: Colors.white),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w900)),
            Text(title, style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 9)),
          ],
        ),
      ),
    );
  }

  Widget _buildActionCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return BouncyPressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
            const SizedBox(height: 2),
            Text(subtitle, style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600)),
          ],
        ),
      ),
    );
  }

  Widget _buildCommodityRow(String name, String details, String total, String trend) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
              Text(details, style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600)),
            ],
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(total, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFFEA580C))),
            Text(trend, style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF16A34A))),
          ],
        ),
      ],
    );
  }
}
