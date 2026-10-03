// Livestock & Dairy — dairy product card + buy dialog (split from
// livestock_dairy_view.dart for the line cap; verbatim styling).

import 'package:flutter/material.dart';

import '../components/common/glass_card.dart';
import '../models/livestock_models.dart';
import '../state/app_state.dart';

class DairyProductCard extends StatelessWidget {
  final AppState state;
  final DairyProductItem product;
  final VoidCallback onBuy;

  const DairyProductCard({super.key, required this.state, required this.product, required this.onBuy});

  @override
  Widget build(BuildContext context) {
    final p = product;
    return Opacity(
      opacity: p.inStock ? 1.0 : 0.55,
      child: GlassCard(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      p.category.contains("Ghee") ? "🧈" : (p.category.contains("Milk") ? "🥛" : (p.category.contains("Paneer") ? "🧀" : "🪵")),
                      style: const TextStyle(fontSize: 24),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.vernacularTitle,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                      ),
                      Text(
                        '${state.tr('livestock.producer')} ${p.farmName} • ${p.purityCertification}',
                        style: const TextStyle(fontSize: 10.5, color: Color(0xFF15803D), fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              p.description,
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF4B5563), height: 1.35),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "₹${p.price} / ${p.unit}",
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1B5E20)),
                    ),
                    Text('⭐ ${p.rating} (${p.reviewsCount} ${state.tr('livestock.customers')})', style: const TextStyle(fontSize: 10.5, color: Colors.grey, fontWeight: FontWeight.w600)),
                  ],
                ),
                if (p.inStock)
                  ElevatedButton.icon(
                    onPressed: onBuy,
                    icon: const Icon(Icons.shopping_bag_rounded, size: 14, color: Colors.white),
                    label: Text(state.tr('livestock.buyDirect'), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.white)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1B5E20),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFD1D5DB)),
                    ),
                    child: Text(
                      state.tr('livestock.outOfStock'),
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF6B7280)),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class DairyBuyDialog extends StatefulWidget {
  final AppState state;
  final DairyProductItem product;
  final void Function(int quantity) onSubmit;

  const DairyBuyDialog({
    super.key,
    required this.state,
    required this.product,
    required this.onSubmit,
  });

  @override
  State<DairyBuyDialog> createState() => _DairyBuyDialogState();
}

class _DairyBuyDialogState extends State<DairyBuyDialog> {
  int _quantity = 1;

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      title: Text(p.vernacularTitle, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            "₹${p.price} / ${p.unit} • ${p.purityCertification}",
            style: const TextStyle(fontSize: 12, color: Color(0xFF15803D), fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                icon: const Icon(Icons.remove_circle_outline_rounded, color: Color(0xFF1B5E20)),
              ),
              Text(
                "$_quantity",
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
              IconButton(
                onPressed: () => setState(() => _quantity++),
                icon: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFF1B5E20)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${widget.state.tr('livestock.total')}: ₹${p.price * _quantity}',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1B5E20)),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(widget.state.tr('cancel'))),
        ElevatedButton(
          onPressed: () {
            Navigator.pop(context);
            widget.onSubmit(_quantity);
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1B5E20),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: Text(widget.state.tr('livestock.confirmPurchase'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
        ),
      ],
    );
  }
}
