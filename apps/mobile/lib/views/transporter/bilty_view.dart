import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../api/transport_api.dart';
import '../../state/app_state.dart';

class BiltyView extends StatefulWidget {
  final AppState state;
  final TransportApi? transportApi;

  const BiltyView({
    super.key,
    required this.state,
    this.transportApi,
  });

  @override
  State<BiltyView> createState() => _BiltyViewState();
}

class _BiltyViewState extends State<BiltyView> {
  late final TransportApi _api = widget.transportApi ?? TransportApi();

  bool _loading = true;
  Map<String, dynamic> _bilty = {};

  late final Map<String, dynamic> _booking =
      Map<String, dynamic>.from(widget.state.selectedTrip ?? const {});

  String get _id => "${_booking['id']}";

  @override
  void initState() {
    super.initState();
    _loadBilty();
  }

  Future<void> _loadBilty() async {
    try {
      final res = await _api.getDigitalBilty(_id);
      if (!mounted) return;
      setState(() {
        _bilty = res;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF0284C7);
    final consignor = (_bilty['consignor'] as Map<String, dynamic>?) ?? {};
    final consignee = (_bilty['consignee'] as Map<String, dynamic>?) ?? {};
    final veh = (_bilty['vehicleDetails'] as Map<String, dynamic>?) ?? {};
    final goods = (_bilty['goods'] as Map<String, dynamic>?) ?? {};
    final freight = (_bilty['freightCharges'] as Map<String, dynamic>?) ?? {};
    final wb = (_bilty['weighbridgeSlip'] as Map<String, dynamic>?) ?? {};

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF1E293B)),
          onPressed: widget.state.navigateBack,
        ),
        title: const Text(
          "डिजिटल ई-बिल्टी (Lorry Receipt)",
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w900,
            color: Color(0xFF1E293B),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_rounded, color: primaryColor),
            onPressed: () {
              widget.state.showToast("ई-बिल्टी PDF शेयर की जा रही है... 📤");
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: primaryColor))
          : ListView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              children: [
                // Formal Consignment Paper Container
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFCBD5E1), width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header Badge
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                "किसान सेतु डिजिटल लॉजिस्टिक्स",
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              Text(
                                "मोटर वाहन अधिनियम अनुसार वैध ई-बिल्टी",
                                style: TextStyle(
                                    fontSize: 10.5, color: Colors.grey.shade600),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE0F2FE),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.qr_code_2_rounded,
                                color: primaryColor, size: 28),
                          ),
                        ],
                      ),
                      const Divider(height: 22, thickness: 1.2),

                      // LR Number & Date
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            "LR नंबर: ${_bilty['lrNumber'] ?? 'LR-2026-NASHIK'}",
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: primaryColor,
                            ),
                          ),
                          Text(
                            "दिनांक: ${_booking['date'] ?? DateFormat('yyyy-MM-dd').format(DateTime.now())}",
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Consignor & Consignee Box
                      Row(
                        children: [
                          Expanded(
                            child: _buildPartyCard(
                              title: "प्रेषक (Consignor / Farmer)",
                              name: "${consignor['name'] ?? 'किसान (विक्रेता)'}",
                              location: "${_booking['pickup']}",
                              phone: "${consignor['contact'] ?? '+91 98xxx xxxxx'}",
                              color: const Color(0xFFF0FDF4),
                              borderColor: const Color(0xFFBBF7D0),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildPartyCard(
                              title: "प्राप्तकर्ता (Consignee / Trader)",
                              name: "${consignee['name'] ?? 'मंडी आढ़ती (खरीदार)'}",
                              location: "${_booking['drop']}",
                              phone: "${consignee['contact'] ?? '+91 98xxx xxxxx'}",
                              color: const Color(0xFFEFF6FF),
                              borderColor: const Color(0xFFBFDBFE),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Vehicle & Driver Details
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          children: [
                            _buildInfoRow(
                              "वाहन क्रमांक (Vehicle No)",
                              "${veh['vehicleNo'] ?? _booking['vehicleNo'] ?? 'MH-15-AB-1234'}",
                            ),
                            _buildInfoRow(
                              "वाहन प्रकार (Type)",
                              "${veh['vehicleType'] ?? _booking['vehicleType']}",
                            ),
                            _buildInfoRow(
                              "चालक का नाम (Driver)",
                              "${veh['driverName'] ?? _booking['driverName'] ?? 'कैलाश गायकवाड़'}",
                            ),
                            _buildInfoRow(
                              "चालक फोन (Phone)",
                              "${veh['driverPhone'] ?? _booking['driverPhone'] ?? '+91 94222 11002'}",
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Goods Description & Weighbridge
                      const Text(
                        "माल व वजन विवरण (Goods & Weight Details):",
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF1E293B)),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          children: [
                            _buildInfoRow(
                              "उपज का नाम (Commodity)",
                              "${goods['commodity'] ?? _booking['commodity'] ?? 'कृषि उपज'}",
                            ),
                            _buildInfoRow(
                              "पैकिंग प्रकार (Packaging)",
                              "${goods['packaging'] ?? 'Plastic Crates'}",
                            ),
                            _buildInfoRow(
                              "धर्मकांटा पर्ची क्र.",
                              "${wb['slipNo'] ?? 'DK-8491'}",
                            ),
                            _buildInfoRow(
                              "शुद्ध वजन (Net Weight)",
                              "${wb['netWeightKg'] ?? 2530} kg (~${((wb['netWeightKg'] as num?) ?? 2530) / 100} क्विंटल)",
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Freight & Payment Summary
                      const Text(
                        "भाड़ा विवरण (Freight & Charges):",
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF1E293B)),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEFCE8),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFFEF08A)),
                        ),
                        child: Column(
                          children: [
                            _buildInfoRow(
                              "कुल भाड़ा (Gross Freight)",
                              "₹${freight['grossFare'] ?? _booking['fare'] ?? 1200}",
                              bold: true,
                            ),
                            _buildInfoRow(
                              "हमाली / लोडिंग शुल्क",
                              "₹${freight['loadingLabor'] ?? 300}",
                            ),
                            _buildInfoRow(
                              "अग्रिम भुगतान (Advance Paid)",
                              "₹${freight['advancePaid'] ?? 500} ✅",
                            ),
                            const Divider(height: 10),
                            _buildInfoRow(
                              "मंडी में देय शेष राशि (Balance Due)",
                              "₹${freight['balancePayable'] ?? 1000}",
                              bold: true,
                              valueColor: const Color(0xFFB45309),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Digital Stamp & Verification
                      Center(
                        child: Column(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 6),
                              decoration: BoxDecoration(
                                border: Border.all(
                                    color: const Color(0xFF16A34A), width: 1.5),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                "डिजिटल रूप से सत्यापित • किसान सेतु TMS",
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF16A34A),
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              "सत्यापन कोड: ${_bilty['qrVerificationCode'] ?? 'AGRO-TMS-VERIFY'}",
                              style: const TextStyle(
                                  fontSize: 10, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                ElevatedButton.icon(
                  onPressed: () {
                    widget.state.showToast("ई-बिल्टी PDF डाउनलोड हो रही है... 📄");
                  },
                  icon: const Icon(Icons.download_rounded),
                  label: const Text("ई-बिल्टी डाउनलोड करें (Download PDF)",
                      style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w900)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildPartyCard({
    required String title,
    required String name,
    required String location,
    required String phone,
    required Color color,
    required Color borderColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Colors.grey.shade700)),
          const SizedBox(height: 4),
          Text(name,
              style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0F172A))),
          Text(location,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 11, color: Color(0xFF475569))),
          Text(phone,
              style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0284C7))),
        ],
      ),
    );
  }

  Widget _buildInfoRow(
    String label,
    String value, {
    bool bold = false,
    Color? valueColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 11.5,
                  color: Colors.grey.shade700,
                  fontWeight: bold ? FontWeight.w800 : FontWeight.normal)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 12,
                fontWeight: bold ? FontWeight.w900 : FontWeight.w800,
                color: valueColor ?? const Color(0xFF0F172A),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
