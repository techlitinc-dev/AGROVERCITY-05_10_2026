// Module E: E-Marketplace View (API-wired) — catalog, QR certificate, cart bar.

import 'dart:async';
import 'package:flutter/material.dart';
import '../api/api_exception.dart';
import '../api/marketplace_api.dart';
import '../api/wishlist_api.dart';
import '../state/app_state.dart';
import '../components/common/motion_animations.dart';
import '../components/market/cart_bar.dart';
import '../components/market/certificate_dialog.dart';
import '../components/market/market_browse_header.dart';
import '../components/market/product_card.dart';
import 'checkout_sheet.dart';

class MarketplaceView extends StatefulWidget {
  final AppState state;
  final MarketplaceApi? marketplaceApi;
  final WishlistApi? wishlistApi;

  const MarketplaceView({
    super.key,
    required this.state,
    this.marketplaceApi,
    this.wishlistApi,
  });

  @override
  State<MarketplaceView> createState() => _MarketplaceViewState();
}

class _MarketplaceViewState extends State<MarketplaceView> {
  late final MarketplaceApi _api = widget.marketplaceApi ?? MarketplaceApi();
  late final WishlistApi _wishlistApi =
      widget.wishlistApi ?? WishlistApi();
  final Set<String> _wishlistIds = {};
  String? _activeCategory;
  String _query = '';
  Timer? _debounce;
  List<Map<String, dynamic>> _products = [];
  bool _loading = true;
  bool _error = false;


  @override
  void initState() {
    super.initState();
    _load();
    widget.state.refreshCart().catchError((_) {});
    _loadWishlist();
  }

  Future<void> _loadWishlist() async {
    try {
      final items = await _wishlistApi.getWishlist();
      if (!mounted) return;
      setState(() {
        _wishlistIds
          ..clear()
          ..addAll(items.map((e) => "${e['id']}"));
      });
    } catch (_) {}
  }

  Future<void> _toggleWishlist(Map<String, dynamic> product) async {
    final id = "${product['id']}";
    final wasSaved = _wishlistIds.contains(id);
    setState(() {
      if (wasSaved) {
        _wishlistIds.remove(id);
      } else {
        _wishlistIds.add(id);
      }
    });
    try {
      if (wasSaved) {
        await _wishlistApi.removeItem(id);
        widget.state.showToast(widget.state.tr('emarket.wishlistRemoved'));
      } else {
        await _wishlistApi.addItem(id);
        widget.state.showToast(widget.state.tr('emarket.wishlistAdded'));
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        if (wasSaved) {
          _wishlistIds.add(id);
        } else {
          _wishlistIds.remove(id);
        }
      });
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final res = await _api.getProducts(
        category: _activeCategory,
        query: _query.isEmpty ? null : _query,
      );
      if (!mounted) return;
      setState(() {
        _products = (res['data'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _products = const [];
        _loading = false;
        _error = true;
      });
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      _query = value.trim();
      _load();
    });
  }

  Future<void> _openCertificate(Map<String, dynamic> product) async {
    try {
      final cert = await _api.getCertificate("${product['id']}");
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (ctx) => CertificateDialog(
          product: product,
          certificate: cert,
          api: _api,
          currentUserId: "${widget.state.currentUser?['id'] ?? ''}",
          onAddToCart: () {
            Navigator.pop(ctx);
            widget.state.addToCartApi("${product['id']}");
          },
          wishlisted: _wishlistIds.contains("${product['id']}"),
          onToggleWishlist: () => _toggleWishlist(product),
        ),
      );
    } on ApiException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.state.tr('certificateNotAvailable'))),
      );
    }
  }

  void _openCheckout() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => CheckoutSheet(state: widget.state),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MarketBrowseHeader(
            state: widget.state,
            activeCategory: _activeCategory,
            onCategoryChanged: (category) {
              _activeCategory = category;
              _load();
            },
            onSearchChanged: _onSearchChanged,
          ),

          if (_error)
            _errorBanner()
          else if (_loading)
            _shimmerGrid()
          else if (_products.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(widget.state.tr('noProductsFound'), style: const TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.w700)),
              ),
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 0.82,
              ),
              itemCount: _products.length,
              itemBuilder: (context, index) {
                final p = _products[index];
                return StaggeredSlideFade(
                  delayMs: index * 60,
                  child: ProductCard(
                    product: p,
                    onTap: () => _openCertificate(p),
                    onAddToCart: () => widget.state.addToCartApi("${p['id']}"),
                    wishlisted: _wishlistIds.contains("${p['id']}"),
                    onToggleWishlist: () => _toggleWishlist(p),
                  ),
                );
              },
            ),

          // Cart bar
          CartBar(state: widget.state, onCheckout: _openCheckout),
        ],
      ),
    );
  }

  Widget _shimmerGrid() {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 0.82,
      children: [
        for (var i = 0; i < 4; i++)
          Container(
            decoration: BoxDecoration(
              color: Colors.grey.shade200,
              borderRadius: BorderRadius.circular(16),
            ),
          ),
      ],
    );
  }

  Widget _errorBanner() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFDBA74)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              widget.state.tr('noDataAvailable'),
              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF9A3412)),
            ),
          ),
          TextButton(
            onPressed: _load,
            child: Text(widget.state.tr('retry'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFFEA580C))),
          ),
        ],
      ),
    );
  }
}
