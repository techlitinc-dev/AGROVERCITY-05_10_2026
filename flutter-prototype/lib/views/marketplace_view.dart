// Module E: E-Marketplace View aligned with Reference p3.png (Middle Screen) & Motion Animation

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../data/demo_data.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';
import '../components/common/motion_animations.dart';

class MarketplaceView extends StatefulWidget {
  final AppState state;
  const MarketplaceView({super.key, required this.state});

  @override
  State<MarketplaceView> createState() => _MarketplaceViewState();
}

class _MarketplaceViewState extends State<MarketplaceView> {
  String _activeCategory = 'all';

  void _showQrCertificate(InputProduct p) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.verified_rounded, color: Color(0xFF16A34A), size: 22),
            SizedBox(width: 8),
            Text("100% Asli QR Certificate", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFA5D6A7))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("✅ Govt Agmark & Ministry Certified", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1B5E20))),
                  const SizedBox(height: 6),
                  Text(p.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF263238))),
                  const SizedBox(height: 4),
                  Text("Batch: ${p.batchNo}\nBrand: ${p.brand}\nDealer: ${p.dealerName}", style: const TextStyle(fontSize: 11.5, height: 1.4, color: Colors.black87)),
                ],
              ),
            ),
          ],
        ),
        actions: [
          BouncyPressable(
            onTap: () {
              Navigator.pop(ctx);
              widget.state.addToCart(p);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF43A047),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text("Add to Cart (₹${p.discountedPrice})", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final products = dummyProducts.where((p) {
      if (_activeCategory == 'all') return true;
      return p.category.contains(_activeCategory);
    }).toList();

    final categories = [
      {'id': 'Seeds', 'label': 'Seeds', 'icon': '🌱'},
      {'id': 'Vehicles', 'label': 'Vehicles', 'icon': '🚜'},
      {'id': 'Fertilizer', 'label': 'Fertilizers', 'icon': '🪨'},
      {'id': 'Pesticide', 'label': 'Insecticide', 'icon': '🧴'},
      {'id': 'Tools', 'label': 'Tools', 'icon': '🧰'},
    ];

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // E-Market Top Header & Title matching p3.png (Middle Phone)
          StaggeredSlideFade(
            delayMs: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("E-Market", style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                    Text("Reliable online market", style: TextStyle(fontSize: 12, color: Color(0xFF90A4AE))),
                  ],
                ),
                Row(
                  children: [
                    BouncyPressable(
                      onTap: () => widget.state.navigateTo('advisory'),
                      child: const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF43A047)),
                    ),
                    const SizedBox(width: 12),
                    BouncyPressable(
                      onTap: () => widget.state.showToast("Offers updated!"),
                      child: Stack(
                        children: [
                          const Icon(Icons.notifications_none_rounded, color: Color(0xFF43A047)),
                          Positioned(
                            right: 0,
                            top: 0,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                              child: const Text("4", style: TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.bold)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Search Bar matching p3.png
          StaggeredSlideFade(
            delayMs: 60,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFECEFF1)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.search_rounded, color: Color(0xFF90A4AE), size: 20),
                  SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      decoration: InputDecoration(
                        hintText: "Seeds, vehicles, fertilizers, vegetables",
                        hintStyle: TextStyle(fontSize: 12.5, color: Color(0xFF90A4AE)),
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                  Icon(Icons.mic_none_rounded, color: Color(0xFF90A4AE), size: 20),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 5 Category Icons Row matching p3.png (Seeds, Vehicles, Fertilizers, Insecticide, Tools)
          StaggeredSlideFade(
            delayMs: 120,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: categories.map((c) {
                final isSel = _activeCategory == c['id'];
                return BouncyPressable(
                  onTap: () => setState(() => _activeCategory = isSel ? 'all' : c['id']!),
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
          ),
          const SizedBox(height: 16),

          // Promo Banner "Roma Tomato" matching p3.png (Middle Phone)
          StaggeredSlideFade(
            delayMs: 180,
            child: ShimmerGlowEffect(
              duration: const Duration(seconds: 3),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFFF176), Color(0xFFFBC02D)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "Roma Tomato",
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF263238)),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            "✓ Choose healthy seeds\n✓ Prepare the soil\n✓ Water regularly",
                            style: TextStyle(fontSize: 11, height: 1.4, color: Color(0xFF5D4037)),
                          ),
                          const SizedBox(height: 10),
                          BouncyPressable(
                            onTap: () => widget.state.showToast("Roma Tomato seeds selected!"),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Text("Get Seeds", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 90,
                      height: 90,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white,
                      ),
                      child: const Center(
                        child: Text("🍅", style: TextStyle(fontSize: 54)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),

          // Section Header "Popular Goods" - "See all" matching p3.png
          StaggeredSlideFade(
            delayMs: 240,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text("Popular Goods", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                BouncyPressable(
                  onTap: () => setState(() => _activeCategory = 'all'),
                  child: const Text("See all", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF43A047))),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Products List / Cards matching p3.png with Staggered Cascades
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 0.82,
            ),
            itemCount: products.length,
            itemBuilder: (context, index) {
              final p = products[index];
              return StaggeredSlideFade(
                delayMs: 280 + (index * 60),
                child: GlassCard(
                  backgroundColor: Colors.white,
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _showQrCertificate(p),
                          child: Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFFF5F7FA),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                Text(
                                  p.category.contains('Seeds') ? '🌾' : (p.category.contains('Pesticide') ? '🧴' : '🌱'),
                                  style: const TextStyle(fontSize: 42),
                                ),
                                Positioned(
                                  top: 6,
                                  right: 6,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFA5D6A7))),
                                    child: const Row(
                                      children: [
                                        Icon(Icons.qr_code_rounded, size: 10, color: Color(0xFF2E7D32)),
                                        SizedBox(width: 2),
                                        Text("QR", style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.bold, color: Color(0xFF2E7D32))),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              p.vernacularTitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF263238)),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(6)),
                            child: Text("${p.rating}", style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF2E7D32))),
                          ),
                        ],
                      ),
                      Text("Retailer- ${p.dealerName.split(' ')[0]}", style: const TextStyle(fontSize: 11, color: Color(0xFF90A4AE))),
                      const SizedBox(height: 4),
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text("⏱ 25min", style: TextStyle(fontSize: 10, color: Color(0xFF90A4AE))),
                          Text("Free delivery", style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF43A047))),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text("₹${p.discountedPrice}", style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                          BouncyPressable(
                            onTap: () => widget.state.addToCart(p),
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: const BoxDecoration(
                                color: Color(0xFFE8F5E9),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.add_shopping_cart_rounded, size: 16, color: Color(0xFF43A047)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),

          if (widget.state.cart.isNotEmpty) ...[
            const SizedBox(height: 16),
            StaggeredSlideFade(
              delayMs: 100,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF2E7D32),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("Cart: ${widget.state.cart.length} items", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
                        Text("Total: ₹${widget.state.cartTotal} (0% BNPL)", style: const TextStyle(color: Color(0xFFE8F5E9), fontSize: 11.5)),
                      ],
                    ),
                    BouncyPressable(
                      onTap: () => widget.state.clearCart(),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text("Confirm Order →", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF2E7D32))),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}


