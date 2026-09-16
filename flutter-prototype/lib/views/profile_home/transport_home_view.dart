import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../components/common/motion_animations.dart';
import '../../components/navigation/dashboard_profile_switcher_bar.dart';
import '../../components/navigation/profile_switcher_sheet.dart';

class TransportHomeView extends StatelessWidget {
  final AppState state;
  const TransportHomeView({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF0284C7);
    const accentColor = Color(0xFF0369A1);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        children: [
          // 1. Transporter Banner Header
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
                          Icon(Icons.local_shipping_rounded, color: Colors.white, size: 16),
                          SizedBox(width: 6),
                          Text("कृषि परिवहन डैशबोर्ड", style: TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w800)),
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
                  "कृषि माल ढुलाई व ट्रिप प्रबंधन",
                  style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  "खेत से मंडी सीधी बुकिंग, वाहन ट्रैकिंग और त्वरित डिजिटल भुगतान।",
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12),
                ),
                const SizedBox(height: 16),

                // Metrics Row
                Row(
                  children: [
                    _buildMetricPill("सक्रिय वाहन", "4 गाड़ियां", Icons.directions_car_rounded),
                    const SizedBox(width: 8),
                    _buildMetricPill("आज की ट्रिप्स", "6 पूर्ण", Icons.route_rounded),
                    const SizedBox(width: 8),
                    _buildMetricPill("दैनिक भाड़ा", "₹28,500", Icons.currency_rupee_rounded),
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
            "परिवहन टूल्स व सेवाएं (Transport Tools):",
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: "पोस्ट-हार्वेस्ट लॉजिस्टिक्स",
                  subtitle: "कोल्ड स्टोरेज व साइलो भाड़ा",
                  icon: Icons.warehouse_rounded,
                  color: const Color(0xFF0284C7),
                  onTap: () => state.navigateTo('postHarvest'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionCard(
                  title: "उपज मार्केटप्लेस",
                  subtitle: "माल ढुलाई के नए ऑर्डर",
                  icon: Icons.shopping_bag_rounded,
                  color: const Color(0xFF16A34A),
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
                  title: "वाहन लोन व क्रेडिट",
                  subtitle: "पेट्रोल कार्ड व फाइनेंस",
                  icon: Icons.credit_card_rounded,
                  color: const Color(0xFF8B5CF6),
                  onTap: () => state.navigateTo('finance'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionCard(
                  title: "ज्ञान हब व नियम",
                  subtitle: "ई-वे बिल व आरटीओ नियम",
                  icon: Icons.menu_book_rounded,
                  color: const Color(0xFFEA580C),
                  onTap: () => state.navigateTo('gyanHub'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // 3. Live Trip Bookings Card
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
                    Text("आज की लाइव ट्रिप्स (Today's Active Trips):", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
                    Text("2 रनिंग", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0284C7))),
                  ],
                ),
                const SizedBox(height: 12),
                _buildTripRow("MH-15-EG-4482 (आयशर 14ft)", "पिंपलगाव ➔ नासिक APMC (प्याज)", "₹4,200", "रास्ते में 🟢"),
                const Divider(height: 18),
                _buildTripRow("MH-15-BT-9102 (महिंद्रा बोलेरो)", "निफाड ➔ मुंबई वाशी (अंगूर)", "₹8,500", "लोडिंग पूर्ण 🟡"),
                const Divider(height: 18),
                _buildTripRow("MH-15-AX-3310 (ट्रैक्टर ट्रॉली)", "ओझर ➔ लासलगाव (टमाटर)", "₹2,800", "शेड्यूल ⚪"),
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

  Widget _buildTripRow(String vehicle, String route, String fare, String status) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(vehicle, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
              Text(route, style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600)),
            ],
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(fare, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF0284C7))),
            Text(status, style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700)),
          ],
        ),
      ],
    );
  }
}
