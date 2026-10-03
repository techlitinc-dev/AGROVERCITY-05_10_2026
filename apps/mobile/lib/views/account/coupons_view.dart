// Coupons screen — active coupons from GET /coupons; tap copies the code.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/coupons_api.dart';
import '../../components/common/motion_animations.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/emarket_models.dart';
import '../../state/app_state.dart';

class CouponsView extends StatefulWidget {
  final AppState state;
  final CouponsApi? api;

  const CouponsView({super.key, required this.state, this.api});

  @override
  State<CouponsView> createState() => _CouponsViewState();
}

class _CouponsViewState extends State<CouponsView> {
  late final CouponsApi _api = widget.api ?? CouponsApi();
  List<Coupon> _coupons = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final coupons =
          await _api.list(cartTotal: widget.state.cartTotal);
      if (!mounted) return;
      setState(() {
        _coupons = coupons.where((c) => c.active).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _copy(Coupon coupon) async {
    await Clipboard.setData(ClipboardData(text: coupon.code));
    widget.state.showToast(widget.state.tr('emarket.codeCopied'));
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.state.tr('emarket.couponsTitle'),
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          if (_loading)
            Container(
              height: 72,
              decoration: BoxDecoration(
                color: Colors.grey.shade200,
                borderRadius: BorderRadius.circular(14),
              ),
            )
          else if (_coupons.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Center(
                child: Text(
                  widget.state.tr('emarket.couponsEmpty'),
                  style: const TextStyle(
                      fontSize: 13,
                      color: Colors.grey,
                      fontWeight: FontWeight.w700),
                ),
              ),
            )
          else
            for (final c in _coupons) _couponTile(c),
        ],
      ),
    );
  }

  Widget _couponTile(Coupon c) {
    final offLabel = c.type == 'percentage'
        ? widget.state
            .tr('emarket.percentageOff')
            .replaceAll('{value}', "${c.value.round()}")
        : widget.state
            .tr('emarket.flatOff')
            .replaceAll('{value}', fmtInr(c.value));
    return BouncyPressable(
      onTap: () => _copy(c),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFFDBA74)),
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: Icon(Icons.local_offer_rounded,
                    color: Color(0xFFEA580C), size: 24),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          c.code,
                          style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF9A3412),
                              letterSpacing: 0.5),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF16A34A),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          offLabel,
                          style: const TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w900,
                              color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                  if (c.description.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Text(
                        c.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 11, color: Colors.grey.shade700),
                      ),
                    ),
                  const SizedBox(height: 4),
                  Text(
                    "${widget.state.tr('emarket.minOrderLabel').replaceAll('{value}', fmtInr(c.minOrder))}"
                    "${c.maxDiscount > 0 ? " • ${widget.state.tr('emarket.maxDiscountLabel')} ₹${fmtInr(c.maxDiscount)}" : ''}"
                    "${c.validUntil.isNotEmpty ? " • ${widget.state.tr('emarket.validUntilLabel').replaceAll('{date}', c.validUntil.substring(0, c.validUntil.length > 10 ? 10 : c.validUntil.length))}" : ''}",
                    style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w700,
                        color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            Icon(Icons.copy_rounded, size: 18, color: Colors.grey.shade500),
          ],
        ),
      ),
    );
  }
}
