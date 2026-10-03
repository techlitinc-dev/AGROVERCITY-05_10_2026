import 'package:flutter/material.dart';

import '../../components/common/motion_animations.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/direct_buyer_models.dart';
import '../../models/user_profile_type.dart';
import '../../state/app_state.dart';
import 'direct_widgets.dart';

class DirectQuickActionsGrid extends StatelessWidget {
  final AppState state;
  final Color personaColor;

  const DirectQuickActionsGrid({
    super.key,
    required this.state,
    required this.personaColor,
  });

  @override
  Widget build(BuildContext context) {
    final actions = [
      (Icons.add_card_rounded, const Color(0xFF16A34A),
          state.tr('direct.newDemand'), 'demands'),
      (Icons.travel_explore_rounded, const Color(0xFF0284C7),
          state.tr('direct.browseLotsTitle'), 'browseLots'),
      (Icons.campaign_rounded, const Color(0xFFEA580C),
          state.tr('direct.demandsTitle'), 'demands'),
      (Icons.shopping_basket_rounded, const Color(0xFF7C3AED),
          state.tr('direct.purchasesTitle'), 'purchases'),
      (Icons.handshake_rounded, const Color(0xFFDB2777),
          state.tr('direct.myOffersTitle'), 'myOffers'),
      (Icons.bookmark_rounded, const Color(0xFF14B8A6),
          state.tr('direct.savedFarmersTitle'), 'savedFarmers'),
    ];
    return Column(
      children: [
        for (var i = 0; i < actions.length; i += 2) ...[
          Row(
            children: [
              Expanded(child: _tile(actions[i])),
              const SizedBox(width: 10),
              Expanded(
                child: i + 1 < actions.length
                    ? _tile(actions[i + 1])
                    : const SizedBox.shrink(),
              ),
            ],
          ),
          if (i + 2 < actions.length) const SizedBox(height: 10),
        ],
      ],
    );
  }

  Widget _tile((IconData, Color, String, String) action) {
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
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
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

class PriceVsMandiList extends StatelessWidget {
  final AppState state;
  final List<MandiComparison> items;

  const PriceVsMandiList({super.key, required this.state, required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Text(state.tr('direct.noDemands'),
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600));
    }
    return Column(
      children: [
        for (final m in items.take(6))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                Expanded(
                  child: Text(m.crop,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 12.5, fontWeight: FontWeight.w800)),
                ),
                Text("₹${m.avgPurchasePrice.toStringAsFixed(0)}",
                    style: const TextStyle(
                        fontSize: 12.5, fontWeight: FontWeight.w900)),
                const SizedBox(width: 10),
                Text(
                  "₹${m.mandiModalPrice?.toStringAsFixed(0) ?? '—'}",
                  style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: Colors.grey.shade600),
                ),
                const SizedBox(width: 10),
                if (m.mandiModalPrice != null)
                  _deltaChip(m.avgPurchasePrice, m.mandiModalPrice!),
              ],
            ),
          ),
      ],
    );
  }

  Widget _deltaChip(double mine, double mandi) {
    final diff = mine - mandi;
    final pct = mandi == 0 ? 0.0 : (diff / mandi) * 100;
    final better = diff <= 0;
    final color = better ? const Color(0xFF16A34A) : const Color(0xFFDC2626);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(
        "${diff >= 0 ? '+' : ''}${pct.toStringAsFixed(1)}%",
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: color),
      ),
    );
  }
}

class CropBreakdownBars extends StatelessWidget {
  final List<CropBreakdownItem> items;
  final Color color;

  const CropBreakdownBars({super.key, required this.items, required this.color});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    final top = items.take(5).toList();
    final maxSpend = top.map((e) => e.spend).fold(0.0, (a, b) => a > b ? a : b);
    return Column(
      children: [
        for (final c in top)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              children: [
                SizedBox(
                  width: 86,
                  child: Text(c.crop,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 11.5, fontWeight: FontWeight.w800)),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(
                      value: maxSpend == 0 ? 0 : c.spend / maxSpend,
                      minHeight: 10,
                      backgroundColor: color.withValues(alpha: 0.08),
                      valueColor: AlwaysStoppedAnimation(color),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text("₹${fmtInr(c.spend)}",
                    style: const TextStyle(
                        fontSize: 11.5, fontWeight: FontWeight.w900)),
              ],
            ),
          ),
      ],
    );
  }
}

class FeedLotsRow extends StatelessWidget {
  final AppState state;
  final List<FeedLot> lots;
  final void Function(FeedLot lot) onTap;

  const FeedLotsRow({
    super.key,
    required this.state,
    required this.lots,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 132,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        itemCount: lots.length,
        separatorBuilder: (context, index) => const SizedBox(width: 10),
        itemBuilder: (_, i) {
          final lot = lots[i];
          return BouncyPressable(
            onTap: () => onTap(lot),
            child: Container(
              width: 188,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFF4F46E5).withValues(alpha: 0.2)),
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 8),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(lot.crop,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w900)),
                      ),
                      Text("₹${fmtInr(lot.expectedRate)}/q",
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF16A34A))),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    "${qtyText(lot.quantityQuintals)} qtl • ${lot.variety.isEmpty ? '' : '${lot.variety} • '}${lot.harvestDate}",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600),
                  ),
                  const Spacer(),
                  Row(
                    children: [
                      Icon(Icons.person_rounded,
                          size: 13, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          "${lot.farmerName}${lot.farmerVillage.isEmpty ? '' : ' • ${lot.farmerVillage}'}",
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              color: Colors.grey.shade700),
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
    );
  }
}

class RecentPurchasesList extends StatelessWidget {
  final AppState state;
  final List<Purchase> purchases;
  final void Function(Purchase purchase) onTap;

  const RecentPurchasesList({
    super.key,
    required this.state,
    required this.purchases,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final p in purchases.take(5))
          BouncyPressable(
            onTap: () => onTap(p),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: purchaseStatusColor(p.status).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.shopping_basket_rounded,
                        size: 16, color: purchaseStatusColor(p.status)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("${p.crop} • ${qtyText(p.quantity)} ${p.unit}",
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 12.5, fontWeight: FontWeight.w800)),
                        Text(
                          "${state.activeProfile == UserProfileType.farmer ? p.buyerName : p.farmerName} • ₹${fmtInr(p.finalAmount ?? p.totalAmount)}",
                          style: TextStyle(
                              fontSize: 10.5, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                  DirectStatusChip(
                      label: purchaseStatusLabel(state, p.status),
                      color: purchaseStatusColor(p.status)),
                  Icon(Icons.chevron_right_rounded,
                      color: Colors.grey.shade400),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
