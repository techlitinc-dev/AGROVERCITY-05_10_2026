import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../components/common/motion_animations.dart';
import '../../components/navigation/dashboard_profile_switcher_bar.dart';
import '../../components/navigation/profile_switcher_sheet.dart';

class EquipmentOwnerHomeView extends StatelessWidget {
  final AppState state;
  const EquipmentOwnerHomeView({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFFF59E0B);
    const accentColor = Color(0xFFD97706);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        children: [
          // 1. Equipment Owner Banner
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
                          Icon(Icons.construction_rounded, color: Colors.white, size: 16),
                          SizedBox(width: 6),
                          Text("कृषि यंत्र मालिक डैशबोर्ड", style: TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w800)),
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
                  "यंत्र बेड़ा व बुकिंग कैलेंडर",
                  style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  "ट्रैक्टर, हार्वेस्टर, रोटावेटर की रेंटल बुकिंग, घंटे ट्रैकिंग और ऑपरेटर प्रबंधन।",
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12),
                ),
                const SizedBox(height: 16),

                // Metrics Row
                Row(
                  children: [
                    _buildMetricPill("यंत्र फ्लीट", "6 मशीनें", Icons.agriculture_rounded),
                    const SizedBox(width: 8),
                    _buildMetricPill("सक्रिय स्लॉट", "8 घंटे बुक", Icons.calendar_month_rounded),
                    const SizedBox(width: 8),
                    _buildMetricPill("साप्ताहिक आय", "₹52,000", Icons.currency_rupee_rounded),
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
            "यंत्र प्रबंधन टूल्स (Equipment Tools):",
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: "यंत्र सेवा हब",
                  subtitle: "टाइम-स्लॉट व रेंटल लिस्टिंग",
                  icon: Icons.precision_manufacturing_rounded,
                  color: const Color(0xFFF59E0B),
                  onTap: () => state.navigateTo('equipment'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionCard(
                  title: "मशीनरी लोन व EMI",
                  subtitle: "ट्रैक्टर व कंबाइन फाइनेंस",
                  icon: Icons.account_balance_rounded,
                  color: const Color(0xFF0284C7),
                  onTap: () => state.navigateTo('finance'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: _buildActionCard(
                  title: "मुनाफा व मेंटेनेंस",
                  subtitle: "डीजल खर्च व नेट आय",
                  icon: Icons.account_balance_wallet_rounded,
                  color: const Color(0xFF16A34A),
                  onTap: () => state.navigateTo('profitLoss'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionCard(
                  title: "कृषि रत्न AI",
                  subtitle: "स्मार्ट सलाह व मांग पूर्वसूचना",
                  icon: Icons.auto_awesome_rounded,
                  color: const Color(0xFF8B5CF6),
                  onTap: () => state.navigateTo('krishiRatna'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // 3. Equipment Fleet Status Card
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
                    Text("यंत्र फ्लीट स्थिति (Fleet Status & Bookings):", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
                    Text("लाइव शेड्यूल", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFF59E0B))),
                  ],
                ),
                const SizedBox(height: 12),
                _buildFleetRow("महिंद्रा 575 DI (50 HP ट्रैक्टर)", "बुकिंग: खेत जुताई (निफाड) • 4 घंटे", "₹3,600", "कार्य प्रगति पर 🟢"),
                const Divider(height: 18),
                _buildFleetRow("शक्तिमान रोटावेटर 7ft", "बुकिंग: शाम 3:00 - 6:00 PM (ओझर)", "₹2,100", "शेड्यूल्ड 🟡"),
                const Divider(height: 18),
                _buildFleetRow("जॉन डियर कंबाइन हार्वेस्टर", "सोयाबीन कटाई (पिंपलगाव)", "₹14,000", "बुकिंग कन्फर्म 🟢"),
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

  Widget _buildFleetRow(String machine, String booking, String fare, String status) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(machine, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
              Text(booking, style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600)),
            ],
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(fare, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFFD97706))),
            Text(status, style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700)),
          ],
        ),
      ],
    );
  }
}
