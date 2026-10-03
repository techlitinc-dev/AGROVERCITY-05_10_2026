// Market saturation tab — POST /advisory/saturation with the selected crop.

import 'package:flutter/material.dart';

import '../../../api/advisory_api.dart';
import '../../../models/advisory_models.dart';
import '../../../state/app_state.dart';
import '../../../components/common/glass_card.dart';
import 'advisory_shared.dart';

class SaturationTab extends StatefulWidget {
  const SaturationTab({super.key, required this.state, required this.api});

  final AppState state;
  final AdvisoryApi api;

  @override
  State<SaturationTab> createState() => _SaturationTabState();
}

class _SaturationTabState extends State<SaturationTab> {
  late String _crop = _cropChoices.isNotEmpty ? _cropChoices.first : '';
  final _cropCtrl = TextEditingController();
  bool _loading = false;
  bool _error = false;
  SaturationAdvisory? _result;

  List<String> get _cropChoices => widget.state.profile.activeCrops;

  @override
  void dispose() {
    _cropCtrl.dispose();
    super.dispose();
  }

  String get _cropName {
    final raw = _cropChoices.isNotEmpty ? _crop : _cropCtrl.text.trim();
    return raw.split('(').first.trim();
  }

  bool get _canCheck =>
      !_loading && widget.state.profile.district.isNotEmpty && _cropName.isNotEmpty;

  Future<void> _check() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    final (lat, lng) = farmCentroid(widget.state);
    try {
      final res = await widget.api.checkSaturation(
        crop: _cropName,
        district: widget.state.profile.district,
        lat: lat,
        lng: lng,
      );
      if (!mounted) return;
      setState(() {
        _result = res;
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

  String _formatPrice(double price) =>
      price == price.roundToDouble() ? '${price.toInt()}' : '$price';

  @override
  Widget build(BuildContext context) {
    final district = widget.state.profile.district;
    if (district.isEmpty) {
      return GlassCard(
        backgroundColor: Colors.white,
        child: Row(
          children: [
            const Icon(Icons.info_outline_rounded, color: Color(0xFF0284C7)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                widget.state.tr('advisory.setDistrictHint'),
                style: const TextStyle(fontSize: 12.5, color: Color(0xFF263238)),
              ),
            ),
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GlassCard(
          backgroundColor: Colors.white,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.state.tr('trade.cropLabel'),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              if (_cropChoices.isNotEmpty)
                DropdownButton<String>(
                  value: _crop.isEmpty ? null : _crop,
                  isExpanded: true,
                  underline: const SizedBox.shrink(),
                  items: [
                    for (final c in _cropChoices)
                      DropdownMenuItem(
                          value: c, child: Text(c, style: const TextStyle(fontSize: 13))),
                  ],
                  onChanged: (v) => setState(() => _crop = v ?? _crop),
                )
              else
                TextField(
                  controller: _cropCtrl,
                  decoration: const InputDecoration(
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _canCheck ? _check : null,
                  icon: _loading
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.analytics_rounded, size: 16),
                  label: Text(widget.state.tr('advisory.checkSaturation'),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF43A047),
                      foregroundColor: Colors.white),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (_loading)
          const AdvisoryLoading()
        else if (_error)
          AdvisoryAsyncError(state: widget.state, onRetry: _check)
        else if (_result != null)
          _buildResult(_result!),
      ],
    );
  }

  Widget _buildResult(SaturationAdvisory r) {
    final color = riskColor(r.riskLevel);
    return GlassCard(
      backgroundColor: Colors.white,
      border: Border.all(color: color.withValues(alpha: 0.6), width: 1.5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(widget.state.tr('advisory.saturationTitle'),
                    style: const TextStyle(
                        fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8)),
                child: Text(riskLabel(widget.state, r.riskLevel),
                    style: TextStyle(
                        fontSize: 10.5, fontWeight: FontWeight.w900, color: color)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            widget.state
                .tr('advisory.farmersSown')
                .replaceAll('{count}', '${r.sowingCount}')
                .replaceAll('{crop}', _cropName)
                .replaceAll('{radiusKm}', '${r.radiusKm}'),
            style: const TextStyle(fontSize: 12.5, color: Colors.black87),
          ),
          const SizedBox(height: 4),
          Text(
            widget.state
                .tr('advisory.arrivalIncrease')
                .replaceAll('{increase}', r.expectedArrivalIncrease),
            style: const TextStyle(fontSize: 12.5, color: Colors.black87),
          ),
          const SizedBox(height: 4),
          Text(
            widget.state
                .tr('advisory.predictedPrice')
                .replaceAll('{price}', '${r.predictedPrice}')
                .replaceAll('{date}', r.predictedDate),
            style: TextStyle(
                fontSize: 12.5, fontWeight: FontWeight.w800, color: color),
          ),
          if (r.alternativeCrops.isNotEmpty) ...[
            const Divider(height: 18),
            Text(widget.state.tr('advisory.alternativeCrops'),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            for (final a in r.alternativeCrops)
              Text(
                  '• ${a.crop} — ₹${_formatPrice(a.expectedPrice)}',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF1B5E20))),
          ],
        ],
      ),
    );
  }
}
