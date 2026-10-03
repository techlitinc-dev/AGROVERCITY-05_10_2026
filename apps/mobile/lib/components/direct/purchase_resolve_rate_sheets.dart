import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/purchases_api.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';
import 'direct_widgets.dart';
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

class ResolveSheet extends StatefulWidget {
  final AppState state;
  final PurchasesApi api;
  final Purchase purchase;

  const ResolveSheet({
    super.key,
    required this.state,
    required this.api,
    required this.purchase,
  });

  static Future<bool> show(BuildContext context,
          {required AppState state,
          required PurchasesApi api,
          required Purchase purchase}) =>
      _showSheet(
          context, ResolveSheet(state: state, api: api, purchase: purchase));

  @override
  State<ResolveSheet> createState() => _ResolveSheetState();
}

class _ResolveSheetState extends State<ResolveSheet> {
  final _resolutionCtrl = TextEditingController();
  String? _error;
  bool _submitting = false;

  @override
  void dispose() {
    _resolutionCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_resolutionCtrl.text.trim().isEmpty) {
      setState(() => _error = widget.state.tr('direct.cancelReasonHint'));
      return;
    }
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      await widget.api.resolveDispute(
          widget.purchase.id, _resolutionCtrl.text.trim());
      widget.state.showToast(widget.state.tr('direct.disputeResolvedMsg'));
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
    return SheetScaffold(
      title: widget.state.tr('direct.resolveDisputeBtn'),
      error: _error,
      submitting: _submitting,
      submitLabel: widget.state.tr('direct.resolveDisputeBtn'),
      color: const Color(0xFFDC2626),
      onSubmit: _submit,
      children: [
        Container(
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
              Text(widget.state.tr('direct.qcDisputedNote'),
                  style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1B4332))),
              const SizedBox(height: 4),
              TextField(
                controller: _resolutionCtrl,
                maxLines: 3,
                decoration: InputDecoration.collapsed(
                    hintText: widget.state.tr('direct.resolutionHint')),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class RateSheet extends StatefulWidget {
  final AppState state;
  final PurchasesApi api;
  final Purchase purchase;
  final String target;

  const RateSheet({
    super.key,
    required this.state,
    required this.api,
    required this.purchase,
    required this.target,
  });

  static Future<bool> show(
    BuildContext context, {
    required AppState state,
    required PurchasesApi api,
    required Purchase purchase,
    required String target,
  }) =>
      _showSheet(context,
          RateSheet(state: state, api: api, purchase: purchase, target: target));

  @override
  State<RateSheet> createState() => _RateSheetState();
}

class _RateSheetState extends State<RateSheet> {
  int _rating = 5;
  final _reviewCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _reviewCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      await widget.api.rate(widget.purchase.id,
          target: widget.target,
          rating: _rating,
          review: _reviewCtrl.text.trim());
      widget.state.showToast(widget.state.tr('direct.rateSubmittedMsg'));
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
    final name = widget.target == 'farmer'
        ? widget.purchase.farmerName
        : widget.purchase.buyerName;
    final title = tr('direct.rateTitle').replaceAll('{name}', name);
    return SheetScaffold(
      title: title,
      error: _error,
      submitting: _submitting,
      submitLabel: title,
      color: const Color(0xFFF59E0B),
      onSubmit: _submit,
      children: [
        DirectStarRating(
            value: _rating, onChanged: (v) => setState(() => _rating = v)),
        const SizedBox(height: 10),
        Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: TextField(
            controller: _reviewCtrl,
            maxLines: 2,
            decoration: InputDecoration.collapsed(
                hintText: tr('direct.rateReviewHint')),
          ),
        ),
      ],
    );
  }
}

Future<bool> promptCancelPurchase(
  BuildContext context,
  AppState state,
  PurchasesApi api,
  Purchase purchase,
) async {
  final ctrl = TextEditingController();
  final reason = await showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(state.tr('direct.cancelPurchaseBtn'),
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      content: TextField(
        controller: ctrl,
        decoration: InputDecoration(
          hintText: state.tr('direct.cancelReasonHint'),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(state.tr('cancel'))),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white),
          onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
          child: Text(state.tr('direct.cancelPurchaseBtn')),
        ),
      ],
    ),
  );
  if (reason == null || reason.isEmpty) return false;
  try {
    await api.cancel(purchase.id, reason);
    state.showToast(state.tr('direct.demandUpdatedMsg'));
    return true;
  } on ApiException catch (e) {
    state.showToast(e.message);
    return false;
  }
}
