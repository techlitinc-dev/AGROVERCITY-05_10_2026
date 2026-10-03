import 'package:flutter/material.dart';
import '../../api/settlements_api.dart';
import '../../api/transport_api.dart';
import '../../state/app_state.dart';
import '../../components/common/motion_animations.dart';
import '../../components/navigation/dashboard_profile_switcher_bar.dart';
import '../../components/navigation/profile_switcher_sheet.dart';
import '../../components/settlements_section.dart';
import '../transporter/trip_expenses_sheet.dart';
import 'transport_home_widgets.dart';

class TransportHomeView extends StatefulWidget {
  final AppState state;
  final TransportApi? transportApi;
  final SettlementsApi? settlementsApi;
  const TransportHomeView(
      {super.key, required this.state, this.transportApi, this.settlementsApi});

  @override
  State<TransportHomeView> createState() => _TransportHomeViewState();
}

class _TransportHomeViewState extends State<TransportHomeView> {
  late final TransportApi _api = widget.transportApi ?? TransportApi();

  bool _loading = true;
  List<Map<String, dynamic>> _trips = [];
  List<Map<String, dynamic>> _vehicles = [];
  int _pendingRequests = 0;
  int _openLoadsCount = 0;
  Map<String, dynamic> _profile = const {};
  Map<String, dynamic> _analytics = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    var trips = <Map<String, dynamic>>[];
    var vehicles = <Map<String, dynamic>>[];
    var pending = 0;
    var openLoadsCount = 0;
    Map<String, dynamic> profile = const {};
    Map<String, dynamic> analytics = const {};

