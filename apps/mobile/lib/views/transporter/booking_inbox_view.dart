import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../api/api_exception.dart';
import '../../api/transport_api.dart';
import '../../state/app_state.dart';
import 'booking_request_actions.dart';

class BookingInboxView extends StatefulWidget {
  final AppState state;
  final TransportApi? transportApi;
  const BookingInboxView({super.key, required this.state, this.transportApi});

  @override
  State<BookingInboxView> createState() => _BookingInboxViewState();
}

class _BookingInboxViewState extends State<BookingInboxView> {
  late final TransportApi _api = widget.transportApi ?? TransportApi();

  bool _loading = true;
  List<Map<String, dynamic>> _requests = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.getBookings(status: 'requested');
      if (!mounted) return;
      setState(() {
        _requests = (res['data'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _requests = const [];
        _loading = false;
      });
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  void _handleError(ApiException e) {
    _snack(e.message.isNotEmpty ? e.message : e.code);
    if (e.code == 'ILLEGAL_TRANSITION') _load();
  }

  Future<void> _openAcceptSheet(Map<String, dynamic> booking) async {
    var vehicles = <Map<String, dynamic>>[];
    try {
      final res = await _api.getMyVehicles(verifiedOnly: true);
      vehicles = (res['data'] as List).cast<Map<String, dynamic>>();
    } catch (_) {}
    if (!mounted) return;

    final vehicle = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => AcceptVehicleSheet(
        vehicles: vehicles,
        onManageVehicles: () {
          Navigator.pop(ctx);
          widget.state.navigateTo('vehicleManage');
        },
      ),
    );
    if (vehicle == null) return;
    try {
      await _api.acceptBooking(
        "${booking['id']}",
        vehicleId: "${vehicle['id']}",
        vehicleNo: vehicle['registrationNo'] as String?,
      );
      _snack("बुकिंग स्वीकृत");
      _load();
    } on ApiException catch (e) {
      _handleError(e);
    }
  }

  Future<void> _openRejectDialog(Map<String, dynamic> booking) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => const RejectReasonDialog(),
    );
    if (reason == null) return;
    try {
      await _api.rejectBooking("${booking['id']}", reason);
      _snack("बुकिंग अस्वीकृत");
      _load();
    } on ApiException catch (e) {
      _handleError(e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        color: const Color(0xFF0284C7),
        onRefresh: _load,
        child: ListView(
          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          children: [
            Row(
              children: [
                IconButton(
                  onPressed: widget.state.navigateBack,
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
                const Text("बुकिंग अनुरोध", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
              ],
            ),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_requests.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 40),
                child: Center(child: Text("कोई लंबित अनुरोध नहीं", style: TextStyle(fontSize: 13, color: Colors.grey))),
              )
            else
              ..._requests.map(_buildRequestCard),
          ],
        ),
      ),
    );
  }

  Widget _buildRequestCard(Map<String, dynamic> b) {
    final lot = b['lot'] as Map<String, dynamic>?;
    final fare = (b['fare'] as num?) ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  "${b['pickup']} ➔ ${b['drop']}",
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                ),
              ),
              Text(
                "₹${NumberFormat.decimalPattern('en_IN').format(fare)}",
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0284C7)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            "${b['date']} • ${b['distanceKm']} km • ${b['vehicleType']}",
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
          ),
          if (lot != null)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFD8F3DC),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                "लॉट: ${lot['crop']} — ${lot['quantityQuintals']} क्विंटल",
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF166534)),
              ),
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _openAcceptSheet(b),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7), foregroundColor: Colors.white, minimumSize: const Size(0, 48)),
                  child: const Text("स्वीकारें", style: TextStyle(fontWeight: FontWeight.w900)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _openRejectDialog(b),
                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
                  child: const Text("अस्वीकारें", style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFDC2626))),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
