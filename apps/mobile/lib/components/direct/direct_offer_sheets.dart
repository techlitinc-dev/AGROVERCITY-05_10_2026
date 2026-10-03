import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/offers_api.dart';
import '../../state/app_state.dart';

class DirectOfferSheet extends StatefulWidget {
  final AppState state;
  final OffersApi api;
  final String targetType;
  final String targetId;
  final double? defaultQuantity;
  final String unit;
  final bool askQuantity;

  const DirectOfferSheet({
    super.key,
    required this.state,
    required this.api,
    required this.targetType,
    required this.targetId,
    this.defaultQuantity,
    this.unit = 'quintal',
    this.askQuantity = false,
  });

  static Future<bool> show(
    BuildContext context, {
    required AppState state,
    required OffersApi api,
    required String targetType,
    required String targetId,
    double? defaultQuantity,
    String unit = 'quintal',
    bool askQuantity = false,
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
        child: DirectOfferSheet(
          state: state,
          api: api,
          targetType: targetType,
          targetId: targetId,
          defaultQuantity: defaultQuantity,
          unit: unit,
          askQuantity: askQuantity,
        ),
      ),
    );
    return ok == true;
  }

  @override
  State<DirectOfferSheet> createState() => _DirectOfferSheetState();
}

class _DirectOfferSheetState extends State<DirectOfferSheet> {
  final _priceCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController();
  final _msgCtrl = TextEditingController();
  String? _error;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final q = widget.defaultQuantity;
    if (widget.askQuantity && q != null) {
      _qtyCtrl.text = q == q.roundToDouble() ? q.toStringAsFixed(0) : '$q';
    }
  }

  @override
  void dispose() {
    _priceCtrl.dispose();
    _qtyCtrl.dispose();
    _msgCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final price = int.tryParse(_priceCtrl.text.trim()) ?? 0;
    double quantity = 0;
    if (widget.askQuantity) {
      quantity = double.tryParse(_qtyCtrl.text.trim()) ?? 0;
      if (quantity <= 0) {
        setState(() => _error = widget.state.tr('direct.errQuantityRequired'));
        return;
      }
    }
    if (price <= 0) {
      setState(() => _error = widget.state.tr('direct.errMaxPriceRequired'));
      return;
    }
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      await widget.api.createOffer(
        targetType: widget.targetType,
        targetId: widget.targetId,
        pricePerUnit: price,
        quantity: widget.askQuantity ? quantity : (widget.defaultQuantity ?? 0),
        message: _msgCtrl.text.trim(),
      );
      widget.state.showToast(widget.state.tr('direct.offerSentMsg'));
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
            widget.state.tr('direct.makeOfferTitle'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          if (widget.askQuantity)
            _field(
              widget.state.tr('direct.quantityLabel'),
              widget.state.tr('direct.quantityHint'),
              _qtyCtrl,
              TextInputType.number,
            ),
          _field(
            widget.state.tr('direct.pricePerUnitLabel'),
            widget.state.tr('direct.offerPriceHint'),
            _priceCtrl,
            TextInputType.number,
          ),
          _field(
            widget.state.tr('direct.messageLabel'),
            widget.state.tr('direct.messageHint'),
            _msgCtrl,
            TextInputType.text,
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
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _submitting ? null : _submit,
              icon: const Icon(Icons.send_rounded, size: 18),
              label: Text(
                widget.state.tr('direct.submitOfferBtn'),
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(
      String label, String hint, TextEditingController ctrl, TextInputType type) {
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
