import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/transport_api.dart';
import '../../core/photo_upload.dart';
import '../../state/app_state.dart';
import 'vehicle_form_sheet.dart';

class VehicleManageView extends StatefulWidget {
  final AppState state;
  final TransportApi? transportApi;
  final PhotoUploader? photoUploader;
  const VehicleManageView({
    super.key,
    required this.state,
    this.transportApi,
    this.photoUploader,
  });

  @override
  State<VehicleManageView> createState() => _VehicleManageViewState();
}

class _VehicleManageViewState extends State<VehicleManageView> {
  late final TransportApi _api = widget.transportApi ?? TransportApi();

  bool _loading = true;
  List<Map<String, dynamic>> _vehicles = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.getMyVehicles();
      if (!mounted) return;
      setState(() {
        _vehicles = (res['data'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _vehicles = const [];
        _loading = false;
      });
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _openForm({Map<String, dynamic>? existing}) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => VehicleFormSheet(
        state: widget.state,
        api: _api,
        uploader: widget.photoUploader ?? const PhotoUploader(),
        uid: "${widget.state.currentUser?['id'] ?? 'demo'}",
        existing: existing,
      ),
    );
    if (saved == true) _load();
  }

  Future<void> _delete(Map<String, dynamic> vehicle) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(widget.state.tr('transporter.deleteVehicleTitle'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Text("${vehicle['registrationNo']} (${vehicle['vehicleType']})"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(widget.state.tr('cancel'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(widget.state.tr('transporter.delete')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.deleteVehicle("${vehicle['id']}");
      _snack(widget.state.tr('transporter.vehicleDeleted'));
      _load();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF0284C7),
        foregroundColor: Colors.white,
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add_rounded),
        label: Text(widget.state.tr('transporter.addVehicle'), style: const TextStyle(fontWeight: FontWeight.w900)),
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
              Text(widget.state.tr('transporter.myVehicles'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            ],
          ),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_vehicles.isEmpty)
            Text(widget.state.tr('transporter.noVehicles'), style: const TextStyle(fontSize: 12, color: Colors.grey))
          else
            ..._vehicles.map(_buildVehicleCard),
        ],
      ),
    );
  }

  Widget _buildVehicleCard(Map<String, dynamic> v) {
    final active = v['active'] != false;
    final docStatus = "${v['docStatus'] ?? 'pending'}";
    final docLabel = switch (docStatus) {
      'verified' => "${widget.state.tr('transporter.verified')} ✅",
      'rejected' => "${widget.state.tr('statusRejected')} ❌",
      _ => "${widget.state.tr('transporter.verificationPending')} ⏳",
    };
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
                    Text("${v['registrationNo']}", style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
                    Text("${v['vehicleType']} • ${v['capacityTonnes']} ${widget.state.tr('transporter.tonnes')}", style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(docLabel, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800)),
                  Text(active ? widget.state.tr('transporter.active') : widget.state.tr('transporter.inactive'), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: active ? const Color(0xFF166534) : Colors.grey)),
                ],
              ),
            ],
          ),
          if (v['rejectionReason'] != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text("कारण: ${v['rejectionReason']}", style: const TextStyle(fontSize: 11, color: Color(0xFFDC2626))),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              TextButton.icon(
                onPressed: () => widget.state.openVehicleCalendar(v),
                icon: const Icon(Icons.calendar_month_rounded, size: 16),
                label: const Text("कैलेंडर", style: TextStyle(fontSize: 12)),
              ),
              TextButton.icon(
                onPressed: () => _openForm(existing: v),
                icon: const Icon(Icons.edit_rounded, size: 16),
                label: const Text("बदलें", style: TextStyle(fontSize: 12)),
              ),
              TextButton.icon(
                onPressed: () => _delete(v),
                icon: const Icon(Icons.delete_rounded, size: 16, color: Color(0xFFDC2626)),
                label: const Text("हटाएं", style: TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
