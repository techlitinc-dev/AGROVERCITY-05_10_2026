// X6: Saved delivery address book.

import 'package:flutter/material.dart';
import '../../api/addresses_api.dart';
import '../../api/api_exception.dart';
import '../../components/market/address_form_sheet.dart';
import '../../state/app_state.dart';

class AddressBookView extends StatefulWidget {
  final AppState state;
  final AddressesApi? addressesApi;

  const AddressBookView({super.key, required this.state, this.addressesApi});

  @override
  State<AddressBookView> createState() => _AddressBookViewState();
}

class _AddressBookViewState extends State<AddressBookView> {
  late final AddressesApi _api = widget.addressesApi ?? AddressesApi();
  List<Map<String, dynamic>> _addresses = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.getAddresses();
      if (!mounted) return;
      setState(() {
        _addresses = (res['data'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _addresses = const [];
        _loading = false;
      });
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _openForm([Map<String, dynamic>? existing]) async {
    final saved = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => AddressFormSheet(
        state: widget.state,
        addressesApi: _api,
        existing: existing,
      ),
    );
    if (saved != null) {
      _snack(existing == null ? widget.state.tr('profile.addressAdded') : widget.state.tr('profile.addressUpdated'));
      await _load();
    }
  }

  Future<void> _setDefault(Map<String, dynamic> a) async {
    try {
      await _api.updateAddress("${a['id']}", {
        'label': a['label'],
        'line1': a['line1'],
        'village': a['village'],
        'district': a['district'],
        'state': a['state'],
        'pincode': a['pincode'],
        'isDefault': true,
      });
      _snack(widget.state.tr('profile.defaultAddressChanged'));
      await _load();
    } on ApiException catch (e) {
      _snack(e.message);
    }
  }

  Future<void> _delete(Map<String, dynamic> a) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(widget.state.tr('profile.deleteAddressConfirm'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Text("${a['label']}: ${a['line1']}, ${a['village']}"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(widget.state.tr('cancel'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(widget.state.tr('deleteK')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.deleteAddress("${a['id']}");
      _snack(widget.state.tr('profile.addressDeleted'));
      await _load();
    } on ApiException catch (e) {
      _snack(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF16A34A),
        foregroundColor: Colors.white,
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add_location_alt_rounded, size: 18),
        label: Text(widget.state.tr('profile.addAddress'), style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 140),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.state.tr('profile.myAddressesTitle'), style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            if (_loading)
              Container(height: 72, decoration: BoxDecoration(color: Colors.grey.shade200, borderRadius: BorderRadius.circular(14)))
            else if (_addresses.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(child: Text(widget.state.tr('profile.noSavedAddresses'), style: const TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.w700))),
              )
            else
              ..._addresses.map(_addressCard),
          ],
        ),
      ),
    );
  }

  Widget _addressCard(Map<String, dynamic> a) {
    final isDefault = a['isDefault'] == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDefault ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
          width: isDefault ? 1.6 : 1.0,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text("${a['label']}", style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1B4332))),
                    if (isDefault) ...[
                      const SizedBox(width: 6),
                      const Icon(Icons.star_rounded, size: 15, color: Color(0xFFF59E0B)),
                      Text(' ${widget.state.tr('profile.defaultTag')}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFF59E0B))),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  "${a['line1']}, ${a['village']}, ${a['district']}, ${a['state']} - ${a['pincode']}",
                  style: const TextStyle(fontSize: 11.5, color: Colors.black54, height: 1.35),
                ),
              ],
            ),
          ),
          Column(
            children: [
              IconButton(
                tooltip: widget.state.tr('profile.setAsDefaultTooltip'),
                visualDensity: VisualDensity.compact,
                icon: Icon(
                  isDefault ? Icons.star_rounded : Icons.star_outline_rounded,
                  size: 19,
                  color: const Color(0xFFF59E0B),
                ),
                onPressed: isDefault ? null : () => _setDefault(a),
              ),
              IconButton(
                tooltip: widget.state.tr('profile.editTooltip'),
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.edit_rounded, size: 18, color: Color(0xFF2E7D32)),
                onPressed: () => _openForm(a),
              ),
              IconButton(
                tooltip: widget.state.tr('deleteK'),
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Color(0xFFDC2626)),
                onPressed: () => _delete(a),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
