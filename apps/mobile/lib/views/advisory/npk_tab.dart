// NPK fertilizer optimizer tab — POST /advisory/npk.

import 'package:flutter/material.dart';

import '../../../api/advisory_api.dart';
import '../../../models/advisory_models.dart';
import '../../../state/app_state.dart';
import '../../../components/common/glass_card.dart';
import 'advisory_shared.dart';

class NpkTab extends StatefulWidget {
  const NpkTab({super.key, required this.state, required this.api});

  final AppState state;
  final AdvisoryApi api;

  @override
  State<NpkTab> createState() => _NpkTabState();
}

class _NpkTabState extends State<NpkTab> {
  double _nitrogen = 140;
  double _phosphorus = 35;
  double _potassium = 160;
  final _cropCtrl = TextEditingController();
  final _soilCtrl = TextEditingController();
  bool _loading = false;
  bool _error = false;
  NpkRecommendation? _result;

  @override
  void initState() {
    super.initState();
    _soilCtrl.text = widget.state.profile.soilType;
  }

  @override
  void dispose() {
    _cropCtrl.dispose();
    _soilCtrl.dispose();
    super.dispose();
  }

  bool get _canCompute =>
      !_loading && _cropCtrl.text.trim().isNotEmpty && _soilCtrl.text.trim().isNotEmpty;

  Future<void> _compute() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final res = await widget.api.getNpkRecommendation(
        n: _nitrogen,
        p: _phosphorus,
        k: _potassium,
        crop: _cropCtrl.text.trim(),
        soilType: _soilCtrl.text.trim(),
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

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GlassCard(
          backgroundColor: Colors.white,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _cropCtrl,
                decoration: InputDecoration(
                  labelText: widget.state.tr('trade.cropLabel'),
                  isDense: true,
                  border: const OutlineInputBorder(),
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _soilCtrl,
                decoration: InputDecoration(
                  labelText: widget.state.tr('soilType'),
                  isDense: true,
                  border: const OutlineInputBorder(),
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              Text('N: ${_nitrogen.toInt()} kg/ha',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
              Slider(min: 80, max: 250, value: _nitrogen,
                  onChanged: (v) => setState(() => _nitrogen = v),
                  activeColor: const Color(0xFF43A047)),
              Text('P: ${_phosphorus.toInt()} kg/ha',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
              Slider(min: 15, max: 80, value: _phosphorus,
                  onChanged: (v) => setState(() => _phosphorus = v),
                  activeColor: const Color(0xFF43A047)),
              Text('K: ${_potassium.toInt()} kg/ha',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
              Slider(min: 100, max: 300, value: _potassium,
                  onChanged: (v) => setState(() => _potassium = v),
                  activeColor: const Color(0xFF43A047)),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _canCompute ? _compute : null,
                  icon: _loading
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.science_rounded, size: 16),
                  label: Text(widget.state.tr('advisory.computeNpk'),
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
          AdvisoryAsyncError(state: widget.state, onRetry: _compute)
        else if (_result != null)
          _buildResult(_result!),
      ],
    );
  }

  Widget _buildResult(NpkRecommendation r) {
    Widget stat(String label, double value) => Expanded(
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFE8F5E9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              children: [
                Text(label,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF2E7D32))),
                Text('$value',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1B5E20))),
              ],
            ),
          ),
        );
    return GlassCard(
      backgroundColor: Colors.white,
      border: Border.all(color: const Color(0xFF43A047), width: 1.5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.state.tr('advisory.npkResultTitle'),
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          Row(
            children: [
              stat(widget.state.tr('advisory.ureaPerAcre'), r.ureaKgPerAcre),
              const SizedBox(width: 8),
              stat(widget.state.tr('advisory.dapPerAcre'), r.dapKgPerAcre),
              const SizedBox(width: 8),
              stat(widget.state.tr('advisory.mopPerAcre'), r.mopKgPerAcre),
            ],
          ),
          if (r.recommendations.isNotEmpty) ...[
            const Divider(height: 18),
            for (final rec in r.recommendations)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text('• $rec',
                    style: const TextStyle(fontSize: 12, height: 1.35)),
              ),
          ],
        ],
      ),
    );
  }
}
