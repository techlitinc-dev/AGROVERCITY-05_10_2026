// Seller analytics summary card for the seller home — KPIs from
// GET /analytics/seller plus an expanding recent-orders list.

import 'package:flutter/material.dart';

import '../../api/analytics_api.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/emarket_models.dart';
import '../../state/app_state.dart';

class SellerAnalyticsCard extends StatefulWidget {
  final AppState state;
  final AnalyticsApi? api;
  final VoidCallback? onViewDetails;

  const SellerAnalyticsCard({
    super.key,
    required this.state,
    this.api,
    this.onViewDetails,
  });

  @override
  State<SellerAnalyticsCard> createState() => _SellerAnalyticsCardState();
}

class _SellerAnalyticsCardState extends State<SellerAnalyticsCard> {
  late final AnalyticsApi _api = widget.api ?? AnalyticsApi();
  SellerAnalytics? _analytics;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final a = await _api.getSeller();
      if (mounted) setState(() => _analytics = a);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final a = _analytics;
    if (a == null) return const SizedBox.shrink();
    final stats = [
      (widget.state.tr('emarket.revenue'), "₹${fmtInr(a.revenue)}",
          Icons.currency_rupee_rounded, const Color(0xFF16A34A)),
      (widget.state.tr('emarket.orders'), "${a.ordersCount}",
          Icons.receipt_long_rounded, const Color(0xFF0284C7)),
      (widget.state.tr('emarket.aov'), "₹${fmtInr(a.aov)}",
          Icons.trending_up_rounded, const Color(0xFF8B5CF6)),
      (widget.state.tr('emarket.returnRate'), "${a.returnRate.round()}%",
          Icons.assignment_return_rounded, const Color(0xFFD97706)),
    ];
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 10),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                widget.state.tr('emarket.sellerAnalyticsTitle'),
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1E293B)),
              ),
              if (widget.onViewDetails != null)
                GestureDetector(
                  onTap: widget.onViewDetails,
                  child: Text(
                    widget.state.tr('emarket.viewDetails'),
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFEA580C)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (var i = 0; i < stats.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    children: [
                      Icon(stats[i].$3, size: 16, color: stats[i].$4),
                      const SizedBox(height: 4),
                      Text(
                        stats[i].$2,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                            color: stats[i].$4),
                      ),
                      Text(
                        stats[i].$1,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 8.5,
                            fontWeight: FontWeight.w700,
                            color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
          if (a.recentOrders.isNotEmpty) ...[
            const Divider(height: 20),
            for (final o in a.recentOrders.take(3))
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        "#${o.id}",
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w800),
                      ),
                    ),
                    Text(
                      "₹${fmtInr(o.total)} • ${o.status}",
                      style: TextStyle(
                          fontSize: 10.5, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
          ],
          if (a.lowStock.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                "${widget.state.tr('emarket.lowStockWarn')}: ${a.lowStock.map((e) => e.title).take(3).join(', ')}",
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFEA580C)),
              ),
            ),
        ],
      ),
    );
  }
}
