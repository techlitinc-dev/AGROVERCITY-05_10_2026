import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/purchases_api.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';
import 'sheet_scaffold.dart';

class _Field extends StatelessWidget {
  final String label;
  final String hint;
  final TextEditingController ctrl;
  final TextInputType type;

  const _Field({
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

class PaymentSheet extends StatefulWidget {
  final AppState state;
  final PurchasesApi api;
  final Purchase purchase;

  const PaymentSheet({
    super.key,
    required this.state,
    required this.api,
    required this.purchase,
  });

  static Future<bool> show(BuildContext context,
      {required AppState state,
      required PurchasesApi api,
      required Purchase purchase}) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: PaymentSheet(state: state, api: api, purchase: purchase),
      ),
    );
    return ok == true;
  }

  @override
  State<PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<PaymentSheet> {
  final _amountCtrl = TextEditingController();
  final _methodCtrl = TextEditingController();
  final _refCtrl = TextEditingController();
  String _kind = 'balance';
  String? _error;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _amountCtrl.text = "${widget.purchase.amountDue}";
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
      await widget.api.recordPayment(widget.purchase.id,
          amount: amount,
          method: _methodCtrl.text.trim(),
          reference: _refCtrl.text.trim(),
          kind: _kind);
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
      title: tr('direct.recordPaymentBtn'),
      error: _error,
      submitting: _submitting,
      submitLabel: tr('direct.recordPaymentBtn'),
      color: const Color(0xFFD97706),
      onSubmit: _submit,
      children: [
        _Field(
            label: tr('direct.amountLabel'),
            hint: tr('direct.amountLabel'),
            ctrl: _amountCtrl,
            type: TextInputType.number),
        Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Text(tr('direct.paymentKindLabel'),
                  style: const TextStyle(
                      fontSize: 11.5, fontWeight: FontWeight.w800)),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButton<String>(
                  value: _kind,
                  isExpanded: true,
                  underline: const SizedBox.shrink(),
                  items: [
                    for (final k in const ['advance', 'balance', 'full'])
                      DropdownMenuItem(
                          value: k,
                          child: Text(k, style: const TextStyle(fontSize: 13))),
                  ],
                  onChanged: (v) => setState(() => _kind = v ?? _kind),
                ),
              ),
            ],
          ),
        ),
        _Field(
            label: tr('direct.paymentMethodLabel'),
            hint: tr('direct.paymentMethodHint'),
            ctrl: _methodCtrl),
        _Field(
            label: tr('direct.paymentReferenceLabel'),
            hint: tr('direct.paymentReferenceHint'),
            ctrl: _refCtrl),
      ],
    );
  }
}
