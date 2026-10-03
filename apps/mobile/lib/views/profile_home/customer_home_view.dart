// Customer (E-Market shopper) home dashboard — analytics from GET /analytics/customer.

import 'package:flutter/material.dart';

import '../../api/analytics_api.dart';
import '../../components/common/motion_animations.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../components/market/customer_home_sections.dart';
import '../../components/market/emarket_dashboard_widgets.dart';
import '../../components/navigation/dashboard_profile_switcher_bar.dart';
import '../../components/navigation/profile_switcher_sheet.dart';
import '../../models/emarket_models.dart';
import '../../models/user_profile_type.dart';
import '../../state/app_state.dart';

class CustomerHomeView extends StatefulWidget {
  final AppState state;
  final AnalyticsApi? analyticsApi;

  const CustomerHomeView({super.key, required this.state, this.analyticsApi});

  @override
  State<CustomerHomeView> createState() => _CustomerHomeViewState();
}

class _CustomerHomeViewState extends State<CustomerHomeView> {
  late final AnalyticsApi _api = widget.analyticsApi ?? AnalyticsApi();
  CustomerAnalytics? _analytics;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    try {
      final a = await _api.getCustomer();
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
    final meta = widget.state.activeProfileMeta;
    final a = _analytics;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          children: [
            _buildHeader(meta),
            const SizedBox(height: 14),
            if (_loading || a == null)
              Container(
                height: 84,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
              )
            else
              _statsRow(a),
            const SizedBox(height: 14),
            DashboardProfileSwitcherBar(state: widget.state),
            const SizedBox(height: 14),
            _sectionTitle(widget.state.tr('emarket.quickActions')),
            const SizedBox(height: 10),
            CustomerQuickActionsGrid(
              state: widget.state,
              personaColor: meta.primaryColor,
            ),
            const SizedBox(height: 14),
            if (a != null) ...[
              _sectionTitle(widget.state.tr('emarket.spendByCategory')),
              const SizedBox(height: 8),
              _chartCard(CategorySpendBars(
                items: a.categorySpend,
                color: meta.primaryColor,
              )),
              const SizedBox(height: 12),
              _sectionTitle(widget.state.tr('emarket.monthlySpend')),
              const SizedBox(height: 8),
              _chartCard(MonthlySpendChart(
                months: a.monthlySpend,
                color: meta.primaryColor,
              )),
              const SizedBox(height: 12),
              _sectionTitle(widget.state.tr('emarket.topProducts')),
              const SizedBox(height: 8),
              _chartCard(CustomerTopProductsList(
                state: widget.state,
                products: a.topProducts,
                personaColor: meta.primaryColor,
              )),
            ],
            const SizedBox(height: 100),
          ],
        ),
      ),
    );
  }

  Widget _statsRow(CustomerAnalytics a) {
    final stats = [
      (widget.state.tr('emarket.totalSpent'), "₹${fmtInr(a.totalSpent)}",
          Icons.currency_rupee_rounded, const Color(0xFF16A34A)),
      (widget.state.tr('emarket.totalOrders'), "${a.totalOrders}",
          Icons.receipt_long_rounded, const Color(0xFF0284C7)),
      (widget.state.tr('emarket.wishlistCount'), "${a.wishlistCount}",
          Icons.favorite_rounded, const Color(0xFFDB2777)),
      (widget.state.tr('emarket.pendingReturns'), "${a.pendingReturns}",
          Icons.assignment_return_rounded, const Color(0xFFD97706)),
    ];
    return Row(
      children: [
        for (var i = 0; i < stats.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: CustomerStatCard(
              label: stats[i].$1,
              value: stats[i].$2,
              icon: stats[i].$3,
              color: stats[i].$4,
            ),
          ),
        ],
      ],
    );
  }

  Widget _sectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
          fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
    );
  }

  Widget _chartCard(Widget child) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8),
        ],
      ),
      child: child,
    );
  }

  Widget _buildHeader(UserProfileMeta meta) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [meta.primaryColor, meta.accentColor],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: meta.primaryColor.withValues(alpha: 0.35),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.shopping_bag_rounded,
                        color: Colors.white, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      widget.state.tr('emarket.customerBadge'),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),
              BouncyPressable(
                onTap: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (ctx) => ProfileSwitcherSheet(state: widget.state),
                  );
                },
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(10),
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.4)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.swap_horiz_rounded,
                          color: Colors.white, size: 13),
                      SizedBox(width: 4),
                      Text("स्विच ▾",
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w900)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            widget.state
                .tr('emarket.greeting')
                .replaceAll('{name}', widget.state.profile.name),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.92),
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            widget.state.tr('emarket.customerTitle'),
            style: const TextStyle(
                color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            widget.state.tr('emarket.customerSubtitle'),
            style: TextStyle(
                color: Colors.white.withValues(alpha: 0.9), fontSize: 12),
          ),
        ],
      ),
    );
  }
}
