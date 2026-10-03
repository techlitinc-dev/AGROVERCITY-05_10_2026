// Day 9 Task B6 — compact settlements card for earner dashboards (T5/E6/B6).

import 'package:flutter/material.dart';
import '../api/settlements_api.dart';
import '../models/settlement.dart';
import '../state/app_state.dart';
import '../views/profile_home/transport_home_widgets.dart' show formatRupees;

Widget settlementStatusChip(String status) {
  final (label, color, bg) = switch (status) {
    'approved' => ("स्वीकृत", const Color(0xFF1D4ED8), const Color(0xFFDBEAFE)),
    'paid' => ("भुगतान हुआ", const Color(0xFF16A34A), const Color(0xFFD1FAE5)),
    _ => ("लंबित", const Color(0xFFB45309), const Color(0xFFFEF3C7)),
  };
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
    child: Text(label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color)),
  );
}

class SettlementsSection extends StatefulWidget {
  final AppState state;
  final SettlementsApi? settlementsApi;
  const SettlementsSection({super.key, required this.state, this.settlementsApi});

  @override
  State<SettlementsSection> createState() => _SettlementsSectionState();
}

class _SettlementsSectionState extends State<SettlementsSection> {
  late final SettlementsApi _api = widget.settlementsApi ??
      SettlementsApi(activeProfile: () => widget.state.activeProfile);

  Settlement? _current;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await _api.listMySettlements();
      if (!mounted) return;
      setState(() {
        _current = list.isNotEmpty ? list.first : null;
        _loaded = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loaded = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = _current;
    if (!_loaded || current == null) return const SizedBox.shrink();
    return Container(
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
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "निपटान: ${current.periodStart} – ${current.periodEnd}",
                  style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  "शुद्ध ₹${formatRupees(current.netRupees)}",
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                ),
              ],
            ),
          ),
          settlementStatusChip(current.status),
          const SizedBox(width: 8),
          TextButton(
            onPressed: () => widget.state.navigateTo('settlements'),
            child: const Text("सभी देखें",
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}
