import 'package:flutter/material.dart';
import '../common/motion_animations.dart';
import '../mandi/mandi_price_card.dart';

class CertificateDialog extends StatelessWidget {
  final Map<String, dynamic> product;
  final Map<String, dynamic> certificate;
  final VoidCallback onAddToCart;

  const CertificateDialog({
    super.key,
    required this.product,
    required this.certificate,
    required this.onAddToCart,
  });

  @override
  Widget build(BuildContext context) {
    final valid = certificate['valid'] == true;
    final price = (product['discountedPrice'] as num?) ?? 0;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Row(
        children: [
          Icon(Icons.verified_rounded, color: Color(0xFF16A34A), size: 22),
          SizedBox(width: 8),
          Flexible(
            child: Text(
              "100% Asli QR Certificate",
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
      content: Column(
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
        ],
      ),
      actions: [
        BouncyPressable(
          onTap: onAddToCart,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF43A047),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              "Add to Cart (₹${fmtInr(price)})",
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
            ),
          ),
        ),
      ],
    );
  }
}
