// Day 9 Task B4 — Landlord plot management (मेरे प्लॉट), wired to /v1/land/plots.

import 'package:flutter/material.dart';
import '../../api/api_exception.dart';
import '../../api/land_api.dart';
import '../../models/land_models.dart';
import '../../state/app_state.dart';
import 'landlord_form_sheets.dart';

class PlotManageView extends StatefulWidget {
  final AppState state;
  final LandApi? landApi;
  const PlotManageView({super.key, required this.state, this.landApi});

  @override
  State<PlotManageView> createState() => _PlotManageViewState();
}

class _PlotManageViewState extends State<PlotManageView> {
  late final LandApi _api = widget.landApi ?? LandApi();

  List<LandPlot> _plots = [];
  bool _loading = true;
  bool _error = false;

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
    try {
      final plots = await _api.listPlots();
      if (!mounted) return;
      setState(() {
        _plots = plots;
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
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _addPlot() async {
    final result = await showPlotFormSheet(context, lang: widget.state.language);
    if (result == null || !mounted) return;
    try {
      await _api.createPlot(
        name: result.name,
        village: result.village,
        district: result.district,
        areaAcres: result.areaAcres,
        gatNumber: result.gatNumber,
        soilType: result.soilType,
      );
      _snack(widget.state.tr('landlord.plotAdded'));
      _load();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  Future<void> _confirmDelete(LandPlot plot) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(widget.state.tr('landlord.deletePlotConfirm'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Text("${plot.name} • ${plot.village}"),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(widget.state.tr('back'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(widget.state.tr('deleteK')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await _api.deletePlot(plot.id);
      _snack(widget.state.tr('landlord.plotDeleted'));
      _load();
    } on ApiException catch (e) {
      if (e.code == 'PLOT_HAS_ACTIVE_LEASE') {
        _snack(widget.state.tr('landlord.activeLeaseExists'));
      } else {
        _snack(e.message.isNotEmpty ? e.message : e.code);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.state.tr('landlord.myPlots'),
            style: const TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: const Color(0xFF8B5CF6),
        foregroundColor: Colors.white,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addPlot,
        backgroundColor: const Color(0xFF8B5CF6),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: Text(widget.state.tr('landlord.newPlotFab'), style: const TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF43A047)))
          : _error
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(widget.state.tr('landlord.dataLoadFailed'),
                          style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      ElevatedButton(
                          onPressed: _load, child: Text(widget.state.tr('retry'))),
                    ],
                  ),
                )
              : _plots.isEmpty
                  ? const Center(
                      child: Text("कोई प्लॉट नहीं — + नया प्लॉट से जोड़ें",
                          style: TextStyle(color: Colors.grey)))
                  : ListView.builder(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
                      itemCount: _plots.length,
                      itemBuilder: (_, i) => _plotCard(_plots[i]),
                    ),
    );
  }

  Widget _plotCard(LandPlot plot) {
    final leased = plot.status == 'leased';
    return GestureDetector(
      onLongPress: () => _confirmDelete(plot),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.landscape_rounded,
                  color: Color(0xFF8B5CF6), size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(plot.name,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF1E293B))),
                  Text(
                    "${plot.village}, ${plot.district} • ${plot.areaAcres} एकड़",
                    style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
                  ),
                  if (plot.gatNumber != null)
                    Text("गट: ${plot.gatNumber}",
                        style: TextStyle(fontSize: 10.5, color: Colors.grey.shade500)),
                  if (plot.soilType != null)
                    Text("मिट्टी: ${plot.soilType}",
                        style: TextStyle(fontSize: 10.5, color: Colors.grey.shade500)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: leased
                    ? const Color(0xFF8B5CF6)
                    : const Color(0xFF16A34A),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                leased ? "पट्टे पर" : "खाली",
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
