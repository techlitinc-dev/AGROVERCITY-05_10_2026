// Module G: Water Intelligence (API-wired port) — /v1/water/*.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/water_api.dart';
import '../components/common/audio_button.dart';
import '../components/common/glass_card.dart';
import '../state/app_state.dart';
import 'water_widgets.dart';

class WaterView extends StatefulWidget {
  final AppState state;
  final WaterApi? waterApi;

  const WaterView({super.key, required this.state, this.waterApi});

  @override
  State<WaterView> createState() => _WaterViewState();
}

class _WaterViewState extends State<WaterView> {
  late final WaterApi _api = widget.waterApi ?? WaterApi();

  List<Map<String, dynamic>> _schedule = const [];
  Map<String, dynamic>? _groundwater;
  List<Map<String, dynamic>> _canals = const [];

  bool _dripActive = false;
  double _acresDrip = 2.0;
  double _totalCost = 170000;
  double _subsidyAmount = 93500;
  double _farmerShare = 76500;

  static final _inr = NumberFormat.decimalPattern('en_IN');

  static const Map<String, Color> _zoneColors = {
    'safe': Color(0xFF43A047),
    'semiCritical': Color(0xFFF59E0B),
    'critical': Color(0xFFE53935),
  };

  String _zoneLabel(String zone) => switch (zone) {
        'safe' => widget.state.tr('water.zoneSafe'),
        'semiCritical' => widget.state.tr('water.zoneSemiCritical'),
        'critical' => widget.state.tr('water.zoneCritical'),
        _ => zone,
      };

  @override
  void initState() {
    super.initState();
    _load();
  }

  String get _district =>
      (widget.state.currentUser?['district'] as String?) ??
      widget.state.profile.district;

  Future<void> _load() async {
    try {
      final schedule = await _api.getSchedule();
      if (mounted) setState(() => _schedule = schedule);
    } catch (_) {}
    try {
      final gw = await _api.getGroundwater(_district);
      if (mounted) setState(() => _groundwater = gw);
    } catch (_) {}
    try {
      final canals = await _api.getCanalRotation();
      if (mounted) setState(() => _canals = canals);
    } catch (_) {}
    _recalcPmksy(_acresDrip);
  }

  Future<void> _recalcPmksy(double acres) async {
    try {
      final res = await _api.pmksyCalc(acres);
      if (!mounted) return;
      setState(() {
        _totalCost = (res['totalCost'] as num?)?.toDouble() ??
            _localCost(acres);
        _subsidyAmount = (res['subsidyAmount'] as num?)?.toDouble() ??
            _localCost(acres) * 0.55;
        _farmerShare = (res['farmerShare'] as num?)?.toDouble() ??
            _localCost(acres) - _subsidyAmount;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _totalCost = _localCost(acres);
        _subsidyAmount = _totalCost * 0.55;
        _farmerShare = _totalCost - _subsidyAmount;
      });
    }
  }

  double _localCost(double acres) => acres * 85000;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.state.tr('water.title'),
                      style: const TextStyle(
                          fontSize: 20, fontWeight: FontWeight.w800)),
                  Text(widget.state.tr('water.subtitle'),
                      style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              AudioButton(
                  text: widget.state
                      .tr('water.audioBrief')
                      .replaceAll('{plot}', 'A')
                      .replaceAll('{crop}', 'टमाटर')
                      .replaceAll('{time}', 'शाम 5:30 बजे')),
            ],
          ),
          const SizedBox(height: 14),
          if (_schedule.isEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Text(
                widget.state.tr('water.scheduleEmpty'),
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            )
          else
            ..._schedule.map((e) => _plotCard(e)),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _groundwaterCard()),
              const SizedBox(width: 10),
              Expanded(child: _canalCard()),
            ],
          ),
          const SizedBox(height: 14),
          _pmksyCard(),
        ],
      ),
    );
  }

  Widget _plotCard(Map<String, dynamic> e) {
    return WaterPlotCard(
      entry: e,
      state: widget.state,
      dripActive: _dripActive,
      onStartDrip: (minutes) {
        setState(() => _dripActive = true);
        widget.state.showToast(widget.state
            .tr('water.dripTimerStarted')
            .replaceAll('{minutes}', '$minutes'));
      },
    );
  }

  Widget _groundwaterCard() {
    final gw = _groundwater;
    final depth = (gw?['depthMeters'] as num?)?.toDouble();
    final zone = gw?['zone'] as String? ?? 'safe';
    final color = _zoneColors[zone] ?? _zoneColors['safe']!;
    return GlassCard(
      child: Column(
        children: [
          Text(widget.state.tr('water.groundwaterTitle'),
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey)),
          const SizedBox(height: 4),
          Text(depth != null ? "$depth m" : "-- m",
              style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0369A1))),
          Text(_zoneLabel(zone),
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: color)),
        ],
      ),
    );
  }

  Widget _canalCard() {
    if (_canals.isEmpty) {
      return GlassCard(
        child: Column(
          children: [
            Text(widget.state.tr('water.canalRotation'),
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Colors.grey)),
            const SizedBox(height: 4),
            const Text("--",
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1B4332))),
          ],
        ),
      );
    }
    final c = _canals.first;
    return GlassCard(
      child: Column(
        children: [
          Text(c['canalName'] as String? ?? widget.state.tr('water.canalRotation'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey)),
          const SizedBox(height: 4),
          Text(c['nextDate'] as String? ?? '--',
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1B4332))),
          Text(c['slotTime'] as String? ?? '',
              style:
                  const TextStyle(fontSize: 10.5, color: Colors.black54)),
        ],
      ),
    );
  }

  Widget _pmksyCard() {
    return GlassCard(
      backgroundColor: const Color(0xFFF0FDF4),
      border: Border.all(color: const Color(0xFF86EFAC)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.state.tr('water.pmksyCalculator'),
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF14532D))),
          const SizedBox(height: 10),
          Text(
              '${widget.state.tr('water.area')}: ${_acresDrip.toStringAsFixed(1)} ${widget.state.tr('acresUnit')}',
              style: const TextStyle(
                  fontSize: 12.5, fontWeight: FontWeight.w700)),
          Slider(
            min: 0.5,
            max: 10.0,
            divisions: 19,
            value: _acresDrip,
            activeColor: const Color(0xFF16A34A),
            onChanged: (v) => setState(() => _acresDrip = v),
            onChangeEnd: _recalcPmksy,
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${widget.state.tr('water.cost')}: ₹${_inr.format(_totalCost)}',
                  style: const TextStyle(fontSize: 11.5)),
              Text(
                  widget.state
                      .tr('water.subsidyLabel')
                      .replaceAll('{amount}', _inr.format(_subsidyAmount)),
                  style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFF16A34A),
                      fontWeight: FontWeight.w700)),
            ],
          ),
          const Divider(),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(widget.state.tr('water.farmerNetShare'),
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 13)),
              Text("₹${_inr.format(_farmerShare)}",
                  style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                      color: Color(0xFF1B4332))),
            ],
          ),
        ],
      ),
    );
  }
}
