import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../api/api_exception.dart';
import '../../api/mandi_api.dart';
import '../../api/transport_api.dart';
import '../../components/common/glass_card.dart';
import '../../state/app_state.dart';

class VehicleBookingTool extends StatefulWidget {
  const VehicleBookingTool({
    super.key,
    required this.state,
    required this.transportApi,
    required this.mandiApi,
  });

  final AppState state;
  final TransportApi transportApi;
  final MandiApi mandiApi;

  @override
  State<VehicleBookingTool> createState() => _VehicleBookingToolState();
}

class _VehicleBookingToolState extends State<VehicleBookingTool> {
  List<Map<String, dynamic>> _types = [];
  String? _selectedType;
  double _distanceKm = 20;
  Map<String, dynamic>? _estimate;
  bool _booking = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _loadTypes();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadTypes() async {
    try {
      final res = await widget.transportApi.getVehicleTypes();
      if (!mounted) return;
      setState(() {
        _types = (res['data'] as List).cast<Map<String, dynamic>>();
        if (_types.isNotEmpty) _selectedType = "${_types.first['type']}";
      });
      _fetchEstimate();
    } catch (_) {}
  }

  void _onDistanceChanged(double value) {
    setState(() => _distanceKm = value);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _fetchEstimate);
  }

  Future<void> _fetchEstimate() async {
    final type = _selectedType;
    if (type == null) return;
    try {
      final res = await widget.transportApi.fareEstimate(type, _distanceKm);
      if (!mounted) return;
      setState(() => _estimate = res);
    } catch (_) {}
  }

  String _fmt(num value) => NumberFormat.decimalPattern('en_IN').format(value);

  Future<String> _nearestMandiName() async {
    try {
      final res = await widget.mandiApi.getMandiList();
      final data = (res['data'] as List).cast<Map<String, dynamic>>();
      if (data.isNotEmpty) return "${data.first['name']}";
    } catch (_) {}
    return "${widget.state.profile.district} मंडी";
  }

  Future<void> _book() async {
    final type = _selectedType;
    if (type == null || _booking) return;
    setState(() => _booking = true);
    try {
      final tomorrow = DateTime.now().add(const Duration(days: 1));
      final date =
          "${tomorrow.year}-${tomorrow.month.toString().padLeft(2, '0')}-${tomorrow.day.toString().padLeft(2, '0')}";
      await widget.transportApi.createBooking(
        vehicleType: type,
        distanceKm: _distanceKm,
        pickup: widget.state.profile.village,
        drop: await _nearestMandiName(),
        date: date,
      );
      widget.state.showToast("बुकिंग भेजी गई");
    } on ApiException catch (e) {
      widget.state.showToast(e.message.isNotEmpty ? e.message : e.code);
    } finally {
      if (mounted) setState(() => _booking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("🚚 कृषि परिवहन वाहन बुकिंग", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _selectedType,
            decoration: const InputDecoration(labelText: "वाहन प्रकार", border: OutlineInputBorder()),
            items: _types
                .map(
                  (t) => DropdownMenuItem(
                    value: "${t['type']}",
                    child: Text(
                      "${t['type']} — ₹${_fmt(t['baseFare'] as num)} base + ₹${_fmt(t['perKmRate'] as num)}/km",
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                )
                .toList(),
            onChanged: (val) {
              setState(() => _selectedType = val);
              _fetchEstimate();
            },
          ),
          const SizedBox(height: 12),
          Text("दूरी: ${_distanceKm.toInt()} km", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          Slider(
            min: 1,
            max: 100,
            value: _distanceKm,
            onChanged: _onDistanceChanged,
            activeColor: const Color(0xFF1B4332),
          ),
          if (_estimate != null)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFD8F3DC), borderRadius: BorderRadius.circular(12)),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "Base ₹${_fmt(_estimate!['baseFare'] as num)} + Distance ₹${_fmt(_estimate!['distanceFare'] as num)}",
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF1B4332)),
                  ),
                  Text(
                    "₹${_fmt(_estimate!['totalFare'] as num)}",
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: Color(0xFF1B4332)),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: _booking ? null : _book,
            icon: const Icon(Icons.local_shipping_rounded, size: 16),
            label: Text(_booking ? "बुक हो रहा है..." : "अभी वाहन बुक करें", style: const TextStyle(fontWeight: FontWeight.w800)),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 44)),
          ),
        ],
      ),
    );
  }
}
