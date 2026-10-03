// Module J: Climate-Smart & Carbon Credits — API-wired port (Day 14 Task B1).
// Hero ← GET /v1/climate/carbon-potential; varieties ←
// GET /v1/climate/resilient-varieties with crop filter chips.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/climate_api.dart';
import '../components/common/audio_button.dart';
import '../components/common/glass_card.dart';
import '../models/climate_models.dart';
import '../state/app_state.dart';

final _inr = NumberFormat('#,##,##0', 'en_IN');

const _practiceKeys = {
  'biochar': 'climate.practiceBiochar',
  'zero-till': 'climate.practiceZeroTill',
  'green-manure': 'climate.practiceGreenManure',
};

const _cropFilters = {
  'climate.cropAll': null,
  'climate.cropRice': 'rice',
  'climate.cropWheat': 'wheat',
  'climate.cropBajra': 'bajra',
};

class ClimateCarbonView extends StatefulWidget {
  final AppState state;
  final ClimateApi? climateApi;

  const ClimateCarbonView({super.key, required this.state, this.climateApi});

  @override
  State<ClimateCarbonView> createState() => _ClimateCarbonViewState();
}

class _ClimateCarbonViewState extends State<ClimateCarbonView> {
  late final ClimateApi _api = widget.climateApi ?? ClimateApi();

  CarbonPotential? _potential;
  List<ResilientVariety> _varieties = const [];
  bool _loading = true;
  bool _error = false;
  String _cropFilter = 'climate.cropAll';

  @override
  void initState() {
    super.initState();
    _load();
  }

  (double?, double?) get _latLng {
    final points = widget.state.profile.farmBoundaryPoints;
    if (points.isEmpty) return (null, null);
    return (points.first['lat'], points.first['lng']);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final (lat, lng) = _latLng;
      final potential = await _api.carbonPotential(lat: lat, lng: lng);
      final varieties =
          await _api.resilientVarieties(crop: _cropFilters[_cropFilter]);
      if (!mounted) return;
      setState(() {
        _potential = potential;
        _varieties = varieties;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _selectCrop(String label) async {
    setState(() => _cropFilter = label);
    try {
      final varieties =
          await _api.resilientVarieties(crop: _cropFilters[label]);
      if (!mounted) return;
      setState(() => _varieties = varieties);
    } catch (_) {
      _snack(widget.state.tr('climate.loadFailed'));
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.state.tr('climate.title'),
                      style: const TextStyle(
                          fontSize: 20, fontWeight: FontWeight.w800)),
                  Text(widget.state.tr('climate.subtitle'),
                      style: const TextStyle(
                          fontSize: 12, color: Colors.grey)),
                ],
              ),
              AudioButton(text: widget.state.tr('climate.audioSummary')),
            ],
          ),
          const SizedBox(height: 14),

          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: CircularProgressIndicator(color: Color(0xFF047857)),
              ),
            )
          else if (_error)
            Center(
              child: Column(
                children: [
                  const SizedBox(height: 40),
                  Text(widget.state.tr('climate.loadFailed'),
                      style: const TextStyle(
                          color: Colors.grey, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  ElevatedButton(
                      onPressed: _load,
                      child: Text(widget.state.tr('retry'))),
                ],
              ),
            )
          else ...[
            // Carbon Credit Hero Box
            if (_potential != null) _heroCard(_potential!),
            const SizedBox(height: 14),

            // Resilient Varieties
            GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.state.tr('climate.resilientVarieties'),
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (final label in _cropFilters.keys)
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: FilterChip(
                              label: Text(widget.state.tr(label),
                                  style: const TextStyle(fontSize: 12)),
                              selected: _cropFilter == label,
                              onSelected: (_) => _selectCrop(label),
                              selectedColor: const Color(0xFFD1FAE5),
                              checkmarkColor: const Color(0xFF047857),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_varieties.isEmpty)
                    Text(widget.state.tr('climate.noVarietyAvailable'),
                        style: const TextStyle(
                            fontSize: 12, color: Colors.grey))
                  else
                    for (final v in _varieties) _varietyItem(v),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _heroCard(CarbonPotential p) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [
          Color(0xFF064E3B),
          Color(0xFF065F46),
          Color(0xFF047857),
        ]),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.state.tr('climate.carbonCreditPotential'),
              style: const TextStyle(
                  color: Color(0xFFE9C46A),
                  fontSize: 11,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(
              "₹${_inr.format(p.annualIncomePotential)} / ${widget.state.tr('climate.perYear')}",
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w900)),
          Text(
              "${p.co2eTonnes} MT CO2e ${widget.state.tr('climate.absorption')}",
              style:
                  const TextStyle(color: Color(0xFFA7F3D0), fontSize: 12)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              for (final practice in p.practices)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF6EE7B7)),
                  ),
                  child: Text(
                      widget.state
                          .tr(_practiceKeys[practice] ?? practice),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700)),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _varietyItem(ResilientVariety v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("${v.variety} (${v.crop})",
              style: const TextStyle(
                  fontSize: 12.5, fontWeight: FontWeight.w800)),
          Text(v.trait,
              style: const TextStyle(fontSize: 12, color: Colors.black87)),
          Text("${widget.state.tr('climate.source')}: ${v.source}",
              style: const TextStyle(fontSize: 10.5, color: Colors.grey)),
        ],
      ),
    );
  }
}
