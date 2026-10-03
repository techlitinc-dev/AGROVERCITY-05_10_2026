// Checkout coupon section — input + apply, applied chip with remove, and
// discount/final-total rows. Parent owns the CouponsApi call via onApply.

import 'package:flutter/material.dart';

import '../../components/mandi/mandi_price_card.dart';
import '../../state/app_state.dart';

class CouponApplySection extends StatefulWidget {
  final AppState state;
  final int cartTotal;
  final String? appliedCode;
  final double discount;
  final double finalTotal;

  /// Returns an error message to display, or null when the coupon applied.
  final Future<String?> Function(String code) onApply;
  final VoidCallback onRemove;

  const CouponApplySection({
    super.key,
    required this.state,
    required this.cartTotal,
    required this.appliedCode,
    required this.discount,
    required this.finalTotal,
    required this.onApply,
    required this.onRemove,
  });

  @override
  State<CouponApplySection> createState() => _CouponApplySectionState();
}

class _CouponApplySectionState extends State<CouponApplySection> {
  final TextEditingController _controller = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _apply() async {
    final code = _controller.text.trim();
    if (code.isEmpty || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final error = await widget.onApply(code);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _error = error;
      if (error == null) _controller.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final applied = widget.appliedCode;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.state.tr('emarket.applyCoupon'),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 8),
        if (applied == null)
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    hintText: widget.state.tr('emarket.couponPlaceholder'),
                    hintStyle: const TextStyle(
                        fontSize: 12, color: Color(0xFF90A4AE)),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEA580C),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _busy ? null : _apply,
                child: Text(
                  _busy ? "..." : widget.state.tr('emarket.applyBtn'),
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          )
        else
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFDBA74)),
            ),
            child: Row(
              children: [
                const Icon(Icons.local_offer_rounded,
                    size: 16, color: Color(0xFFEA580C)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    "$applied • ${widget.state.tr('emarket.discountLabel')} ₹${fmtInr(widget.discount)}",
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF9A3412)),
                  ),
                ),
                GestureDetector(
                  onTap: widget.onRemove,
                  child: const Icon(Icons.close_rounded,
                      size: 16, color: Color(0xFFEA580C)),
                ),
              ],
            ),
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              _error!,
              style: const TextStyle(fontSize: 11.5, color: Color(0xFFDC2626)),
            ),
          ),
        if (applied != null) ...[
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "${widget.state.tr('emarket.discountLabel')}:",
                style:
                    const TextStyle(fontSize: 12, color: Color(0xFF16A34A)),
              ),
              Text(
                "− ₹${fmtInr(widget.discount)}",
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF16A34A)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "${widget.state.tr('emarket.finalTotalLabel')}:",
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w900),
              ),
              Text(
                "₹${fmtInr(widget.finalTotal)}",
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w900),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
