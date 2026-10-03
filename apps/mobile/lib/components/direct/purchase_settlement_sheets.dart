import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/purchases_api.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';
import 'sheet_scaffold.dart';

Future<bool> _showSheet(BuildContext context, Widget sheet) async {
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

class _Field extends StatelessWidget {
  final String label;
  final String hint;
  final TextEditingController ctrl;
  final TextInputType type;
  final ValueChanged<String>? onChanged;

  const _Field({
    required this.label,
    required this.hint,
    required this.ctrl,
    this.type = TextInputType.text,
    this.onChanged,
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
            onChanged: onChanged,
            decoration: InputDecoration.collapsed(hintText: hint),
          ),
        ],
      ),
    );
  }
}

class QcSheet extends StatefulWidget {
  final AppState state;
  final PurchasesApi api;
  final Purchase purchase;

  const QcSheet({
    super.key,
    required this.state,
    required this.api,
    required this.purchase,
  });

  static Future<bool> show(BuildContext context,
          {required AppState state,
          required PurchasesApi api,
          required Purchase purchase}) =>
      _showSheet(context, QcSheet(state: state, api: api, purchase: purchase));

  @override
  State<QcSheet> createState() => _QcSheetState();
}

class _QcSheetState extends State<QcSheet> {
  String _grade = 'A';
  final _acceptedCtrl = TextEditingController();
  final _rejectedCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  String? _error;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _acceptedCtrl.text = widget.purchase.quantity.toStringAsFixed(0);
    _rejectedCtrl.text = '0';
  }

  @override
  void dispose() {
    _acceptedCtrl.dispose();
    _rejectedCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  void _onAcceptedChanged(String v) {
    final accepted = double.tryParse(v.trim()) ?? 0;
    final rejected = widget.purchase.quantity - accepted;
    _rejectedCtrl.text =
        rejected == rejected.roundToDouble() ? rejected.toStringAsFixed(0) : rejected.toStringAsFixed(2);
  }

  Future<void> _submit() async {
    final accepted = double.tryParse(_acceptedCtrl.text.trim()) ?? -1;
    final rejected = double.tryParse(_rejectedCtrl.text.trim()) ?? -1;
    if (accepted < 0 ||
        rejected < 0 ||
        (accepted + rejected - widget.purchase.quantity).abs() > 0.001) {
      setState(() => _error = widget.state.tr('direct.errQtyMismatch'));
      return;
    }
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      await widget.api.recordQc(widget.purchase.id,
          grade: _grade,
          acceptedQty: accepted,
          rejectedQty: rejected,
          note: _noteCtrl.text.trim());
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
      title: tr('direct.qcFormTitle'),
      error: _error,
      submitting: _submitting,
      submitLabel: tr('direct.qcSubmitBtn'),
      color: const Color(0xFF0D9488),
      onSubmit: _submit,
      children: [
        Text(tr('direct.qcGradeLabel'),
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Row(
          children: [
            for (final g in const ['A', 'B', 'C'])
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(g),
                  selected: _grade == g,
                  onSelected: (_) => setState(() => _grade = g),
                  selectedColor: const Color(0xFF0D9488),
                  labelStyle: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: _grade == g ? Colors.white : Colors.black87),
                ),
              ),
          ],
        ),
        const SizedBox(height: 10),
        _Field(
            label: tr('direct.qcAcceptedQtyHint'),
            hint: tr('direct.qcAcceptedQtyHint'),
            ctrl: _acceptedCtrl,
            type: TextInputType.number,
            onChanged: _onAcceptedChanged),
        _Field(
            label: tr('direct.qcRejectedQtyHint'),
            hint: tr('direct.qcRejectedQtyHint'),
            ctrl: _rejectedCtrl,
            type: TextInputType.number),
        _Field(
            label: tr('direct.qcNoteLabel'),
            hint: tr('direct.qcNoteHint'),
            ctrl: _noteCtrl),
      ],
    );
  }
}
