import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/equipment_api.dart';
import '../../state/app_state.dart';
import 'pending_bookings_section.dart';
import 'slot_template_editor.dart';

// Owner slot-template editor + pending booking inbox (E2).
class SlotCalendarManageView extends StatefulWidget {
  final AppState state;
  final EquipmentApi? equipmentApi;
  final Map<String, dynamic>? machine;
  const SlotCalendarManageView({
    super.key,
    required this.state,
    this.equipmentApi,
    this.machine,
  });

  @override
  State<SlotCalendarManageView> createState() => _SlotCalendarManageViewState();
}

class _SlotCalendarManageViewState extends State<SlotCalendarManageView> {
  late final EquipmentApi _api = widget.equipmentApi ?? EquipmentApi();

  Map<String, dynamic>? _machine;
  bool _loading = true;
  List<Map<String, dynamic>> _pending = [];
  List<SlotTemplateRow> _rows = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _machine = widget.machine ?? widget.state.selectedEquipment;
    _init();
  }

  @override
  void dispose() {
    for (final r in _rows) {
      r.dispose();
    }
    super.dispose();
  }

  String _dateStr(DateTime d) =>
      "${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}";

  Future<void> _init() async {
    if (_machine == null) {
      try {
        final res = await _api.getOwnerFleet();
        final fleet = (res['data'] as List).cast<Map<String, dynamic>>();
        if (fleet.isNotEmpty) {
          _machine = {'id': fleet.first['equipmentId'], 'name': fleet.first['name']};
        }
      } catch (_) {}
    }
    await Future.wait([_loadPending(), _loadTemplate()]);
    if (!mounted) return;
    setState(() => _loading = false);
  }

  Future<void> _loadPending() async {
    try {
      final res = await _api.getPendingBookings();
      if (!mounted) return;
      setState(() {
        _pending = (res['data'] as List).cast<Map<String, dynamic>>().toList();
      });
    } catch (_) {}
  }

  // Current template is derived from a future day's generated slots.
  Future<void> _loadTemplate() async {
    final machine = _machine;
    if (machine == null) return;
    try {
      final tomorrow = DateTime.now().add(const Duration(days: 1));
      final res = await _api.getSlots("${machine['id']}", _dateStr(tomorrow));
      final slots = (res['data'] as List).cast<Map<String, dynamic>>();
      if (!mounted || slots.isEmpty) return;
      for (final r in _rows) {
        r.dispose();
      }
      setState(() {
        _rows = slots
            .map(
              (s) => SlotTemplateRow(
                slotName: "${s['slotName'] ?? ''}",
                duration: "${s['duration'] ?? '4 hours'}",
                priceRupees: "${(s['priceRupees'] as num?)?.toInt() ?? ''}",
                recommendedTask: "${s['recommendedTask'] ?? ''}",
              ),
            )
            .toList();
      });
    } catch (_) {}
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  void _handleError(ApiException e) {
    _snack(e.message.isNotEmpty ? e.message : e.code);
    if (e.code == 'ILLEGAL_TRANSITION') _loadPending();
  }

  Future<void> _approve(Map<String, dynamic> booking) async {
    try {
      await _api.approveBooking("${booking['bookingId'] ?? booking['id']}");
      if (!mounted) return;
      setState(() => _pending.remove(booking));
      _snack("बुकिंग स्वीकृत");
    } on ApiException catch (e) {
      _handleError(e);
    }
  }

  Future<void> _reject(Map<String, dynamic> booking, String reason) async {
    try {
      await _api.rejectBooking("${booking['bookingId'] ?? booking['id']}", reason);
      if (!mounted) return;
      setState(() => _pending.remove(booking));
      _snack("बुकिंग अस्वीकृत");
    } on ApiException catch (e) {
      _handleError(e);
    }
  }

  Future<void> _saveTemplate() async {
    final machine = _machine;
    if (machine == null || _rows.isEmpty || _rows.length > 8) return;
    setState(() => _saving = true);
    try {
      await _api.updateEquipment(
        "${machine['id']}",
        slotTemplate: _rows.map((r) => r.toTemplate()).toList(),
      );
      _snack("स्लॉट टेम्पलेट सहेजा गया — नए स्लॉट अगले दिन से लागू होंगे");
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
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
              Expanded(
                child: Text(
                  "स्लॉट कैलेंडर: ${_machine?['name'] ?? ''}",
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else ...[
            PendingBookingsSection(
              state: widget.state,
              bookings: _pending,
              onApprove: _approve,
              onReject: _reject,
            ),
            const SizedBox(height: 14),
            SlotTemplateEditor(
              rows: _rows,
              onAdd: () => setState(() => _rows.add(SlotTemplateRow())),
              onRemove: (i) => setState(() {
                _rows.removeAt(i).dispose();
              }),
            ),
            const SizedBox(height: 14),
            ElevatedButton(
              onPressed: _saving ? null : _saveTemplate,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD97706),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 48),
              ),
              child: Text(_saving ? "सहेजा जा रहा..." : "टेम्पलेट सहेजें", style: const TextStyle(fontWeight: FontWeight.w900)),
            ),
          ],
        ],
      ),
    );
  }
}
