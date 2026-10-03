import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/purchases_api.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';
import 'sheet_scaffold.dart';

class _SheetField extends StatelessWidget {
  final String label;
  final String hint;
  final TextEditingController ctrl;
  final TextInputType type;

  const _SheetField({
    required this.label,
    required this.hint,
    required this.ctrl,
    this.type = TextInputType.text,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1B4332))),
          const SizedBox(height: 4),
          TextField(
            controller: ctrl,
            keyboardType: type,
            decoration: InputDecoration.collapsed(hintText: hint),
          ),
        ],
      ),
    );
  }
}

Future<bool> _showSheet(
  BuildContext context,
  Widget sheet,
) async {
  final ok = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
      child: sheet,
    ),
  );
  return ok == true;
}

class PayAdvanceSheet extends StatefulWidget {
  final AppState state;
  final PurchasesApi api;
  final Purchase purchase;

  const PayAdvanceSheet({
    super.key,
    required this.state,
    required this.api,
    required this.purchase,
  });

  static Future<bool> show(BuildContext context,
          {required AppState state,
          required PurchasesApi api,
          required Purchase purchase}) =>
      _showSheet(context,
          PayAdvanceSheet(state: state, api: api, purchase: purchase));

  @override
  State<PayAdvanceSheet> createState() => _PayAdvanceSheetState();
}

class _PayAdvanceSheetState extends State<PayAdvanceSheet> {
  final _amountCtrl = TextEditingController();
  final _methodCtrl = TextEditingController();
  final _refCtrl = TextEditingController();
  String? _error;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _amountCtrl.text = "${widget.purchase.totalAmount}";
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _methodCtrl.dispose();
    _refCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = int.tryParse(_amountCtrl.text.trim()) ?? 0;
    if (amount <= 0) {
      setState(() => _error = widget.state.tr('direct.errMaxPriceRequired'));
      return;
    }
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      await widget.api.payAdvance(widget.purchase.id,
          amount: amount,
          method: _methodCtrl.text.trim(),
          reference: _refCtrl.text.trim());
      widget.state.showToast(widget.state.tr('direct.paymentRecordedMsg'));
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.state.tr;
    return SheetScaffold(
      title: tr('direct.payAdvanceBtn'),
      error: _error,
      submitting: _submitting,
      submitLabel: tr('direct.payAdvanceBtn'),
      color: const Color(0xFF2563EB),
      onSubmit: _submit,
      children: [
        _SheetField(
            label: tr('direct.amountLabel'),
            hint: tr('direct.amountLabel'),
            ctrl: _amountCtrl,
            type: TextInputType.number),
        _SheetField(
            label: tr('direct.paymentMethodLabel'),
            hint: tr('direct.paymentMethodHint'),
            ctrl: _methodCtrl),
        _SheetField(
            label: tr('direct.paymentReferenceLabel'),
            hint: tr('direct.paymentReferenceHint'),
            ctrl: _refCtrl),
      ],
    );
  }
}

class PickupSheet extends StatefulWidget {
  final AppState state;
  final PurchasesApi api;
  final Purchase purchase;

  const PickupSheet({
    super.key,
    required this.state,
    required this.api,
    required this.purchase,
  });

  static Future<bool> show(BuildContext context,
          {required AppState state,
          required PurchasesApi api,
          required Purchase purchase}) =>
      _showSheet(context,
          PickupSheet(state: state, api: api, purchase: purchase));

  @override
  State<PickupSheet> createState() => _PickupSheetState();
}

class _PickupSheetState extends State<PickupSheet> {
  final _vehicleCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  late DateTime _date = DateTime.now().add(const Duration(days: 1));
  String? _error;
  bool _submitting = false;

  @override
  void dispose() {
    _vehicleCtrl.dispose();
    _addressCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 60)),
    );
    if (d != null) setState(() => _date = d);
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _submitting = true;
    });
    final dateStr =
        "${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}";
    try {
      await widget.api.schedulePickup(widget.purchase.id,
          date: dateStr,
          vehicleType: _vehicleCtrl.text.trim(),
          address: _addressCtrl.text.trim(),
          notes: _notesCtrl.text.trim());
      widget.state.showToast(widget.state.tr('direct.demandUpdatedMsg'));
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.state.tr;
    return SheetScaffold(
      title: tr('direct.pickupBtn'),
      error: _error,
      submitting: _submitting,
      submitLabel: tr('direct.pickupBtn'),
      color: const Color(0xFF7C3AED),
      onSubmit: _submit,
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                    "${tr('direct.pickupDateLabel')}: ${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}",
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w800)),
              ),
              TextButton.icon(
                onPressed: _pickDate,
                icon: const Icon(Icons.calendar_month_rounded, size: 16),
                label: Text(tr('direct.selectDateBtn')),
              ),
            ],
          ),
        ),
        _SheetField(
            label: tr('direct.vehicleTypeLabel'),
            hint: tr('direct.vehicleTypeHint'),
            ctrl: _vehicleCtrl),
        _SheetField(
            label: tr('direct.pickupAddressLabel'),
            hint: tr('direct.pickupAddressHint'),
            ctrl: _addressCtrl),
        _SheetField(
            label: tr('direct.pickupNotesLabel'),
            hint: tr('direct.pickupNotesHint'),
            ctrl: _notesCtrl),
      ],
    );
  }
}
