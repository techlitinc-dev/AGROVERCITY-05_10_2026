import 'package:flutter/material.dart';

import '../../api/purchases_api.dart';
import '../../components/common/motion_animations.dart';
import '../../components/direct/direct_widgets.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/direct_buyer_models.dart';
import '../../models/user_profile_type.dart';
import '../../state/app_state.dart';

class PurchasesView extends StatefulWidget {
  final AppState state;
  final PurchasesApi? purchasesApi;

  const PurchasesView({super.key, required this.state, this.purchasesApi});

  @override
  State<PurchasesView> createState() => _PurchasesViewState();
}

class _PurchasesViewState extends State<PurchasesView> {
  late final PurchasesApi _api = widget.purchasesApi ?? PurchasesApi();
  List<Purchase> _purchases = const [];
  bool _loading = true;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool get _isFarmer => widget.state.activeProfile == UserProfileType.farmer;

  Future<void> _load() async {
    try {
      final res = await _api.listPurchases(role: _isFarmer ? 'farmer' : null);
      if (!mounted) return;
      setState(() {
        _purchases = ((res['data'] as List?) ?? const <dynamic>[])
            .map((e) => Purchase.fromJson((e as Map).cast<String, dynamic>()))
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _purchases = const [];
          _loading = false;
        });
      }
    }
  }

  List<Purchase> get _filtered => _filter == 'all'
      ? _purchases
      : _purchases.where((p) => p.status == _filter).toList();

  @override
  Widget build(BuildContext context) {
    final tr = widget.state.tr;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
          children: [
            Text(tr('direct.purchasesTitle'),
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(tr('direct.purchasesSubtitle'),
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final f in const [
                    'all',
                    'confirmed',
                    'advancePaid',
                    'inTransit',
                    'delivered',
                    'qcDisputed',
                    'completed',
                  ]) ...[
                    if (f != 'all') const SizedBox(width: 8),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: ChoiceChip(
                        label: Text(f == 'all'
                            ? tr('direct.allLabel')
                            : purchaseStatusLabel(widget.state, f)),
                        selected: _filter == f,
                        onSelected: (_) => setState(() => _filter = f),
                        selectedColor: const Color(0xFF4F46E5),
                        labelStyle: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: _filter == f ? Colors.white : Colors.black87),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (_loading)
              Container(
                height: 90,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
              )
            else if (_filtered.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: DirectEmptyState(
                    icon: Icons.shopping_basket_outlined,
                    message: tr('direct.noPurchases')),
              )
            else
              for (final p in _filtered) _purchaseCard(p),
          ],
        ),
      ),
    );
  }

  Widget _purchaseCard(Purchase p) {
    final counterparty = _isFarmer ? p.buyerName : p.farmerName;
    return BouncyPressable(
      onTap: () => widget.state.openPurchaseDetail(p.id),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: purchaseStatusColor(p.status).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(Icons.shopping_basket_rounded,
                  size: 18, color: purchaseStatusColor(p.status)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "${p.crop} • ${qtyText(p.quantity)} ${p.unit}",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    "$counterparty • ₹${fmtInr(p.finalAmount ?? p.totalAmount)}",
                    style: TextStyle(
                        fontSize: 11.5, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                DirectStatusChip(
                    label: purchaseStatusLabel(widget.state, p.status),
                    color: purchaseStatusColor(p.status)),
                const SizedBox(height: 4),
                Icon(Icons.chevron_right_rounded,
                    size: 18, color: Colors.grey.shade400),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
