import 'package:flutter/material.dart';
import '../../api/equipment_api.dart';
import '../../api/settlements_api.dart';
import '../../state/app_state.dart';
import '../../components/common/motion_animations.dart';
import '../../components/navigation/dashboard_profile_switcher_bar.dart';
import '../../components/navigation/profile_switcher_sheet.dart';
import '../../components/settlements_section.dart';
import 'transport_home_widgets.dart';

class EquipmentOwnerHomeView extends StatefulWidget {
  final AppState state;
  final EquipmentApi? equipmentApi;
  final SettlementsApi? settlementsApi;
  const EquipmentOwnerHomeView(
      {super.key, required this.state, this.equipmentApi, this.settlementsApi});

  @override
  State<EquipmentOwnerHomeView> createState() => _EquipmentOwnerHomeViewState();
}

class _EquipmentOwnerHomeViewState extends State<EquipmentOwnerHomeView> {
  late final EquipmentApi _api = widget.equipmentApi ?? EquipmentApi();

  bool _loading = true;
  List<Map<String, dynamic>> _fleet = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.getOwnerFleet();
      if (!mounted) return;
      setState(() {
        _fleet = (res['data'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _fleet = const [];
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFFF59E0B);
    const accentColor = Color(0xFFD97706);
    final bookedHours = _fleet.fold<num>(
      0,
      (sum, m) => sum + ((m['bookedHoursThisWeek'] as num?) ?? 0),
    );
    final weeklyIncome = _fleet.fold<num>(
      0,
      (sum, m) => sum + ((m['weeklyIncome'] as num?) ?? 0),
    );

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        color: primaryColor,
        onRefresh: _load,
        child: ListView(
          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
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
                            builder: (ctx) => ProfileSwitcherSheet(state: widget.state),
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
                      MetricPill(title: "यंत्र फ्लीट", value: "${_fleet.length} मशीनें", icon: Icons.agriculture_rounded),
                      const SizedBox(width: 8),
                      MetricPill(title: "सक्रिय स्लॉट", value: "$bookedHours घंटे बुक", icon: Icons.calendar_month_rounded),
                      const SizedBox(width: 8),
                      MetricPill(title: "साप्ताहिक आय", value: "₹${formatRupees(weeklyIncome)}", icon: Icons.currency_rupee_rounded),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // 1.5. Dashboard Multi-Profile Switcher Bar
            DashboardProfileSwitcherBar(state: widget.state),
            const SizedBox(height: 14),

            SettlementsSection(state: widget.state, settlementsApi: widget.settlementsApi),
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
                  child: TransportActionCard(
                    title: "मेरी मशीनें",
                    subtitle: "मशीन जोड़ें व प्रबंधित करें",
                    icon: Icons.precision_manufacturing_rounded,
                    color: const Color(0xFFF59E0B),
                    onTap: () => widget.state.navigateTo('machineManage'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TransportActionCard(
                    title: "स्लॉट कैलेंडर व बुकिंग",
                    subtitle: "लंबित बुकिंग व स्लॉट टेम्पलेट",
                    icon: Icons.calendar_month_rounded,
                    color: const Color(0xFF0284C7),
                    onTap: () => widget.state.navigateTo('slotCalendarManage'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            Row(
              children: [
                Expanded(
                  child: TransportActionCard(
                    title: "मुनाफा व मेंटेनेंस",
                    subtitle: "डीजल खर्च व नेट आय",
                    icon: Icons.account_balance_wallet_rounded,
                    color: const Color(0xFF16A34A),
                    onTap: () => widget.state.navigateTo('profitLoss'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TransportActionCard(
                    title: "कृषि रत्न AI",
                    subtitle: "स्मार्ट सलाह व मांग पूर्वसूचना",
                    icon: Icons.auto_awesome_rounded,
                    color: const Color(0xFF8B5CF6),
                    onTap: () => widget.state.navigateTo('krishiRatna'),
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
                  if (_loading)
                    const Center(child: CircularProgressIndicator())
                  else if (_fleet.isEmpty)
                    const Text("कोई मशीन नहीं — मेरी मशीनें से जोड़ें", style: TextStyle(fontSize: 12, color: Colors.grey))
                  else
                    ..._fleet.expand(
                      (m) => [
                        _buildFleetRow(m),
                        if (m != _fleet.last) const Divider(height: 18),
                      ],
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFleetRow(Map<String, dynamic> m) {
    final hours = (m['bookedHoursThisWeek'] as num?) ?? 0;
    final income = (m['weeklyIncome'] as num?) ?? 0;
    final docStatus = "${m['docStatus'] ?? 'pending'}";
    final statusLabel = switch (docStatus) {
      'verified' => "सत्यापित 🟢",
      'rejected' => "अस्वीकृत 🔴",
      _ => "सत्यापन लंबित 🟡",
    };
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("${m['name']}", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
              Text("बुकिंग: $hours घंटे इस सप्ताह", style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600)),
              if (m['rejectionReason'] != null)
                Text("कारण: ${m['rejectionReason']}", style: const TextStyle(fontSize: 10, color: Color(0xFFDC2626))),
            ],
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text("₹${formatRupees(income)}", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFFD97706))),
            Text(statusLabel, style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700)),
          ],
        ),
      ],
    );
  }
}
