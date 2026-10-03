import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/direct_buyer_api.dart';
import '../../api/purchases_api.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';

class DirectBuySheet extends StatefulWidget {
  final AppState state;
  final PurchasesApi purchasesApi;
  final DirectBuyerApi directBuyerApi;
  final FeedLot lot;

  const DirectBuySheet({
    super.key,
    required this.state,
    required this.purchasesApi,
    required this.directBuyerApi,
    required this.lot,
  });

  static Future<bool> show(
    BuildContext context, {
    required AppState state,
    required PurchasesApi purchasesApi,
    required DirectBuyerApi directBuyerApi,
    required FeedLot lot,
  }) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => DirectBuySheet(
        state: state,
        purchasesApi: purchasesApi,
        directBuyerApi: directBuyerApi,
        lot: lot,
      ),
    );
    return ok == true;
  }

  @override
  State<DirectBuySheet> createState() => _DirectBuySheetState();
}

class _DirectBuySheetState extends State<DirectBuySheet> {
  late double _quantity;
  bool _submitting = false;
  String? _error;
  bool _saved = false;

  @override
  void initState() {
    super.initState();
    _quantity = widget.lot.quantityQuintals;
  }

  int get _total => (widget.lot.expectedRate * _quantity).round();

  Future<void> _buy() async {
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      await widget.purchasesApi.createPurchase(
        lotId: widget.lot.id,
        quantity: _quantity,
      );
      widget.state.showToast(widget.state.tr('direct.purchaseCreatedMsg'));
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _submitting = false;
      });
    }
  }

  Future<void> _saveFarmer() async {
    try {
      await widget.directBuyerApi.saveFarmer(widget.lot.farmerId);
      widget.state.showToast(widget.state.tr('direct.farmerSavedMsg'));
      if (mounted) setState(() => _saved = true);
    } on ApiException catch (e) {
      widget.state.showToast(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lot = widget.lot;
    final tr = widget.state.tr;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(lot.crop,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w900)),
                    if (lot.variety.isNotEmpty)
                      Text(lot.variety,
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade600)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text("₹${fmtInr(lot.expectedRate)}/q",
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF16A34A))),
                  Text(
                    "${lot.farmerName} • ${lot.farmerVillage}",
                    style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Text(tr('direct.quantityStepperLabel'),
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w800)),
                const Spacer(),
                _qtyBtn(Icons.remove_rounded, () {
                  final step = lot.quantityQuintals <= 10 ? 0.5 : 1.0;
                  setState(() => _quantity = (_quantity - step)
                      .clamp(step, lot.quantityQuintals));
                }),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Text("${_quantity.toStringAsFixed(1)} q",
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w900)),
                ),
                _qtyBtn(Icons.add_rounded, () {
                  final step = lot.quantityQuintals <= 10 ? 0.5 : 1.0;
                  setState(() => _quantity = (_quantity + step)
                      .clamp(step, lot.quantityQuintals));
                }),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(tr('direct.totalAmountLabel'),
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: Colors.grey.shade700)),
              Text("₹${fmtInr(_total)}",
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w900)),
            ],
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!,
                  style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFFDC2626),
                      fontWeight: FontWeight.w700)),
            ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _submitting ? null : _buy,
              icon: const Icon(Icons.shopping_cart_rounded, size: 18),
              label: Text(tr('direct.confirmBuy'),
                  style: const TextStyle(fontWeight: FontWeight.w900)),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF4F46E5),
                side: const BorderSide(color: Color(0xFF4F46E5)),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _saved ? null : _saveFarmer,
              icon: Icon(
                  _saved
                      ? Icons.bookmark_rounded
                      : Icons.bookmark_add_outlined,
                  size: 18),
              label: Text(tr('direct.saveFarmerBtn'),
                  style: const TextStyle(fontWeight: FontWeight.w900)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _qtyBtn(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: const Color(0xFF4F46E5).withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 18, color: const Color(0xFF4F46E5)),
      ),
    );
  }
}

class SaveFarmerButton extends StatelessWidget {
  final AppState state;
  final DirectBuyerApi api;
  final String farmerId;

  const SaveFarmerButton({
    super.key,
    required this.state,
    required this.api,
    required this.farmerId,
  });

  @override
  Widget build(BuildContext context) {
    return TextButton.icon(
      onPressed: () async {
        try {
          await api.saveFarmer(farmerId);
          state.showToast(state.tr('direct.farmerSavedMsg'));
        } on ApiException catch (e) {
          state.showToast(e.message);
        }
      },
      icon: const Icon(Icons.bookmark_add_outlined,
          size: 16, color: Color(0xFF4F46E5)),
      label: Text(state.tr('direct.saveFarmerBtn'),
          style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              color: Color(0xFF4F46E5))),
    );
  }
}
