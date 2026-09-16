import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/equipment_api.dart';

// Pops with true when the machine was saved, null when dismissed.
class MachineFormSheet extends StatefulWidget {
  const MachineFormSheet({super.key, required this.api, this.existing});

  final EquipmentApi api;
  final Map<String, dynamic>? existing;

  @override
  State<MachineFormSheet> createState() => _MachineFormSheetState();
}

class _MachineFormSheetState extends State<MachineFormSheet> {
  static const _types = ['tractor', 'rotavator', 'harvester', 'drone sprayer'];

  final _nameCtrl = TextEditingController();
  final _hourlyCtrl = TextEditingController();
  final _perAcreCtrl = TextEditingController();
  String _type = _types.first;
  String? _error;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _nameCtrl.text = "${e['name'] ?? ''}";
      _hourlyCtrl.text = "${e['hourlyRate'] ?? ''}";
      _perAcreCtrl.text = "${e['perAcreRate'] ?? ''}";
      if (_types.contains(e['type'])) _type = "${e['type']}";
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _hourlyCtrl.dispose();
    _perAcreCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      setState(() => _error = "मशीन का नाम आवश्यक है");
      return;
    }
    final hourly = double.tryParse(_hourlyCtrl.text.trim()) ?? 0;
    final perAcre = double.tryParse(_perAcreCtrl.text.trim());
    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      final existing = widget.existing;
      if (existing == null) {
        await widget.api.createEquipment(
          name: name,
          type: _type,
          hourlyRate: hourly,
          perAcreRate: perAcre,
        );
      } else {
        await widget.api.updateEquipment(
          "${existing['id'] ?? existing['equipmentId']}",
          name: name,
          type: _type,
          hourlyRate: hourly,
          perAcreRate: perAcre,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _error = e.message.isNotEmpty ? e.message : e.code);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.existing == null ? "नई मशीन जोड़ें" : "मशीन बदलें",
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _nameCtrl,
            decoration: InputDecoration(
              labelText: "मशीन का नाम",
              hintText: "जैसे Mahindra 575 DI Tractor",
              border: const OutlineInputBorder(),
              errorText: _error,
            ),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _type,
            decoration: const InputDecoration(labelText: "मशीन प्रकार", border: OutlineInputBorder()),
            items: _types
                .map((t) => DropdownMenuItem(value: t, child: Text(t, style: const TextStyle(fontSize: 13))))
                .toList(),
            onChanged: (v) => setState(() => _type = v ?? _type),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _hourlyCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: "घंटा दर (₹/घंटा)",
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _perAcreCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: "प्रति एकड़ दर (₹/एकड़, वैकल्पिक)",
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD97706),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 48),
            ),
            child: Text(_saving ? "सहेजा जा रहा..." : "सहेजें", style: const TextStyle(fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
  }
}
