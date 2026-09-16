// Module E: E-Marketplace View (API-wired) — catalog, QR certificate, cart bar.

import 'dart:async';
import 'package:flutter/material.dart';
import '../api/api_exception.dart';
import '../api/marketplace_api.dart';
import '../state/app_state.dart';
import '../components/common/motion_animations.dart';
import '../components/market/cart_bar.dart';
import '../components/market/certificate_dialog.dart';
import '../components/market/product_card.dart';
import 'checkout_sheet.dart';

class MarketplaceView extends StatefulWidget {
  final AppState state;
  final MarketplaceApi? marketplaceApi;

  const MarketplaceView({super.key, required this.state, this.marketplaceApi});

  @override
  State<MarketplaceView> createState() => _MarketplaceViewState();
}

class _MarketplaceViewState extends State<MarketplaceView> {
  late final MarketplaceApi _api = widget.marketplaceApi ?? MarketplaceApi();
  String? _activeCategory;
  String _query = '';
  Timer? _debounce;
  List<Map<String, dynamic>> _products = [];
  bool _loading = true;
  bool _error = false;

  static const _categories = [
    {'id': 'Seeds', 'label': 'Seeds', 'icon': '🌱'},
    {'id': 'Vehicles', 'label': 'Vehicles', 'icon': '🚜'},
    {'id': 'Fertilizer', 'label': 'Fertilizers', 'icon': '🪨'},
    {'id': 'Pesticide', 'label': 'Insecticide', 'icon': '🧴'},
    {'id': 'Tools', 'label': 'Tools', 'icon': '🧰'},
  ];

  @override
  void initState() {
    super.initState();
    _load();
    widget.state.refreshCart().catchError((_) {});
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
          onAddToCart: () {
            Navigator.pop(ctx);
            widget.state.addToCartApi("${product['id']}");
          },
        ),
      );
    } on ApiException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("प्रमाणपत्र उपलब्ध नहीं")),
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
          // Header
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("E-Market", style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                  Text("Reliable online market", style: TextStyle(fontSize: 12, color: Color(0xFF90A4AE))),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Search Bar with mic
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFECEFF1)),
            ),
            child: Row(
              children: [
                const Icon(Icons.search_rounded, color: Color(0xFF90A4AE), size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    onChanged: _onSearchChanged,
                    decoration: const InputDecoration(
                      hintText: "Seeds, vehicles, fertilizers, vegetables",
                      hintStyle: TextStyle(fontSize: 12.5, color: Color(0xFF90A4AE)),
                      border: InputBorder.none,
                    ),
                  ),
                ),
                const Icon(Icons.mic_none_rounded, color: Color(0xFF90A4AE), size: 20),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 5 Category chips
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: _categories.map((c) {
              final isSel = _activeCategory == c['id'];
              return BouncyPressable(
                onTap: () {
                  _activeCategory = isSel ? null : c['id'];
                  _load();
                },
                child: Container(
                  width: 62,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: isSel ? const Color(0xFF43A047) : const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      Text(c['icon']!, style: const TextStyle(fontSize: 22)),
                      const SizedBox(height: 4),
                      Text(
                        c['label']!,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: isSel ? Colors.white : const Color(0xFF2E7D32),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),

          if (_error)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFFDBA74)),
              ),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      "कैटलॉग लोड नहीं हुआ",
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF9A3412)),
                    ),
                  ),
                  TextButton(
                    onPressed: _load,
                    child: const Text("पुनः प्रयास करें", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFFEA580C))),
                  ),
                ],
              ),
            ),

          // Products grid
          if (_loading)
            GridView.count(
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
            )
          else if (!_error && _products.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text("कोई उत्पाद नहीं मिला", style: TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.w700)),
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
}
