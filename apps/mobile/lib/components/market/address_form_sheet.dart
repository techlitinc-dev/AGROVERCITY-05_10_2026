import 'package:flutter/material.dart';
import '../../api/api_exception.dart';
import '../../api/addresses_api.dart';
import '../../state/app_state.dart';

class AddressFormSheet extends StatefulWidget {
  final AppState state;
  final AddressesApi? addressesApi;
  final Map<String, dynamic>? existing;

  const AddressFormSheet({
    super.key,
    required this.state,
    this.addressesApi,
    this.existing,
  });

  @override
  State<AddressFormSheet> createState() => _AddressFormSheetState();
}

class _AddressFormSheetState extends State<AddressFormSheet> {
  late final AddressesApi _api = widget.addressesApi ?? AddressesApi();
  late final _labelCtrl = TextEditingController(text: e?['label'] as String? ?? '');
  late final _line1Ctrl = TextEditingController(text: e?['line1'] as String? ?? '');
  late final _villageCtrl = TextEditingController(
      text: e?['village'] as String? ?? widget.state.profile.village);
  late final _districtCtrl = TextEditingController(
      text: e?['district'] as String? ?? widget.state.profile.district);
  late final _stateCtrl = TextEditingController(
      text: e?['state'] as String? ?? widget.state.profile.state);
  late final _pincodeCtrl = TextEditingController(text: e?['pincode'] as String? ?? '');
  late bool _isDefault = e?['isDefault'] == true;
  String? _pincodeError;
  bool _saving = false;

  Map<String, dynamic>? get e => widget.existing;

  @override
  void dispose() {
    _labelCtrl.dispose();
    _line1Ctrl.dispose();
    _villageCtrl.dispose();
    _districtCtrl.dispose();
    _stateCtrl.dispose();
    _pincodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final pincode = _pincodeCtrl.text.trim();
    if (pincode.length != 6 || int.tryParse(pincode) == null) {
      setState(() => _pincodeError = widget.state.tr('market.pincodeError'));
      return;
    }
    setState(() {
      _pincodeError = null;
      _saving = true;
    });
    final fields = <String, dynamic>{
      'label': _labelCtrl.text.trim().isEmpty ? widget.state.tr('market.homeTag') : _labelCtrl.text.trim(),
      'line1': _line1Ctrl.text.trim(),
      'village': _villageCtrl.text.trim(),
      'district': _districtCtrl.text.trim(),
      'state': _stateCtrl.text.trim(),
      'pincode': pincode,
      'isDefault': _isDefault,
    };
    try {
      final saved = e == null
          ? await _api.createAddress(fields)
          : await _api.updateAddress("${e!['id']}", fields);
      if (mounted) Navigator.pop(context, saved);
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() => _saving = false);
      final fieldError = err.fieldErrors['pincode'];
      if (fieldError != null) {
        setState(() => _pincodeError = "$fieldError");
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err.message)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              e == null ? widget.state.tr('market.addNewAddress') : widget.state.tr('market.editAddress'),
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
            ),
            const SizedBox(height: 12),
            _field(widget.state.tr('market.labelHint'), _labelCtrl),
            _field(widget.state.tr('market.addressLine1'), _line1Ctrl),
            _field(widget.state.tr('village'), _villageCtrl),
            _field(widget.state.tr('district'), _districtCtrl),
            _field(widget.state.tr('state'), _stateCtrl),
            _field(widget.state.tr('market.pincode6'), _pincodeCtrl,
                keyboard: TextInputType.number, error: _pincodeError),
            Row(
              children: [
                Checkbox(
                  value: _isDefault,
                  activeColor: const Color(0xFF16A34A),
                  onChanged: (v) => setState(() => _isDefault = v ?? false),
                ),
                Text(widget.state.tr('market.makeDefaultAddress'), style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: _saving ? null : _save,
                child: Text(
                  _saving ? widget.state.tr('market.savingAddress') : widget.state.tr('market.saveAddress'),
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl,
      {TextInputType? keyboard, String? error}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: error != null ? Colors.red : const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: ctrl,
            keyboardType: keyboard,
            decoration: InputDecoration(
              labelText: label,
              labelStyle: const TextStyle(fontSize: 12),
              border: InputBorder.none,
              isDense: true,
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(error, style: const TextStyle(fontSize: 10.5, color: Colors.red, fontWeight: FontWeight.w700)),
            ),
        ],
      ),
    );
  }
}
