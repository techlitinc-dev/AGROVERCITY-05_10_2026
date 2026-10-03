// Wishlist screen — list saved products, remove, add to cart, open detail.

import 'package:flutter/material.dart';

import '../../api/wishlist_api.dart';
import '../../components/common/motion_animations.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../state/app_state.dart';

class WishlistView extends StatefulWidget {
  final AppState state;
  final WishlistApi? api;

  const WishlistView({super.key, required this.state, this.api});

  @override
  State<WishlistView> createState() => _WishlistViewState();
}

class _WishlistViewState extends State<WishlistView> {
  late final WishlistApi _api = widget.api ?? WishlistApi();
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await _api.getWishlist();
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _remove(Map<String, dynamic> product) async {
    final id = "${product['id']}";
    setState(() => _items.removeWhere((e) => "${e['id']}" == id));
    try {
      await _api.removeItem(id);
      widget.state.showToast(widget.state.tr('emarket.wishlistRemoved'));
    } catch (_) {
      await _load();
    }
  }

  Future<void> _addToCart(Map<String, dynamic> product) async {
    await widget.state.addToCartApi("${product['id']}");
  }

  void _openDetail(Map<String, dynamic> product) {
    final price = (product['discountedPrice'] as num?) ?? 0;
    final mrp = (product['mrp'] as num?) ?? 0;
    final inStock = product['inStock'] != false;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "${product['vernacularTitle'] ?? product['title']}",
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            Text(
              "${product['brand'] ?? ''} • ${product['category'] ?? ''}",
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Text(
                  "₹${fmtInr(price)}",
                  style: const TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w900),
                ),
                if (mrp > price) ...[
                  const SizedBox(width: 8),
                  Text(
                    "₹${fmtInr(mrp)}",
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFDC2626),
                      side: const BorderSide(color: Color(0xFFFCA5A5)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _remove(product);
                    },
                    icon: const Icon(Icons.delete_outline_rounded, size: 16),
                    label: Text(widget.state.tr('emarket.removeBtn'),
                        style: const TextStyle(fontWeight: FontWeight.w900)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: Colors.grey.shade300,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed:
                        inStock ? () => _addToCart(product) : null,
                    icon: const Icon(Icons.add_shopping_cart_rounded, size: 16),
                    label: Text(
                      inStock
                          ? "Add to Cart (₹${fmtInr(price)})"
                          : widget.state.tr('emarket.outOfStock'),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
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
            widget.state.tr('emarket.wishlistTitle'),
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
          else if (_items.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.favorite_border_rounded,
                        size: 44, color: Colors.grey.shade400),
                    const SizedBox(height: 8),
                    Text(
                      widget.state.tr('emarket.wishlistEmpty'),
                      style: const TextStyle(
                          fontSize: 13,
                          color: Colors.grey,
                          fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            )
          else
            for (final p in _items) _wishlistTile(p),
        ],
      ),
    );
  }

  Widget _wishlistTile(Map<String, dynamic> product) {
    final price = (product['discountedPrice'] as num?) ?? 0;
    final mrp = (product['mrp'] as num?) ?? 0;
    final inStock = product['inStock'] != false;
    final category = "${product['category'] ?? ''}";
    return BouncyPressable(
      onTap: () => _openDetail(product),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFF9A8D4).withValues(alpha: 0.6)),
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: const Color(0xFFFDF2F8),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  category.contains('Seeds')
                      ? '🌾'
                      : category.contains('Pesticide')
                          ? '🧴'
                          : category.contains('Fertilizer')
                              ? '🪨'
                              : category.contains('Vehicles')
                                  ? '🚜'
                                  : '🌱',
                  style: const TextStyle(fontSize: 22),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "${product['vernacularTitle'] ?? product['title']}",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w800),
                  ),
                  Text(
                    inStock
                        ? "${product['brand'] ?? ''} • ₹${fmtInr(price)}${mrp > price ? "  (MRP ₹${fmtInr(mrp)})" : ''}"
                        : widget.state.tr('emarket.outOfStock'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      color: inStock ? Colors.grey.shade600 : Colors.red,
                      fontWeight:
                          inStock ? FontWeight.w500 : FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              visualDensity: VisualDensity.compact,
              onPressed: () => _addToCart(product),
              icon: const Icon(Icons.add_shopping_cart_rounded,
                  size: 18, color: Color(0xFF16A34A)),
            ),
            IconButton(
              visualDensity: VisualDensity.compact,
              onPressed: () => _remove(product),
              icon: const Icon(Icons.delete_outline_rounded,
                  size: 18, color: Color(0xFFDC2626)),
            ),
          ],
        ),
      ),
    );
  }
}
