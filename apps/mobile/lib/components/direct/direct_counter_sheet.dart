import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/offers_api.dart';
import '../../state/app_state.dart';

class DirectCounterSheet extends StatefulWidget {
  final AppState state;
  final OffersApi api;
  final String offerId;

  const DirectCounterSheet({
    super.key,
    required this.state,
    required this.api,
    required this.offerId,
  });

  static Future<bool> show(
    BuildContext context, {
    required AppState state,
    required OffersApi api,
    required String offerId,
  }) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding:
            EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: DirectCounterSheet(
            state: state, api: api, offerId: offerId),
      ),
    );
    return ok == true;
  }

  @override
  State<DirectCounterSheet> createState() => _DirectCounterSheetState();
}

class _DirectCounterSheetState extends State<DirectCounterSheet> {
  final _priceCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  String? _error;
  bool _submitting = false;

  @override
  void dispose() {
    _priceCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final price = int.tryParse(_priceCtrl.text.trim()) ?? 0;
    if (price <= 0) {
      setState(() => _error = widget.state.tr('direct.errMaxPriceRequired'));
      return;
    }
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      await widget.api.counter(
          widget.offerId, price, _noteCtrl.text.trim());
      widget.state.showToast(widget.state.tr('direct.counterSubmittedMsg'));
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
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.state.tr('direct.counterOfferBtn'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
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
                Text(widget.state.tr('direct.pricePerUnitLabel'),
                    style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1B4332))),
                const SizedBox(height: 4),
                TextField(
                  controller: _priceCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration.collapsed(
                      hintText: widget.state.tr('direct.counterPriceHint')),
                ),
              ],
            ),
          ),
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
                Text(widget.state.tr('direct.qcNoteLabel'),
                    style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1B4332))),
                const SizedBox(height: 4),
                TextField(
                  controller: _noteCtrl,
                  decoration: InputDecoration.collapsed(
                      hintText: widget.state.tr('direct.offerCounterNoteHint')),
                ),
              ],
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(_error!,
                  style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFFDC2626),
                      fontWeight: FontWeight.w700)),
            ),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF7C3AED),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _submitting ? null : _submit,
              child: Text(widget.state.tr('direct.counterOfferBtn'),
                  style: const TextStyle(fontWeight: FontWeight.w900)),
            ),
          ),
        ],
      ),
    );
  }
}
