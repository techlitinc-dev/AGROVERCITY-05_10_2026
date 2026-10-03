import 'package:flutter/material.dart';
import '../../api/settlements_api.dart';
import '../../state/app_state.dart';
import '../../components/common/motion_animations.dart';
import '../../components/navigation/dashboard_profile_switcher_bar.dart';
import '../../components/navigation/profile_switcher_sheet.dart';
import '../../components/settlements_section.dart';

class BrokerHomeView extends StatelessWidget {
  final AppState state;
  final SettlementsApi? settlementsApi;
  const BrokerHomeView({super.key, required this.state, this.settlementsApi});

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF14B8A6);
    const accentColor = Color(0xFF0D9488);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        children: [
          // 1. Broker Banner Header
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
                          Icon(Icons.handshake_rounded, color: Colors.white, size: 16),
                          SizedBox(width: 6),
                          Text("कृषि मध्यस्थ व दलाल डैशबोर्ड", style: TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w800)),
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
                  "सौदा मध्यस्थता व कमीशन लेजर",
                  style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  "किसान और बड़े खरीदारों के बीच पारदर्शी सौदे, डिजिटल अनुबंध और त्वरित कमीशन।",
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12),
                ),
                const SizedBox(height: 16),

                // Metrics Row
                Row(
                  children: [
                    _buildMetricPill("सक्रिय सौदे", "12 डील्स", Icons.sync_alt_rounded),
                    const SizedBox(width: 8),
                    _buildMetricPill("किसान लीड्स", "38 कृषक", Icons.groups_rounded),
                    const SizedBox(width: 8),
                    _buildMetricPill("कुल कमीशन", "₹34,800", Icons.currency_rupee_rounded),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 1.5. Dashboard Multi-Profile Switcher Bar
          DashboardProfileSwitcherBar(state: state),
          const SizedBox(height: 14),

          SettlementsSection(state: state, settlementsApi: settlementsApi),
          const SizedBox(height: 14),

          // 2. Quick Action Modules Grid
          const Text(
            "मध्यस्थ टूल्स व सेवाएं (Broker Services):",
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: "खरीदार डायरेक्टरी",
                  subtitle: "सत्यापित थोक खरीदार",
                  icon: Icons.business_rounded,
                  color: const Color(0xFF14B8A6),
                  onTap: () => state.navigateTo('buyers'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionCard(
                  title: "मंडी भाव व ट्रेंड्स",
                  subtitle: "मूल्य तुलना व पूर्वानुमान",
                  icon: Icons.show_chart_rounded,
                  color: const Color(0xFFEA580C),
                  onTap: () => state.navigateTo('mandi'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: "कमीशन व मुनाफा",
                  subtitle: "पेआउट हिस्ट्री व लेजर",
                  icon: Icons.account_balance_wallet_rounded,
                  color: const Color(0xFF16A34A),
                  onTap: () => state.navigateTo('profitLoss'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionCard(
                  title: "फाइनेंस व क्रेडिट",
                  subtitle: "व्यापार क्रेडिट व गारंटी",
                  icon: Icons.credit_score_rounded,
                  color: const Color(0xFF8B5CF6),
                  onTap: () => state.navigateTo('finance'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // 3. Active Facilitation Deals Card
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
                    Text("सक्रिय सौदे व लीड्स (Active Deal Contracts):", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
                    Text("लाइव पाइपलाइन", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF14B8A6))),
                  ],
                ),
                const SizedBox(height: 12),
                _buildDealRow("अंगूर एक्सपोर्ट लॉट (20 टन)", "किसान: पाटिल फार्म्स ➔ ITC Agro", "₹4,000 कमीशन", "अनुबंध स्वीकृत 🟢"),
                const Divider(height: 18),
                _buildDealRow("प्याज थोक लॉट (500 क्विंटल)", "किसान समूह (निफाड) ➔ वाशी ट्रेडर", "₹7,500 कमीशन", "कीमत वार्ता जारी 🟡"),
                const Divider(height: 18),
                _buildDealRow("सोयाबीन प्रोसेसिंग ग्रेड (10 टन)", "राम सिंह ➔ पतंजलि फूड्स", "₹2,200 कमीशन", "भुगतान लंबित ⚪"),
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

  Widget _buildDealRow(String deal, String parties, String commission, String status) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(deal, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
              Text(parties, style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600)),
            ],
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(commission, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF0D9488))),
            Text(status, style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700)),
          ],
        ),
      ],
    );
  }
}
