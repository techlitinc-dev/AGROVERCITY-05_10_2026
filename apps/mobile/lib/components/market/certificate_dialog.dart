import 'package:flutter/material.dart';
import '../../api/marketplace_api.dart';
import '../common/motion_animations.dart';
import '../mandi/mandi_price_card.dart';
import 'product_reviews_section.dart';

class CertificateDialog extends StatelessWidget {
  final Map<String, dynamic> product;
  final Map<String, dynamic> certificate;
  final VoidCallback onAddToCart;
  final MarketplaceApi? api;
  final String? currentUserId;
  final bool wishlisted;
  final VoidCallback? onToggleWishlist;

  const CertificateDialog({
    super.key,
    required this.product,
    required this.certificate,
    required this.onAddToCart,
    this.api,
    this.currentUserId,
    this.wishlisted = false,
    this.onToggleWishlist,
  });

  @override
  Widget build(BuildContext context) {
    final valid = certificate['valid'] == true;
    final price = (product['discountedPrice'] as num?) ?? 0;
    final inStock = product['inStock'] != false;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(
        children: [
          const Icon(Icons.verified_rounded, color: Color(0xFF16A34A), size: 22),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              "100% Asli QR Certificate",
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
          ),
          if (onToggleWishlist != null)
            IconButton(
              visualDensity: VisualDensity.compact,
              onPressed: onToggleWishlist,
              icon: Icon(
                wishlisted
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                size: 20,
                color: const Color(0xFFDB2777),
              ),
            ),
        ],
      ),
      content: SizedBox(
        width: double.maxFinite,
        height: MediaQuery.of(context).size.height * 0.62,
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFA5D6A7)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (valid) ...[
                          const Icon(Icons.check_circle_rounded, size: 14, color: Color(0xFF1B5E20)),
                          const SizedBox(width: 4),
                          const Text(
                            "Verified",
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF1B5E20)),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Expanded(
                          child: Text(
                            "${certificate['certifier']}",
                            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1B5E20)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      "${product['vernacularTitle']}",
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF263238)),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Batch: ${certificate['batchNo']}\n"
                      "Certificate No: ${certificate['certificateNo']}\n"
                      "Brand: ${product['brand']}\n"
                      "Dealer: ${product['dealerName']}\n"
                      "Verified At: ${certificate['verifiedAt']}",
                      style: const TextStyle(fontSize: 11.5, height: 1.4, color: Colors.black87),
                    ),
                  ],
                ),
              ),
              if (api != null)
                ProductReviewsSection(
                  api: api!,
                  productId: "${product['id']}",
                  currentUserId: currentUserId,
                ),
            ],
          ),
        ),
      ),
      actions: [
        BouncyPressable(
          onTap: inStock ? onAddToCart : () {},
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: inStock ? const Color(0xFF43A047) : Colors.grey.shade400,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              inStock
                  ? "Add to Cart (₹${fmtInr(price)})"
                  : "Out of stock",
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
            ),
          ),
        ),
      ],
    );
  }
}
