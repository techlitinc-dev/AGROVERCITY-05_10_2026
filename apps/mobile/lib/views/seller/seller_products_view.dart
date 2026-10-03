// Seller "My Products" — own catalog from GET /seller/products with real
// stock, inline stock stepper and add/edit form (POST/PUT /seller/products).

import 'package:flutter/material.dart';

import '../../api/seller_products_api.dart';
import '../../components/common/motion_animations.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/emarket_models.dart';
import '../../state/app_state.dart';
import 'seller_product_form_sheet.dart';

class SellerProductsView extends StatefulWidget {
  final AppState state;
  final SellerProductsApi? api;

  const SellerProductsView({super.key, required this.state, this.api});

  @override
  State<SellerProductsView> createState() => _SellerProductsViewState();
}

class _SellerProductsViewState extends State<SellerProductsView> {
  late final SellerProductsApi _api = widget.api ?? SellerProductsApi();
  List<SellerProduct> _products = [];
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

  Future<void> _openForm({SellerProduct? existing}) async {
    final saved = await SellerProductFormSheet.show(
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

  Future<void> _adjustStock(SellerProduct p, int delta) async {
    final next = p.stock + delta;
    if (next < 0) return;
    setState(() {
      _products = [
        for (final e in _products)
          e.id == p.id
              ? SellerProduct(
                  id: e.id,
                  title: e.title,
                  category: e.category,
                  brand: e.brand,
                  mrp: e.mrp,
                  discountedPrice: e.discountedPrice,
                  stock: next,
                  unit: e.unit,
                  description: e.description,
                  imageUrl: e.imageUrl,
                )
              : e,
      ];
    });
    try {
      await _api.update(p.id, stock: next);
    } catch (_) {
      await _load();
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
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text(
                    widget.state.tr('noProductsFound'),
                    style: const TextStyle(
                        fontSize: 13,
                        color: Colors.grey,
                        fontWeight: FontWeight.w700),
                  ),
                ),
              )
            else
              for (final p in _products) _productTile(p, lowStockIds.contains(p.id)),
          ],
        ),
      ),
    );
  }

  Widget _productTile(SellerProduct p, bool lowStock) {
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
                Text(
                  "${p.brand} • ${p.category} • ₹${fmtInr(p.discountedPrice)}${p.mrp > p.discountedPrice ? " (MRP ₹${fmtInr(p.mrp)})" : ''}",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600),
                ),
                if (lowStock)
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
        ],
      ),
    );
  }

  Widget _stockStepper(SellerProduct p) {
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
            child: const Padding(
              padding: EdgeInsets.all(6),
              child: Icon(Icons.remove_rounded, size: 14),
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
            child: const Padding(
              padding: EdgeInsets.all(6),
              child: Icon(Icons.add_rounded, size: 14),
            ),
          ),
        ],
      ),
    );
  }
}
