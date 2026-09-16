import 'package:flutter/material.dart';
import '../common/glass_card.dart';
import '../common/motion_animations.dart';
import '../mandi/mandi_price_card.dart';

class ProductCard extends StatelessWidget {
  final Map<String, dynamic> product;
  final VoidCallback onTap;
  final VoidCallback onAddToCart;

  const ProductCard({
    super.key,
    required this.product,
    required this.onTap,
    required this.onAddToCart,
  });

  @override
  Widget build(BuildContext context) {
    final category = "${product['category']}";
    final mrp = (product['mrp'] as num?) ?? 0;
    final price = (product['discountedPrice'] as num?) ?? 0;
    final bnpl = product['bnplAvailable'] == true;

    return GlassCard(
      backgroundColor: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: GestureDetector(
              onTap: onTap,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F7FA),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Text(
                      category.contains('Seeds')
                          ? '🌾'
                          : category.contains('Pesticide')
                              ? '🧴'
                              : category.contains('Fertilizer')
                                  ? '🪨'
                                  : category.contains('Vehicles')
                                      ? '🚜'
                                      : '🌱',
                      style: const TextStyle(fontSize: 42),
                    ),
                    Positioned(
                      top: 6,
                      right: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFA5D6A7)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.qr_code_rounded, size: 10, color: Color(0xFF2E7D32)),
                            SizedBox(width: 2),
                            Text("QR", style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.bold, color: Color(0xFF2E7D32))),
                          ],
                        ),
                      ),
                    ),
                    if (bnpl)
                      Positioned(
                        bottom: 6,
                        left: 6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF7ED),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFFDBA74)),
                          ),
                          child: const Text(
                            "0% BNPL",
                            style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: Color(0xFFEA580C)),
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
                  "${product['vernacularTitle']}",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF263238)),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  "${product['rating']} (${product['reviewsCount']})",
                  style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFF2E7D32)),
                ),
              ),
            ],
          ),
          Text(
            "${product['brand']} • Retailer- ${"${product['dealerName']}".split(' ').first} • ${product['distanceKm']}km",
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, color: Color(0xFF90A4AE)),
          ),
          Text(
            "Batch: ${product['batchNo']}",
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 9.5, color: Color(0xFFB0BEC5)),
          ),
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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "₹${fmtInr(mrp)}",
                    style: const TextStyle(
                      fontSize: 10.5,
                      color: Color(0xFF90A4AE),
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                  Text(
                    "₹${fmtInr(price)}",
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF263238)),
                  ),
                ],
              ),
              BouncyPressable(
                onTap: onAddToCart,
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
    );
  }
}
