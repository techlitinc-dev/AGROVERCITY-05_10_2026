import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/transport_api.dart';
import '../../state/app_state.dart';

class VehicleCalendarView extends StatefulWidget {
  final AppState state;
  final TransportApi? transportApi;
  const VehicleCalendarView({
    super.key,
    required this.state,
    this.transportApi,
  });

  @override
  State<VehicleCalendarView> createState() => _VehicleCalendarViewState();
}

class _VehicleCalendarViewState extends State<VehicleCalendarView> {
  late final TransportApi _api = widget.transportApi ?? TransportApi();

  bool _loading = true;
  List<Map<String, dynamic>> _bookings = [];
  late final Set<String> _availableDates = {
    ...((widget.state.selectedVehicle?['availableDates'] as List?)
            ?.cast<String>() ??
        const <String>[]),
  };

  String get _vehicleId => "${widget.state.selectedVehicle?['id']}";

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _dateStr(DateTime d) =>
      "${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}";

  Future<void> _load() async {
    try {
      final res = await _api.getVehicleCalendar(_vehicleId);
      if (!mounted) return;
      setState(() {
        _bookings = (res['bookings'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _bookings = const [];
        _loading = false;
      });
    }
  }

  Future<void> _toggleAvailability(String date, bool available) async {
    setState(() {
      available ? _availableDates.add(date) : _availableDates.remove(date);
    });
    try {
      await _api.setAvailability(_vehicleId, _availableDates.toList()..sort());
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        available ? _availableDates.remove(date) : _availableDates.add(date);
      });
      widget.state.showToast(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  List<Map<String, dynamic>> _bookingsOn(String date) =>
      _bookings.where((b) => b['date'] == date).toList();

  @override
  Widget build(BuildContext context) {
    const primary = Color(0xFF0284C7);
    final vehicle = widget.state.selectedVehicle ?? const {};
    final today = DateTime.now();
    final days = List.generate(7, (i) => today.add(Duration(days: i)));

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
              Expanded(
                child: Text(
                  widget.state
                      .tr('transporter.calendarFor')
                      .replaceAll('{regNo}', "${vehicle['registrationNo'] ?? ''}"),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else
            ...days.map((d) => _buildDayCard(d, primary)),
        ],
      ),
    );
  }

  Widget _buildDayCard(DateTime day, Color primary) {
    final date = _dateStr(day);
    final dayBookings = _bookingsOn(date);
    final dayNames = [
      widget.state.tr('transporter.dayMon'),
      widget.state.tr('transporter.dayTue'),
      widget.state.tr('transporter.dayWed'),
      widget.state.tr('transporter.dayThu'),
      widget.state.tr('transporter.dayFri'),
      widget.state.tr('transporter.daySat'),
      widget.state.tr('transporter.daySun'),
    ];
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(
                    "${dayNames[day.weekday - 1]} ${day.day}/${day.month}",
                    style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                  ),
                  if (dayBookings.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(left: 8),
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(color: primary, shape: BoxShape.circle),
                    ),
                ],
              ),
              Row(
                children: [
                  Text(widget.state.tr('transporter.available'), style: const TextStyle(fontSize: 11, color: Colors.grey)),
                  Switch(
                    value: _availableDates.contains(date),
                    activeThumbColor: primary,
                    onChanged: (v) => _toggleAvailability(date, v),
                  ),
                ],
              ),
            ],
          ),
          ...dayBookings.map(
            (b) => Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                "${b['pickup']} ➔ ${b['drop']} (${b['status']})",
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: primary),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
