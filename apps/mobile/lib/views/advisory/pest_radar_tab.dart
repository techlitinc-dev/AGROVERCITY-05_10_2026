// Pest radar tab — GET /advisory/pest-radar around the farm centroid.

import 'package:flutter/material.dart';

import '../../../api/advisory_api.dart';
import '../../../models/advisory_models.dart';
import '../../../state/app_state.dart';
import '../../../components/common/glass_card.dart';
import 'advisory_shared.dart';

class PestRadarTab extends StatefulWidget {
  const PestRadarTab({super.key, required this.state, required this.api});

  final AppState state;
  final AdvisoryApi api;

  @override
  State<PestRadarTab> createState() => _PestRadarTabState();
}

class _PestRadarTabState extends State<PestRadarTab> {
  bool _loading = true;
  bool _error = false;
  List<PestRadarItem> _items = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    final (lat, lng) = farmCentroid(widget.state);
    try {
      final items = await widget.api.getPestRadar(lat: lat, lng: lng);
      if (!mounted) return;
      setState(() {
        _items = items;
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

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      backgroundColor: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.state.tr('advisory.pestRadarTitle'),
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          if (_loading)
            const AdvisoryLoading()
          else if (_error)
            AdvisoryAsyncError(state: widget.state, onRetry: _load)
          else if (_items.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 18),
              child: Center(
                child: Text(widget.state.tr('noDataAvailable'),
                    style: const TextStyle(fontSize: 13, color: Colors.grey)),
              ),
            )
          else
            for (var i = 0; i < _items.length; i++) ...[
              if (i > 0) const Divider(),
              _buildItem(_items[i]),
            ],
        ],
      ),
    );
  }

  Widget _buildItem(PestRadarItem item) {
    final color = riskColor(item.riskLevel);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${item.disease} • ${item.crop}',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                Text(
                  widget.state
                      .tr('advisory.radarDistance')
                      .replaceAll('{distance}', '${item.distanceKm}'),
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8)),
            child: Text(riskLabel(widget.state, item.riskLevel),
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color)),
          ),
        ],
      ),
    );
  }
}
