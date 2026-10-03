// Customer home sections — quick action grid & tappable top-products list.

import 'package:flutter/material.dart';

import '../../components/common/motion_animations.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/emarket_models.dart';
import '../../state/app_state.dart';

class CustomerQuickActionsGrid extends StatelessWidget {
  final AppState state;
  final Color personaColor;

  const CustomerQuickActionsGrid({
    super.key,
    required this.state,
    required this.personaColor,
  });

  @override
  Widget build(BuildContext context) {
    final actions = [
      (Icons.storefront_rounded, const Color(0xFF16A34A),
          state.tr('emarket.browseMarket'), 'marketplace'),
      (Icons.receipt_long_rounded, const Color(0xFF0284C7),
          state.tr('emarket.myOrders'), 'orderTracking'),
      (Icons.favorite_rounded, const Color(0xFFDB2777),
          state.tr('emarket.wishlist'), 'wishlist'),
      (Icons.local_offer_rounded, const Color(0xFFD97706),
          state.tr('emarket.coupons'), 'coupons'),
      (Icons.inventory_2_rounded, const Color(0xFFEA580C),
          state.tr('emarket.myProducts'), 'myProducts'),
      (Icons.location_on_rounded, const Color(0xFF8B5CF6),
          state.tr('emarket.myAddresses'), 'addressBook'),
      (Icons.help_rounded, const Color(0xFF14B8A6),
          state.tr('emarket.help'), 'helpSupport'),
    ];
    return Column(
      children: [
        for (var i = 0; i < actions.length; i += 2) ...[
          Row(
            children: [
              Expanded(child: _actionTile(actions[i])),
              const SizedBox(width: 10),
              Expanded(
                child: i + 1 < actions.length
                    ? _actionTile(actions[i + 1])
                    : const SizedBox.shrink(),
              ),
            ],
          ),
          if (i + 2 < actions.length) const SizedBox(height: 10),
        ],
      ],
    );
  }

  Widget _actionTile((IconData, Color, String, String) action) {
    final (icon, color, label, route) = action;
    return BouncyPressable(
      onTap: () => state.navigateTo(route),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: personaColor.withValues(alpha: 0.2)),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1E293B)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CustomerTopProductsList extends StatelessWidget {
  final AppState state;
  final List<TopProduct> products;
  final Color personaColor;

  const CustomerTopProductsList({
    super.key,
    required this.state,
    required this.products,
    required this.personaColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final p in products.take(5))
          BouncyPressable(
            onTap: () => _openProductSheet(context, p),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: personaColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.shopping_cart_rounded,
                        size: 16, color: personaColor),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 12.5, fontWeight: FontWeight.w800)),
                        Text(
                          "${p.quantity} × ₹${fmtInr(p.amount)}",
                          style: TextStyle(
                              fontSize: 10.5, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded,
                      color: Colors.grey.shade400),
                ],
              ),
            ),
          ),
      ],
    );
  }

  void _openProductSheet(BuildContext context, TopProduct p) {
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
            Text(p.title,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            Text(
              "${state.tr('emarket.totalOrders')}: ${p.quantity} • ${state.tr('emarket.totalSpent')}: ₹${fmtInr(p.amount)}",
              style: TextStyle(fontSize: 12.5, color: Colors.grey.shade700),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: personaColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  state.navigateTo('marketplace');
                },
                icon: const Icon(Icons.storefront_rounded, size: 18),
                label: Text(state.tr('emarket.browseMarket'),
                    style: const TextStyle(fontWeight: FontWeight.w900)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
