import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/transport_api.dart';
import '../../core/photo_upload.dart';

class VehicleFormSheet extends StatefulWidget {
  const VehicleFormSheet({
    super.key,
    required this.api,
    required this.uploader,
    required this.uid,
    this.existing,
  });

  final TransportApi api;
  final PhotoUploader uploader;
  final String uid;
  final Map<String, dynamic>? existing;

  @override
  State<VehicleFormSheet> createState() => _VehicleFormSheetState();
}

class _VehicleFormSheetState extends State<VehicleFormSheet> {
  static const _types = ['Tata Ace', 'Bolero Maxi', 'Tractor Trolley'];

  final _regCtrl = TextEditingController();
  final _capacityCtrl = TextEditingController();
  String _vehicleType = _types.first;
  String? _rcDocUrl;
  String? _insuranceDocUrl;
  String? _regError;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _regCtrl.text = "${e['registrationNo'] ?? ''}";
      _capacityCtrl.text = "${e['capacityTonnes'] ?? ''}";
      if (_types.contains(e['vehicleType'])) _vehicleType = "${e['vehicleType']}";
      _rcDocUrl = e['rcDocUrl'] as String?;
      _insuranceDocUrl = e['insuranceDocUrl'] as String?;
    }
  }

  @override
  void dispose() {
    _regCtrl.dispose();
    _capacityCtrl.dispose();
    super.dispose();
  }

  Future<void> _uploadDoc(bool isRc) async {
    final ts = DateTime.now().millisecondsSinceEpoch;
    final path = isRc
        ? 'vehicles/${widget.uid}/rc_$ts.jpg'
        : 'vehicles/${widget.uid}/insurance_$ts.jpg';
    try {
      final url = await widget.uploader.pickAndUpload(path);
      if (url != null && mounted) {
        setState(() => isRc ? _rcDocUrl = url : _insuranceDocUrl = url);
      }
    } catch (_) {}
  }

  Future<void> _save() async {
    final reg = _regCtrl.text.trim();
    if (reg.isEmpty) {
      setState(() => _regError = "रजिस्ट्रेशन नंबर आवश्यक है");
      return;
    }
    final capacity = double.tryParse(_capacityCtrl.text.trim()) ?? 0;
    setState(() {
      _regError = null;
      _saving = true;
    });
    try {
      final existing = widget.existing;
      if (existing == null) {
        await widget.api.createVehicle(
          vehicleType: _vehicleType,
          registrationNo: reg,
          capacityTonnes: capacity,
          rcDocUrl: _rcDocUrl,
          insuranceDocUrl: _insuranceDocUrl,
        );
      } else {
        await widget.api.updateVehicle(
          "${existing['id']}",
          vehicleType: _vehicleType,
          registrationNo: reg,
          capacityTonnes: capacity,
          rcDocUrl: _rcDocUrl,
          insuranceDocUrl: _insuranceDocUrl,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _regError = e.message.isNotEmpty ? e.message : e.code);
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
            widget.existing == null ? "नया वाहन जोड़ें" : "वाहन बदलें",
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _vehicleType,
            decoration: const InputDecoration(labelText: "वाहन प्रकार", border: OutlineInputBorder()),
            items: _types
                .map((t) => DropdownMenuItem(value: t, child: Text(t, style: const TextStyle(fontSize: 13))))
                .toList(),
            onChanged: (v) => setState(() => _vehicleType = v ?? _vehicleType),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _regCtrl,
            decoration: InputDecoration(
              labelText: "रजिस्ट्रेशन नंबर",
              hintText: "जैसे MH-15-AB-1234",
              border: const OutlineInputBorder(),
              errorText: _regError,
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _capacityCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: "क्षमता (टन)",
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _uploadDoc(true),
                  icon: const Icon(Icons.upload_file_rounded, size: 16),
                  label: Text(_rcDocUrl == null ? "RC दस्तावेज़" : "RC ✅", style: const TextStyle(fontSize: 12)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _uploadDoc(false),
                  icon: const Icon(Icons.upload_file_rounded, size: 16),
                  label: Text(_insuranceDocUrl == null ? "बीमा दस्तावेज़" : "बीमा ✅", style: const TextStyle(fontSize: 12)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
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
