// Seller analytics page — full GET /analytics/seller breakdown.

import 'package:flutter/material.dart';

import '../../api/analytics_api.dart';
import '../../components/market/emarket_dashboard_widgets.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/emarket_models.dart';
import '../../state/app_state.dart';

class SellerAnalyticsView extends StatefulWidget {
  final AppState state;
  final AnalyticsApi? api;

  const SellerAnalyticsView({super.key, required this.state, this.api});

  @override
  State<SellerAnalyticsView> createState() => _SellerAnalyticsViewState();
}

class _SellerAnalyticsViewState extends State<SellerAnalyticsView> {
  late final AnalyticsApi _api = widget.api ?? AnalyticsApi();
  SellerAnalytics? _analytics;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final a = await _api.getSeller();
      if (!mounted) return;
      setState(() {
        _analytics = a;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = _analytics;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        onRefresh: _load,
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.state.tr('emarket.sellerAnalyticsTitle'),
                style: const TextStyle(
                    fontSize: 20, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              if (_loading || a == null)
                Container(
                  height: 90,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(14),
                  ),
                )
              else ...[
                Row(
                  children: [
                    Expanded(
                      child: CustomerStatCard(
                        label: widget.state.tr('emarket.revenue'),
                        value: "₹${fmtInr(a.revenue)}",
                        icon: Icons.currency_rupee_rounded,
                        color: const Color(0xFF16A34A),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: CustomerStatCard(
                        label: widget.state.tr('emarket.orders'),
                        value: "${a.ordersCount}",
                        icon: Icons.receipt_long_rounded,
                        color: const Color(0xFF0284C7),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: CustomerStatCard(
                        label: widget.state.tr('emarket.itemsSold'),
                        value: "${a.itemsSold}",
                        icon: Icons.inventory_2_rounded,
                        color: const Color(0xFF8B5CF6),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: CustomerStatCard(
                        label: widget.state.tr('emarket.returnRate'),
                        value: "${a.returnRate.round()}%",
                        icon: Icons.assignment_return_rounded,
                        color: const Color(0xFFD97706),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _section(widget.state.tr('emarket.monthlyRevenueTitle'),
                    MonthlySpendChart(months: a.monthlyRevenue, color: const Color(0xFFEA580C))),
                _section(widget.state.tr('emarket.categoryBreakdownTitle'),
                    CategorySpendBars(items: a.categoryBreakdown, color: const Color(0xFFEA580C))),
                _section(
                  widget.state.tr('emarket.topProducts'),
                  Column(
                    children: [
                      for (final p in a.topProducts)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(p.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w800)),
                              ),
                              Text(
                                "${p.quantity} × ₹${fmtInr(p.amount)}",
                                style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.grey.shade600),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                _section(
                  widget.state.tr('emarket.recentOrdersTitle'),
                  Column(
                    children: [
                      for (final o in a.recentOrders)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text("#${o.id}",
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800)),
                              ),
                              Text(
                                "₹${fmtInr(o.total)} • ${o.status}",
                                style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.grey.shade600),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _section(String title, Widget child) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}
