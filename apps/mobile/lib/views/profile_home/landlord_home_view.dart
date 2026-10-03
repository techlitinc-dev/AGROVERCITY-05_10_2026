import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../components/common/motion_animations.dart';
import '../../components/navigation/dashboard_profile_switcher_bar.dart';
import '../../components/navigation/profile_switcher_sheet.dart';

class LandlordHomeView extends StatelessWidget {
  final AppState state;
  const LandlordHomeView({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF8B5CF6);
    const accentColor = Color(0xFF7C3AED);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        children: [
          // 1. Persona Header Card
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
                          Icon(Icons.landscape_rounded, color: Colors.white, size: 16),
                          SizedBox(width: 6),
                          Text("खेत मालिक डैशबोर्ड", style: TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w800)),
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
                  "भूमि प्रबंधन व लीज अनुबंध",
                  style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  "खेत किराया, 7/12 भू-अभिलेख और कानूनी अनुबंधों का एक जगह समाधान।",
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12),
                ),
                const SizedBox(height: 16),

                // Metrics Row
                Row(
                  children: [
                    _buildMetricPill("कुल भूमि", "18.5 एकड़", Icons.map_rounded),
                    const SizedBox(width: 8),
                    _buildMetricPill("सक्रिय किराएदार", "3 किसान", Icons.handshake_rounded),
                    const SizedBox(width: 8),
                    _buildMetricPill("मासिक आय", "₹42,000", Icons.currency_rupee_rounded),
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
            "प्रमुख टूल्स व सुविधाएं (Landlord Services):",
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: "7/12 भू-अभिलेख",
                  subtitle: "डिजिटल खतौनी व रिकॉर्ड",
                  icon: Icons.description_rounded,
                  color: const Color(0xFF8B5CF6),
                  onTap: () => state.navigateTo('landLegal'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionCard(
                  title: "सरकारी योजनाएं",
                  subtitle: "भूमि विकास व सब्सिडी",
                  icon: Icons.account_balance_rounded,
                  color: const Color(0xFF0284C7),
                  onTap: () => state.navigateTo('schemes'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: "मुनाफा व खाता-बही",
                  subtitle: "किराया आय व खर्च लेजर",
                  icon: Icons.account_balance_wallet_rounded,
                  color: const Color(0xFF16A34A),
                  onTap: () => state.navigateTo('profitLoss'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionCard(
                  title: "बाज़ार व उपज",
                  subtitle: "मार्केटप्लेस लिस्टिंग",
                  icon: Icons.store_rounded,
                  color: const Color(0xFFEA580C),
                  onTap: () => state.navigateTo('marketplace'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: "प्लॉट और पट्टे",
                  subtitle: "प्लॉट, लीज व किराया ट्रैकिंग",
                  icon: Icons.landscape_rounded,
                  color: const Color(0xFF8B5CF6),
                  onTap: () => state.navigateTo('landlordPlots'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionCard(
                  title: "ज़मीन लिस्टिंग",
                  subtitle: "किराए की ज़मीन व अनुरोध",
                  icon: Icons.storefront_rounded,
                  color: const Color(0xFF0D9488),
                  onTap: () => state.navigateTo('landListings'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // 3. Active Land Leases Summary Card
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
                    Text("सक्रिय लीज अनुबंध (Active Land Leases):", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
                    Text("3 प्लॉट्स", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF8B5CF6))),
                  ],
                ),
                const SizedBox(height: 12),
                _buildLeaseRow("प्लॉट A: 6.5 एकड़ (काली मिट्टी)", "किराएदार: राम सिंह", "₹18,000/माह", "सत्यापित"),
                const Divider(height: 18),
                _buildLeaseRow("प्लॉट B: 8.0 एकड़ (नहर सिंचित)", "किराएदार: दीपक पाटिल", "₹24,000/माह", "सत्यापित"),
                const Divider(height: 18),
                _buildLeaseRow("प्लॉट C: 4.0 एकड़ (बागवानी)", "नया आवेदन उपलब्ध", "प्रस्तावित", "प्रक्रिया में"),
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

  Widget _buildLeaseRow(String plot, String tenant, String rent, String status) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(plot, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
            Text(tenant, style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600)),
          ],
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(rent, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF8B5CF6))),
            Text(status, style: const TextStyle(fontSize: 9.5, color: Color(0xFF16A34A), fontWeight: FontWeight.w700)),
          ],
        ),
      ],
    );
  }
}
