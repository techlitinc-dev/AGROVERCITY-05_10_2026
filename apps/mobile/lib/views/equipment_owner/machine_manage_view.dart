import 'package:flutter/material.dart';

import '../../api/equipment_api.dart';
import '../../state/app_state.dart';
import '../profile_home/transport_home_widgets.dart' show formatRupees;
import 'machine_form_sheet.dart';

class MachineManageView extends StatefulWidget {
  final AppState state;
  final EquipmentApi? equipmentApi;
  const MachineManageView({super.key, required this.state, this.equipmentApi});

  @override
  State<MachineManageView> createState() => _MachineManageViewState();
}

class _MachineManageViewState extends State<MachineManageView> {
  late final EquipmentApi _api = widget.equipmentApi ?? EquipmentApi();

  bool _loading = true;
  List<Map<String, dynamic>> _fleet = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.getOwnerFleet();
      if (!mounted) return;
      setState(() {
        _fleet = (res['data'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _fleet = const [];
        _loading = false;
      });
    }
  }

  Future<void> _openForm({Map<String, dynamic>? existing}) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => MachineFormSheet(api: _api, state: widget.state, existing: existing),
    );
    if (saved == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFD97706),
        foregroundColor: Colors.white,
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add_rounded),
        label: Text(widget.state.tr('equipment.addMachine'), style: const TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 90),
        children: [
          Row(
            children: [
              IconButton(
                onPressed: widget.state.navigateBack,
                icon: const Icon(Icons.arrow_back_rounded),
              ),
              Text(widget.state.tr('equipment.myMachines'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            ],
          ),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_fleet.isEmpty)
            Text(widget.state.tr('equipment.noMachinesAddBelow'), style: const TextStyle(fontSize: 12, color: Colors.grey))
          else
            ..._fleet.map(_buildMachineCard),
        ],
      ),
    );
  }

  Widget _buildMachineCard(Map<String, dynamic> m) {
    final docStatus = "${m['docStatus'] ?? 'pending'}";
    final docLabel = switch (docStatus) {
      'verified' => "${widget.state.tr('equipment.verified')} ✅",
      'rejected' => "${widget.state.tr('equipment.statusRejected')} ❌",
      _ => "${widget.state.tr('equipment.verificationPending')} ⏳",
    };
    final hours = (m['bookedHoursThisWeek'] as num?) ?? 0;
    final income = (m['weeklyIncome'] as num?) ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("${m['name']}", style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
                    Text("${widget.state.tr('equipment.thisWeek')}: $hours ${widget.state.tr('equipment.hoursBooked')} • ₹${formatRupees(income)}", style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600)),
                  ],
                ),
              ),
              Text(docLabel, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800)),
            ],
          ),
          if (m['rejectionReason'] != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text("${widget.state.tr('equipment.reasonLabel')}: ${m['rejectionReason']}", style: const TextStyle(fontSize: 11, color: Color(0xFFDC2626))),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              TextButton.icon(
                onPressed: () => widget.state.openSlotCalendarManage({
                  'id': m['equipmentId'],
                  'name': m['name'],
                }),
                icon: const Icon(Icons.calendar_month_rounded, size: 16),
                label: Text(widget.state.tr('equipment.slotCalendar'), style: const TextStyle(fontSize: 12)),
              ),
              TextButton.icon(
                onPressed: () => _openForm(existing: m),
                icon: const Icon(Icons.edit_rounded, size: 16),
                label: Text(widget.state.tr('equipment.edit'), style: const TextStyle(fontSize: 12)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
