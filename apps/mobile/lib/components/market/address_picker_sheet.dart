import 'package:flutter/material.dart';
import '../../api/addresses_api.dart';
import '../../state/app_state.dart';
import 'address_form_sheet.dart';

class AddressPickerSheet extends StatefulWidget {
  final AppState state;
  final AddressesApi? addressesApi;
  final List<Map<String, dynamic>> addresses;
  final String? selectedId;

  const AddressPickerSheet({
    super.key,
    required this.state,
    required this.addresses,
    this.addressesApi,
    this.selectedId,
  });

  @override
  State<AddressPickerSheet> createState() => _AddressPickerSheetState();
}

class _AddressPickerSheetState extends State<AddressPickerSheet> {
  @override
  void initState() {
    super.initState();
    if (widget.addresses.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _openAddForm());
    }
  }

  Future<void> _openAddForm() async {
    final saved = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => AddressFormSheet(
        state: widget.state,
        addressesApi: widget.addressesApi,
      ),
    );
    if (saved != null && mounted) Navigator.pop(context, saved);
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Material(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 20),
          child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.state.tr('market.selectDeliveryAddress'),
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
            ),
            const SizedBox(height: 10),
            if (widget.addresses.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Text(widget.state.tr('market.noSavedAddresses'), style: const TextStyle(fontSize: 12, color: Colors.grey)),
              )
            else
              RadioGroup<String>(
                groupValue: widget.selectedId,
                onChanged: (id) {
                  final picked = widget.addresses.firstWhere((a) => "${a['id']}" == id);
                  Navigator.pop(context, picked);
                },
                child: Column(
                  children: [
                    ...widget.addresses.map(
                      (a) => RadioListTile<String>(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        activeColor: const Color(0xFF16A34A),
                        value: "${a['id']}",
                        title: Text(
                          "${a['label']} — ${a['line1']}",
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          "${a['village']}, ${a['district']}, ${a['state']} - ${a['pincode']}",
                          style: const TextStyle(fontSize: 11),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            const Divider(height: 16),
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.add_location_alt_rounded, color: Color(0xFF16A34A)),
              title: Text(
                widget.state.tr('market.addNewAddress'),
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF16A34A)),
              ),
              onTap: _openAddForm,
            ),
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.settings_outlined, color: Colors.grey),
              title: Text(
                widget.state.tr('market.manageAddresses'),
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Colors.grey),
              ),
              onTap: () {
                Navigator.pop(context);
                widget.state.navigateTo('addressBook');
              },
            ),
          ],
        ),
      ),
    ),
    );
  }
}
