import 'package:flutter/material.dart';
import '../../api/api_exception.dart';
import '../../api/transport_api.dart';
import '../../state/app_state.dart';

class LiveTrackingView extends StatefulWidget {
  final AppState state;
  final TransportApi? transportApi;

  const LiveTrackingView({
    super.key,
    required this.state,
    this.transportApi,
  });

  @override
  State<LiveTrackingView> createState() => _LiveTrackingViewState();
}

class _LiveTrackingViewState extends State<LiveTrackingView> {
  late final TransportApi _api = widget.transportApi ?? TransportApi();

  bool _loading = true;
  Map<String, dynamic> _trackingData = {};

  late final Map<String, dynamic> _booking =
      Map<String, dynamic>.from(widget.state.selectedTrip ?? const {});

  String get _id => "${_booking['id']}";

  static const _allWaypoints = [
    {'key': 'accepted', 'title': 'बुकिंग स्वीकृत', 'subtitle': 'गाड़ी असाइन हुई'},
    {'key': 'at_pickup', 'title': 'खेत पर वाहन आगमन', 'subtitle': 'लोडिंग पॉइंट पर उपस्थित'},
    {'key': 'weighbridge', 'title': 'धर्मकांटा वजन पर्ची', 'subtitle': 'खाली व भरा वजन सत्यापित'},
    {'key': 'in_transit', 'title': 'हाईवे पर गतिशील', 'subtitle': 'मंडी की ओर रवाना'},
    {'key': 'mandi_gate', 'title': 'मंडी गेट आगमन', 'subtitle': 'गेट एंट्री पर्ची'},
    {'key': 'delivered', 'title': 'माल अनलोड व पूर्ण', 'subtitle': 'डिजिटल POD प्राप्त'},
  ];

  @override
  void initState() {
    super.initState();
    _loadLocation();
  }