    try {
      final res = await _api.getBookings();
      trips = (res['data'] as List).cast<Map<String, dynamic>>();
    } catch (_) {}
    try {
      final res = await _api.getBookings(status: 'requested');
      pending = (res['total'] as num?)?.toInt() ?? (res['data'] as List).length;
    } catch (_) {}
    try {
      final res = await _api.getMyVehicles();
      vehicles = (res['data'] as List).cast<Map<String, dynamic>>();
    } catch (_) {}
    try {
      final res = await _api.getOpenLoads();
      final data = res['data'] as List?;
      openLoadsCount = data?.length ?? 0;
    } catch (_) {}
    try {
      final res = await _api.getTransporterProfile();
      profile = (res['profile'] as Map<String, dynamic>?) ?? const {};
    } catch (_) {}
    try {
      final res = await _api.getTransportAnalytics();
      analytics = (res['analytics'] as Map<String, dynamic>?) ?? const {};
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _trips = trips;
      _vehicles = vehicles;
      _pendingRequests = pending;
      _openLoadsCount = openLoadsCount;
      _profile = profile;
      _analytics = analytics;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF0284C7);
    const accentColor = Color(0xFF0369A1);
    final activeTrips = _trips.where((t) => t['status'] == 'enRoute').length;
    final dailyFare = _trips
        .where((t) => t['status'] == 'accepted' || t['status'] == 'enRoute')
        .fold<num>(0, (sum, t) => sum + ((t['fare'] as num?) ?? 0));

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        color: primaryColor,
        onRefresh: _load,
        child: ListView(
          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          children: [
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
                        child: Row(
                          children: [
                            const Icon(Icons.local_shipping_rounded, color: Colors.white, size: 16),
                            const SizedBox(width: 6),
                            Text(
                              (_profile['businessName'] as String?)?.isNotEmpty == true
                                  ? "सत्यापित ट्रांसपोर्टर"
                                  : "कृषि परिवहन डैशबोर्ड",
                              style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w800),
                            ),
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
                  Text(
                    ((_profile['businessName'] as String?)?.isNotEmpty == true)
                        ? (_profile['businessName'] as String)
                        : "कृषि माल ढुलाई व ट्रिप प्रबंधन",
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 4),
                  Builder(builder: (context) {
                    final rawRoutes = _profile['operatingRoutes'];
                    final routesStr = rawRoutes is List
                        ? rawRoutes.join(', ')
                        : (rawRoutes is String ? rawRoutes : null);
                    return Text(
                      routesStr?.isNotEmpty == true
                          ? "ऑपरेटिंग रूट्स: $routesStr • ${_profile['transporterType'] ?? 'फ्लीट ऑपरेटर'}"
                          : "खेत से मंडी सीधी बुकिंग, वाहन ट्रैकिंग और त्वरित डिजिटल भुगतान।",
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12),
                    );
                  }),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      MetricPill(title: "सक्रिय वाहन", value: "${_vehicles.length} गाड़ियां", icon: Icons.directions_car_rounded),
                      const SizedBox(width: 8),
                      MetricPill(title: "आज की ट्रिप्स", value: "$activeTrips लाइव", icon: Icons.route_rounded),
                      const SizedBox(width: 8),
                      MetricPill(title: "दैनिक भाड़ा", value: "₹${formatRupees(dailyFare)}", icon: Icons.currency_rupee_rounded),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            DashboardProfileSwitcherBar(state: widget.state),
            const SizedBox(height: 14),

            SettlementsSection(state: widget.state, settlementsApi: widget.settlementsApi),
            const SizedBox(height: 14),

            const Text(
              "परिवहन टूल्स व सेवाएं (Transport Management):",
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 10),

            Row(
              children: [
                Expanded(
                  child: TransportActionCard(
                    title: "लोड बाज़ार",
                    subtitle: "खुले लोड खोजें व बिड लगाएं",
                    icon: Icons.local_shipping_outlined,
                    color: const Color(0xFFD97706),
                    badgeCount: _openLoadsCount,
                    onTap: () => widget.state.openLoadBoard(),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TransportActionCard(
                    title: "बुकिंग अनुरोध",
                    subtitle: "नए ट्रिप अनुरोध स्वीकारें",
                    icon: Icons.inbox_rounded,
                    color: const Color(0xFF0284C7),
                    badgeCount: _pendingRequests,
                    onTap: () => widget.state.navigateTo('bookingInbox'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            Row(
              children: [
                Expanded(
                  child: TransportActionCard(
                    title: "मेरे वाहन",
                    subtitle: "गाड़ी जोड़ें व प्रबंधित करें",
                    icon: Icons.directions_car_rounded,
                    color: const Color(0xFF16A34A),
                    onTap: () => widget.state.navigateTo('vehicleManage'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TransportActionCard(
                    title: "बिजनेस प्रोफाइल",
                    subtitle: "रूट्स, लाइसेंस व रेट कार्ड",
                    icon: Icons.badge_rounded,
                    color: const Color(0xFF7C3AED),
                    onTap: () => widget.state.openTransporterProfile(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            Row(
              children: [
                Expanded(
                  child: TransportActionCard(
                    title: "पोस्ट-हार्वेस्ट लॉजिस्टिक्स",
                    subtitle: "कोल्ड स्टोरेज व साइलो भाड़ा",
                    icon: Icons.warehouse_rounded,
                    color: const Color(0xFF0284C7),
                    onTap: () => widget.state.navigateTo('postHarvest'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TransportActionCard(
                    title: "ज्ञान हब व नियम",
                    subtitle: "ई-वे बिल व आरटीओ नियम",
                    icon: Icons.menu_book_rounded,
                    color: const Color(0xFFEA580C),
                    onTap: () => widget.state.navigateTo('gyanHub'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text("आज की लाइव ट्रिप्स (Today's Active Trips):", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
                      Text("$activeTrips रनिंग", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0284C7))),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_loading)
                    const Center(child: CircularProgressIndicator())
                  else if (_trips.isEmpty)
                    const Text("कोई ट्रिप नहीं", style: TextStyle(fontSize: 12, color: Colors.grey))
                  else
                    ..._trips.expand(
                      (t) => [
                        TripRow(
                          booking: t,
                          onTap: () => widget.state.openTripDetail(t),
                          onTracking: () => widget.state.openLiveTracking(t),
                          onBilty: () => widget.state.openBilty(t),
                          onExpenses: () {
                            showModalBottomSheet(
                              context: context,
                              isScrollControlled: true,
                              backgroundColor: Colors.white,
                              shape: const RoundedRectangleBorder(
                                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                              ),
                              builder: (_) => TripExpensesSheet(
                                state: widget.state,
                                bookingId: "${t['id']}",
                                grossFare: ((t['fare'] as num?)?.toDouble()) ?? 0.0,
                                api: _api,
                              ),
                            );
                          },
                        ),
                        if (t != _trips.last) const Divider(height: 18),
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
}
