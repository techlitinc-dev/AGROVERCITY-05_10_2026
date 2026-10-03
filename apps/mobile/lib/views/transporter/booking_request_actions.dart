import 'package:flutter/material.dart';

import '../../state/app_state.dart';

// Pops with the chosen vehicle map, or null when dismissed.
class AcceptVehicleSheet extends StatefulWidget {
  const AcceptVehicleSheet({
    super.key,
    required this.state,
    required this.vehicles,
    required this.onManageVehicles,
  });

  final AppState state;
  final List<Map<String, dynamic>> vehicles;
  final VoidCallback onManageVehicles;

  @override
  State<AcceptVehicleSheet> createState() => _AcceptVehicleSheetState();
}

class _AcceptVehicleSheetState extends State<AcceptVehicleSheet> {
  String? _selectedId;

  @override
  void initState() {
    super.initState();
    if (widget.vehicles.isNotEmpty) {
      _selectedId = "${widget.vehicles.first['id']}";
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.state.tr('transporter.assignVehicle'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          if (widget.vehicles.isEmpty)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.state.tr('transporter.addVerifiedVehicleFirst'), style: const TextStyle(fontSize: 13, color: Colors.grey)),
                TextButton(
                  onPressed: widget.onManageVehicles,
                  child: Text(widget.state.tr('transporter.openMyVehicles')),
                ),
              ],
            )
          else
            DropdownButtonFormField<String>(
              initialValue: _selectedId,
              decoration: InputDecoration(labelText: widget.state.tr('transporter.verifiedVehicle'), border: const OutlineInputBorder()),
              items: widget.vehicles
                  .map(
                    (v) => DropdownMenuItem(
                      value: "${v['id']}",
                      child: Text("${v['registrationNo']} (${v['vehicleType']})", style: const TextStyle(fontSize: 13)),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _selectedId = v),
            ),
          const SizedBox(height: 14),
          ElevatedButton(
            onPressed: _selectedId == null
                ? null
                : () {
                    final vehicle = widget.vehicles.firstWhere(
                      (v) => "${v['id']}" == _selectedId,
                      orElse: () => const {},
                    );
                    Navigator.pop(context, vehicle);
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 48),
            ),
            child: Text(widget.state.tr('transporter.accept'), style: const TextStyle(fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
  }
}

// Pops with the reason text (min 3 chars), or null when cancelled.
class RejectReasonDialog extends StatefulWidget {
  const RejectReasonDialog({super.key, required this.state});

  final AppState state;

  // Quick-reason payload values stay Hindi (sent to the API); chips show
  // translated labels via quickReasonKeys.
  static const quickReasons = ['वाहन उपलब्ध नहीं', 'दूरी ज़्यादा', 'तारीख सूट नहीं'];
  static const quickReasonKeys = {
    'वाहन उपलब्ध नहीं': 'transporter.reasonVehicleUnavailable',
    'दूरी ज़्यादा': 'transporter.reasonDistanceTooFar',
    'तारीख सूट नहीं': 'transporter.reasonDateUnsuitable',
  };

  @override
  State<RejectReasonDialog> createState() => _RejectReasonDialogState();
}

class _RejectReasonDialogState extends State<RejectReasonDialog> {
  final _reasonCtrl = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(widget.state.tr('transporter.rejectReasonTitle'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 6,
            children: RejectReasonDialog.quickReasons
                .map(
                  (r) => ActionChip(
                    label: Text(widget.state.tr(RejectReasonDialog.quickReasonKeys[r]!), style: const TextStyle(fontSize: 11.5)),
                    onPressed: () => setState(() {
                      _reasonCtrl.text = r;
                      _error = null;
                    }),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _reasonCtrl,
            onChanged: (_) => setState(() => _error = null),
            decoration: InputDecoration(
              labelText: widget.state.tr('transporter.writeReason'),
              border: const OutlineInputBorder(),
              errorText: _error,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text("रद्द करें")),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
          onPressed: () {
            final text = _reasonCtrl.text.trim();
            if (text.length < 3) {
              setState(() => _error = "कम से कम 3 अक्षर लिखें");
              return;
            }
            Navigator.pop(context, text);
          },
          child: const Text("अस्वीकारें"),
        ),
      ],
    );
  }
}