  Future<void> _loadLocation() async {
    try {
      final res = await _api.getTripLocation(_id);
      if (!mounted) return;
      setState(() {
        _trackingData = res;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _advanceWaypoint(String key, String label) async {
    try {
      await _api.updateTripLocation(
        _id,
        lat: 19.9975 + (DateTime.now().second % 10) * 0.005,
        lng: 73.7898 + (DateTime.now().second % 10) * 0.005,
        speedKmH: 48.0,
        heading: 110.0,
        waypoint: key,
        waypointLabel: label,
      );
      widget.state.showToast("वेपॉइंट अपडेट हुआ: $label ✅");
      _loadLocation();
    } on ApiException catch (e) {
      widget.state.showToast(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF0284C7);
    final currentLoc =
        (_trackingData['currentLocation'] as Map<String, dynamic>?) ?? {};
    final currentWaypoint = currentLoc['waypoint'] ?? 'in_transit';
    final speed = (currentLoc['speedKmH'] as num?)?.toDouble() ?? 45.0;
    final etaMinutes = (_trackingData['estimatedMinutesLeft'] as num?)?.toInt() ?? 35;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF1E293B)),
          onPressed: widget.state.navigateBack,
        ),
        title: const Text(
          "लाइव GPS ट्रैकिंग व रूट",
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w900,
            color: Color(0xFF1E293B),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: primaryColor),
            onPressed: _loadLocation,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: primaryColor))
          : ListView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              children: [
                // Live Route & Telemetry Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF0284C7), Color(0xFF0369A1)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: primaryColor.withValues(alpha: 0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
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
                            padding: const EdgeInsets.symmetric(
                                horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.sensors_rounded,
                                    color: Colors.white, size: 14),
                                SizedBox(width: 4),
                                Text(
                                  "लाइव सैटेलाइट GPS",
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            "ETA: ~$etaMinutes मिनट",
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        "${_booking['pickup']} ➔ ${_booking['drop']}",
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "गाड़ी: ${_booking['vehicleNo'] ?? 'MH-15-AB-1234'} • ${_booking['vehicleType']}",
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.9),
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _buildTelemetryItem(
                            label: "गति (Speed)",
                            value: "${speed.toStringAsFixed(0)} km/h",
                            icon: Icons.speed_rounded,
                          ),
                          _buildTelemetryItem(
                            label: "दूरी",
                            value: "${_booking['distanceKm']} km",
                            icon: Icons.straighten_rounded,
                          ),
                          _buildTelemetryItem(
                            label: "चालक",
                            value: "${_booking['driverName'] ?? 'कैलाश'} ",
                            icon: Icons.person_pin_rounded,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Quick TMS Shortcuts: Digital Bilty & Dharam Kanta
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => widget.state.openBilty(_booking),
                        icon: const Icon(Icons.receipt_long_rounded, size: 18),
                        label: const Text("ई-बिल्टी देखें",
                            style: TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w800)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: primaryColor,
                          side: const BorderSide(color: primaryColor),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => _openWeighbridgeSheet(context),
                        icon: const Icon(Icons.scale_rounded, size: 18),
                        label: const Text("धर्मकांटा पर्ची",
                            style: TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w800)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // Waypoint Progress Stepper
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            "ट्रिप प्रोग्रेस व चेकपॉइंट्स:",
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                          Text(
                            "लाइव अपडेट्स",
                            style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: Colors.green.shade700),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      ..._allWaypoints.map((wp) {
                        final isPassed = _isWaypointCompleted(
                            wp['key']!, currentWaypoint);
                        final isCurrent = wp['key'] == currentWaypoint;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Column(
                                children: [
                                  Container(
                                    width: 28,
                                    height: 28,
                                    decoration: BoxDecoration(
                                      color: isPassed
                                          ? const Color(0xFF16A34A)
                                          : (isCurrent
                                              ? primaryColor
                                              : const Color(0xFFE2E8F0)),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(
                                      isPassed
                                          ? Icons.check_rounded
                                          : (isCurrent
                                              ? Icons.navigation_rounded
                                              : Icons.circle),
                                      size: 14,
                                      color: isPassed || isCurrent
                                          ? Colors.white
                                          : Colors.grey,
                                    ),
                                  ),
                                  if (wp != _allWaypoints.last)
                                    Container(
                                      width: 2,
                                      height: 24,
                                      color: isPassed
                                          ? const Color(0xFF16A34A)
                                          : const Color(0xFFE2E8F0),
                                    ),
                                ],
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          wp['title']!,
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w800,
                                            color: isCurrent
                                                ? primaryColor
                                                : const Color(0xFF1E293B),
                                          ),
                                        ),
                                        if (isCurrent)
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 7, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFE0F2FE),
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                            child: const Text(
                                              "सक्रिय पॉइंट",
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w800,
                                                color: Color(0xFF0284C7),
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                    Text(
                                      wp['subtitle']!,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: Colors.grey.shade600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Transporter Advance Checkpoint Button
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFBBF7D0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "चालक / ट्रांसपोर्टर चेक-इन (Quick Update):",
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF166534)),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _buildActionChip("खेत पर पहुंचे", "at_pickup"),
                          _buildActionChip("धर्मकांटा वजन", "weighbridge"),
                          _buildActionChip("हाईवे ट्रांजिट", "in_transit"),
                          _buildActionChip("मंडी गेट", "mandi_gate"),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildActionChip(String label, String key) {
    return ActionChip(
      label: Text(label,
          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
      backgroundColor: Colors.white,
      side: const BorderSide(color: Color(0xFF16A34A)),
      onPressed: () => _advanceWaypoint(key, label),
    );
  }

  bool _isWaypointCompleted(String key, String current) {
    const order = [
      'accepted',
      'at_pickup',
      'weighbridge',
      'in_transit',
      'mandi_gate',
      'delivered'
    ];
    final targetIdx = order.indexOf(key);
    final currentIdx = order.indexOf(current);
    return targetIdx < currentIdx;
  }

  Widget _buildTelemetryItem({
    required String label,
    required String value,
    required IconData icon,
  }) {
    return Column(
      children: [
        Icon(icon, color: Colors.white.withValues(alpha: 0.9), size: 18),
        const SizedBox(height: 3),
        Text(value,
            style: const TextStyle(
                color: Colors.white, fontSize: 13, fontWeight: FontWeight.w900)),
        Text(label,
            style: TextStyle(
                color: Colors.white.withValues(alpha: 0.75), fontSize: 10)),
      ],
    );
  }

  void _openWeighbridgeSheet(BuildContext context) {
    final slipCtrl = TextEditingController(text: "DK-9842");
    final tareCtrl = TextEditingController(text: "1420");
    final grossCtrl = TextEditingController(text: "4680");

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 18,
          right: 18,
          top: 18,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 18,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "धर्मकांटा वजन पर्ची दर्ज करें",
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: slipCtrl,
              decoration: const InputDecoration(
                labelText: "पर्ची नंबर (Slip No.)",
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: tareCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: "खाली गाड़ी वजन (Tare kg)",
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: grossCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: "भरी गाड़ी वजन (Gross kg)",
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ElevatedButton(
              onPressed: () async {
                final tare = double.tryParse(tareCtrl.text.trim()) ?? 0;
                final gross = double.tryParse(grossCtrl.text.trim()) ?? 0;
                try {
                  await _api.recordWeighbridge(
                    _id,
                    slipNo: slipCtrl.text.trim(),
                    tareWeightKg: tare,
                    grossWeightKg: gross,
                    netWeightKg: gross - tare,
                  );
                  if (ctx.mounted) Navigator.pop(ctx);
                  widget.state.showToast("धर्मकांटा वजन पर्ची सहेजी गई ✅");
                  _loadLocation();
                } catch (_) {}
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 48),
              ),
              child: const Text("पर्ची सहेजें",
                  style: TextStyle(fontWeight: FontWeight.w900)),
            ),
          ],
        ),
      ),
    );
  }
}
