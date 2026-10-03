// "My Products" — any logged-in user's own marketplace listings from
// GET /my-products with inline stock stepper, edit & delete (POST/PUT/DELETE).

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/my_products_api.dart';
import '../../components/common/motion_animations.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../components/market/product_form_sheet.dart';
import '../../models/emarket_models.dart';
import '../../state/app_state.dart';

class MyProductsView extends StatefulWidget {
  final AppState state;
  final MyProductsApi? api;

  const MyProductsView({super.key, required this.state, this.api});

  @override
  State<MyProductsView> createState() => _MyProductsViewState();
}

class _MyProductsViewState extends State<MyProductsView> {
  late final MyProductsApi _api = widget.api ?? MyProductsApi();
  List<UserProduct> _products = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final products = await _api.list();
      if (!mounted) return;
      setState(() {
        _products = products;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openForm({UserProduct? existing}) async {
    final saved = await ProductFormSheet.show(
      context,
      state: widget.state,
      api: _api,
      existing: existing,
    );
    if (saved == true) {
      widget.state.showToast(widget.state.tr('emarket.productSaved'));
      await _load();
    }
  }

  Future<void> _adjustStock(UserProduct p, int delta) async {
    final next = p.stock + delta;
    if (next < 0) return;
    setState(() {
      _products = [
        for (final e in _products) e.id == p.id ? e.copyWith(stock: next) : e,
      ];
    });
    try {
      await _api.update(p.id, {'stock': next});
    } catch (_) {
      await _load();
    }
  }

  Future<void> _confirmDelete(UserProduct p) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(widget.state.tr('emarket.deleteProductTitle'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Text(
          "${p.title}\n${widget.state.tr('emarket.deleteProductConfirm')}",
          style: const TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(widget.state.tr('cancel'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(widget.state.tr('emarket.deleteBtn')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.delete(p.id);
      if (!mounted) return;
      widget.state.showToast(widget.state.tr('emarket.productDeleted'));
      await _load();
    } on ApiException catch (e) {
      if (e.code == 'PRODUCT_HAS_ORDERS') {
        widget.state.showToast(widget.state.tr('emarket.productHasOrders'));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final lowStockIds = {
      for (final p in _products)
        if (p.stock < 10) p.id,
    };
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFEA580C),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: Text(
          widget.state.tr('emarket.addProduct'),
          style: const TextStyle(
              color: Colors.white, fontWeight: FontWeight.w900),
        ),
        onPressed: () => _openForm(),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 120),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.state.tr('emarket.myProducts'),
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                ),
                if (lowStockIds.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFDBA74)),
                    ),
                    child: Text(
                      "${widget.state.tr('emarket.lowStockWarn')}: ${lowStockIds.length}",
                      style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFEA580C)),
                    ),
                  ),
              ],
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
            else if (_products.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 40),
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.inventory_2_outlined,
                          size: 52, color: Colors.grey.shade400),
                      const SizedBox(height: 10),
                      Text(
                        widget.state.tr('emarket.myProductsEmpty'),
                        style: const TextStyle(
                            fontSize: 13,
                            color: Colors.grey,
                            fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 14),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEA580C),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: () => _openForm(),
                        icon: const Icon(Icons.add_rounded, size: 18),
                        label: Text(widget.state.tr('emarket.addProduct'),
                            style:
                                const TextStyle(fontWeight: FontWeight.w900)),
                      ),
                    ],
                  ),
                ),
              )
            else
              for (final p in _products)
                _productTile(p, lowStockIds.contains(p.id)),
          ],
        ),
      ),
    );
  }

  Widget _productTile(UserProduct p, bool lowStock) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: lowStock ? const Color(0xFFFDBA74) : const Color(0xFFE2E8F0),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: Icon(Icons.inventory_2_rounded,
                  color: Color(0xFFEA580C), size: 20),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  p.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        p.category,
                        style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w800,
                            color: Colors.grey.shade700),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      "₹${fmtInr(p.discountedPrice)}",
                      style: const TextStyle(
                          fontSize: 12.5, fontWeight: FontWeight.w900),
                    ),
                    if (p.mrp > p.discountedPrice)
                      Text(
                        " ₹${fmtInr(p.mrp)}",
                        style: const TextStyle(
                          fontSize: 10.5,
                          color: Colors.grey,
                          decoration: TextDecoration.lineThrough,
                        ),
                      ),
                  ],
                ),
                if (!p.inStock)
                  Text(
                    widget.state.tr('emarket.outOfStock'),
                    style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFDC2626)),
                  )
                else if (lowStock)
                  Text(
                    "${widget.state.tr('emarket.lowStockWarn')}: ${p.stock} ${p.unit}",
                    style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFEA580C)),
                  ),
              ],
            ),
          ),
          _stockStepper(p),
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: () => _openForm(existing: p),
            icon: const Icon(Icons.edit_outlined,
                size: 17, color: Color(0xFF0284C7)),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: () => _confirmDelete(p),
            icon: const Icon(Icons.delete_outline_rounded,
                size: 17, color: Color(0xFFDC2626)),
          ),
        ],
      ),
    );
  }

  Widget _stockStepper(UserProduct p) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          BouncyPressable(
            onTap: () => _adjustStock(p, -1),
            child: Semantics(
              label: widget.state.tr('emarket.decreaseStock'),
              button: true,
              child: const Padding(
                padding: EdgeInsets.all(6),
                child: Icon(Icons.remove_rounded, size: 14),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              "${p.stock}",
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
            ),
          ),
          BouncyPressable(
            onTap: () => _adjustStock(p, 1),
            child: Semantics(
              label: widget.state.tr('emarket.increaseStock'),
              button: true,
              child: const Padding(
                padding: EdgeInsets.all(6),
                child: Icon(Icons.add_rounded, size: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
