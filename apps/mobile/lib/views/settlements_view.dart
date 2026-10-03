// Day 9 Task B6 — full settlements list screen (निपटान).

import 'package:flutter/material.dart';
import '../api/settlements_api.dart';
import '../components/settlements_section.dart' show settlementStatusChip;
import '../models/settlement.dart';
import '../state/app_state.dart';
import 'profile_home/transport_home_widgets.dart' show formatRupees;

class SettlementsView extends StatefulWidget {
  final AppState state;
  final SettlementsApi? settlementsApi;
  const SettlementsView({super.key, required this.state, this.settlementsApi});

  @override
  State<SettlementsView> createState() => _SettlementsViewState();
}

class _SettlementsViewState extends State<SettlementsView> {
  late final SettlementsApi _api = widget.settlementsApi ??
      SettlementsApi(activeProfile: () => widget.state.activeProfile);

  List<Settlement> _settlements = [];
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
      final list = await _api.listMySettlements();
      if (!mounted) return;
      setState(() {
        _settlements = list;
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
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.state.tr('bookings.settlementsTitle'),
            style: const TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: const Color(0xFF1B4332),
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF43A047)))
          : _error
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(widget.state.tr('bookings.loadFailed'),
                          style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      ElevatedButton(
                          onPressed: _load, child: Text(widget.state.tr('retry'))),
                    ],
                  ),
                )
              : _settlements.isEmpty
                  ? Center(
                      child: Text(widget.state.tr('bookings.noSettlements'),
                          style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.w700)))
                  : RefreshIndicator(
                      color: const Color(0xFF1B4332),
                      onRefresh: _load,
                      child: ListView.builder(
                        physics: const BouncingScrollPhysics(
                            parent: AlwaysScrollableScrollPhysics()),
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
                        itemCount: _settlements.length,
                        itemBuilder: (_, i) => _settlementRow(_settlements[i]),
                      ),
                    ),
    );
  }

  Widget _settlementRow(Settlement s) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "${s.periodStart} – ${s.periodEnd}",
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1E293B)),
              ),
              settlementStatusChip(s.status),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("${widget.state.tr('bookings.grossLabel')} ₹${formatRupees(s.grossRupees)}",
                  style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700, fontWeight: FontWeight.w600)),
              Text("${widget.state.tr('bookings.commissionLabel')} ₹${formatRupees(s.commissionRupees)}",
                  style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700, fontWeight: FontWeight.w600)),
              Text("${widget.state.tr('bookings.netLabel')} ₹${formatRupees(s.netRupees)}",
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF1B4332))),
            ],
          ),
        ],
      ),
    );
  }
}
