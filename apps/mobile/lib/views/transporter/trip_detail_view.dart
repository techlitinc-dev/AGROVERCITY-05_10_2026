import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/transport_api.dart';
import '../../core/photo_upload.dart';
import '../../state/app_state.dart';
import '../profile_home/transport_home_widgets.dart';
import 'pod_section.dart';
import 'trip_expenses_sheet.dart';

class TripDetailView extends StatefulWidget {
  final AppState state;
  final TransportApi? transportApi;
  final PhotoUploader? photoUploader;
  const TripDetailView({
    super.key,
    required this.state,
    this.transportApi,
    this.photoUploader,
  });

  @override
  State<TripDetailView> createState() => _TripDetailViewState();
}

class _TripDetailViewState extends State<TripDetailView> {
  late final TransportApi _api = widget.transportApi ?? TransportApi();
  late final PhotoUploader _uploader =
      widget.photoUploader ?? const PhotoUploader();

  late final Map<String, dynamic> _booking =
      Map<String, dynamic>.from(widget.state.selectedTrip ?? const {});
  List<Map<String, dynamic>> _vehicles = [];
  String? _selectedVehicleId;
  bool _busy = false;
  String? _actionError;
  bool _podOpen = false;

  String get _id => "${_booking['id']}";
  String get _status => "${_booking['status']}";

  @override
  void initState() {
    super.initState();
    if (_status == 'requested') _loadVehicles();
  }

  Future<void> _loadVehicles() async {
    try {
      final res = await _api.getMyVehicles();
      if (!mounted) return;
      setState(() {
        _vehicles = (res['data'] as List).cast<Map<String, dynamic>>();
        if (_vehicles.isNotEmpty) {
          _selectedVehicleId = "${_vehicles.first['id']}";
        }
      });
    } catch (_) {}
  }

  Future<void> _run(Future<Map<String, dynamic>> Function() call,
      {String? toast}) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _actionError = null;
    });
    try {
      await call();
      if (!mounted) return;
      if (toast != null) widget.state.showToast(toast);
      widget.state.navigateBack();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _actionError = e.message.isNotEmpty ? e.message : e.code);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _accept() async {
    final vehicle = _vehicles.firstWhere(
      (v) => "${v['id']}" == _selectedVehicleId,
      orElse: () => const {},
    );
    await _run(
      () => _api.updateBooking(
        _id,
        'accepted',
        vehicleId: _selectedVehicleId,
        vehicleNo: vehicle['registrationNo'] as String?,
      ),
      toast: widget.state.tr('transporter.tripAccepted'),
    );
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(0xFF0284C7);
    final lot = _booking['lot'] as Map<String, dynamic>?;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        children: [
          Row(
            children: [
              IconButton(
                onPressed: widget.state.navigateBack,
                icon: const Icon(Icons.arrow_back_rounded),
              ),
              Text(widget.state.tr('transporter.tripDetails'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            ],
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _row(widget.state.tr('transporter.vehicleType'), "${_booking['vehicleType']}"),
                _row(widget.state.tr('transporter.vehicleNo'), "${_booking['vehicleNo'] ?? '—'}"),
                _row(widget.state.tr('transporter.route'), "${_booking['pickup']} ➔ ${_booking['drop']}"),
                _row(widget.state.tr('transporter.distance'), "${_booking['distanceKm']} km"),
                _row(widget.state.tr('transporter.date'), "${_booking['date']}"),
                _row(widget.state.tr('transporter.fare'), "₹${formatRupees((_booking['fare'] as num?) ?? 0)}"),
                _row(widget.state.tr('transporter.status'), tripStatusChip(_status)),
                if (lot != null) ...[
                  const Divider(height: 18),
                  Text(
                    widget.state
                        .tr('transporter.lotRateLine')
                        .replaceAll('{crop}', "${lot['crop']}")
                        .replaceAll('{qty}', "${lot['quantityQuintals']}")
                        .replaceAll('{rate}', "${lot['expectedRate']}"),
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF166534)),
                  ),
                ],
              ],
            ),
          ),
          if (_status == 'accepted' || _status == 'enRoute' || _status == 'delivered') ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => widget.state.openLiveTracking(_booking),
                    icon: const Icon(Icons.navigation_rounded, size: 16),
                    label: const Text("ट्रैकिंग", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: primary,
                      side: const BorderSide(color: primary),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => widget.state.openBilty(_booking),
                    icon: const Icon(Icons.receipt_long_rounded, size: 16),
                    label: const Text("ई-बिल्टी", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: primary,
                      side: const BorderSide(color: primary),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.white,
                        shape: const RoundedRectangleBorder(
                          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                        ),
                        builder: (_) => TripExpensesSheet(
                          state: widget.state,
                          bookingId: _id,
                          grossFare: ((_booking['fare'] as num?)?.toDouble()) ?? 0.0,
                          api: _api,
                        ),
                      );
                    },
                    icon: const Icon(Icons.monetization_on_rounded, size: 16),
                    label: const Text("खर्च व नफा", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF16A34A),
                      side: const BorderSide(color: Color(0xFF16A34A)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          if (_actionError != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                _actionError!,
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFFDC2626)),
              ),
            ),
          if (_status == 'requested') ...[
            DropdownButtonFormField<String>(
              initialValue: _selectedVehicleId,
              decoration: InputDecoration(labelText: widget.state.tr('transporter.selectVehicle'), border: const OutlineInputBorder()),
              items: _vehicles
                  .map(
                    (v) => DropdownMenuItem(
                      value: "${v['id']}",
                      child: Text("${v['registrationNo']} (${v['vehicleType']})", style: const TextStyle(fontSize: 12.5)),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _selectedVehicleId = v),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _busy || _selectedVehicleId == null ? null : _accept,
                    style: ElevatedButton.styleFrom(backgroundColor: primary, foregroundColor: Colors.white, minimumSize: const Size(0, 48)),
                    child: Text(widget.state.tr('transporter.accept'), style: const TextStyle(fontWeight: FontWeight.w900)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _run(() => _api.updateBooking(_id, 'cancelled'), toast: widget.state.tr('transporter.tripCancelled')),
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
                    child: Text(widget.state.tr('transporter.reject'), style: const TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ],
          if (_status == 'accepted') ...[
            ElevatedButton(
              onPressed: _busy ? null : () => _run(() => _api.updateBooking(_id, 'enRoute'), toast: "ट्रिप शुरू"),
              style: ElevatedButton.styleFrom(backgroundColor: primary, foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 48)),
              child: const Text("ट्रिप शुरू करें", style: TextStyle(fontWeight: FontWeight.w900)),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: _busy ? null : () => _run(() => _api.updateBooking(_id, 'cancelled'), toast: "ट्रिप रद्द"),
              style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
              child: const Text("रद्द करें", style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ],
          if (_status == 'enRoute') ...[
            ElevatedButton.icon(
              onPressed: _busy ? null : () => setState(() => _podOpen = !_podOpen),
              icon: const Icon(Icons.task_alt_rounded, size: 18),
              label: const Text("डिलीवरी पूर्ण करें", style: TextStyle(fontWeight: FontWeight.w900)),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A), foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 48)),
            ),
            if (_podOpen)
              PodSection(
                state: widget.state,
                bookingId: _id,
                api: _api,
                uploader: _uploader,
                onDelivered: () {
                  widget.state.showToast("डिलीवरी पूर्ण");
                  widget.state.navigateBack();
                },
                onError: (message) =>
                    setState(() => _actionError = message),
              ),
          ],
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          Flexible(
            child: Text(value, textAlign: TextAlign.right, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}
