import 'package:flutter/material.dart';

// Pops with the chosen vehicle map, or null when dismissed.
class AcceptVehicleSheet extends StatefulWidget {
  const AcceptVehicleSheet({
    super.key,
    required this.vehicles,
    required this.onManageVehicles,
  });

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
          const Text("वाहन असाइन करें", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          if (widget.vehicles.isEmpty)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("पहले सत्यापित वाहन जोड़ें", style: TextStyle(fontSize: 13, color: Colors.grey)),
                TextButton(
                  onPressed: widget.onManageVehicles,
                  child: const Text("मेरे वाहन खोलें →"),
                ),
              ],
            )
          else
            DropdownButtonFormField<String>(
              initialValue: _selectedId,
              decoration: const InputDecoration(labelText: "सत्यापित वाहन", border: OutlineInputBorder()),
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
            child: const Text("स्वीकारें", style: TextStyle(fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
  }
}

// Pops with the reason text (min 3 chars), or null when cancelled.
class RejectReasonDialog extends StatefulWidget {
  const RejectReasonDialog({super.key});

  static const quickReasons = ['वाहन उपलब्ध नहीं', 'दूरी ज़्यादा', 'तारीख सूट नहीं'];

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
      title: const Text("अस्वीकार का कारण", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 6,
            children: RejectReasonDialog.quickReasons
                .map(
                  (r) => ActionChip(
                    label: Text(r, style: const TextStyle(fontSize: 11.5)),
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
              labelText: "कारण लिखें",
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
