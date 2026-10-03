import 'package:flutter/material.dart';

import '../../api/direct_buyer_api.dart';
import '../../api/purchases_api.dart';
import '../../components/direct/direct_buy_sheet.dart';
import '../../components/direct/direct_home_sections.dart';
import '../../components/direct/direct_widgets.dart';
import '../../components/market/emarket_dashboard_widgets.dart';
import '../../components/navigation/dashboard_profile_switcher_bar.dart';
import '../../components/navigation/profile_switcher_sheet.dart';
import '../../components/common/motion_animations.dart';
import '../../models/direct_buyer_models.dart';
import '../../models/user_profile_type.dart';
import '../../state/app_state.dart';

class DirectBuyerHomeView extends StatefulWidget {
  final AppState state;
  final DirectBuyerApi? directBuyerApi;
  final PurchasesApi? purchasesApi;

  const DirectBuyerHomeView({
    super.key,
    required this.state,
    this.directBuyerApi,
    this.purchasesApi,
  });

  @override
  State<DirectBuyerHomeView> createState() => _DirectBuyerHomeViewState();
}

class _DirectBuyerHomeViewState extends State<DirectBuyerHomeView> {
  late final DirectBuyerApi _api =
      widget.directBuyerApi ?? DirectBuyerApi();
  late final PurchasesApi _purchasesApi =
      widget.purchasesApi ?? PurchasesApi();
  DirectBuyerAnalytics? _analytics;
  List<FeedLot> _feed = const [];
  List<Purchase> _purchases = const [];
  String _company = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final results = await Future.wait([
      _api
          .getAnalytics()
          .then<DirectBuyerAnalytics?>((a) => a, onError: (_) => null),
      _api
          .getFeed(limit: 10)
          .then<List<FeedLot>>((f) => f, onError: (_) => const <FeedLot>[]),
      _purchasesApi.listPurchases().then<Map<String, dynamic>>(
          (r) => r,
          onError: (_) => const <String, dynamic>{}),
      _api.getProfile().then<Map<String, dynamic>>(
          (p) => Map<String, dynamic>.from(p),
          onError: (_) => const <String, dynamic>{}),
    ]);
    if (!mounted) return;
    final purchasesRes = results[2] as Map<String, dynamic>;
    final profile = results[3] as Map<String, dynamic>;
    setState(() {
      _analytics = results[0] as DirectBuyerAnalytics?;
      _feed = results[1] as List<FeedLot>;
      _purchases = ((purchasesRes['data'] as List?) ?? const <dynamic>[])
          .map((e) => Purchase.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      _company = ((profile['roleProfile'] as Map?)?['companyName'] as String?) ??
          widget.state.profile.name;
      _loading = false;
    });
  }

  Future<void> _openLot(BuildContext context, FeedLot lot) async {
    final bought = await DirectBuySheet.show(
      context,
      state: widget.state,
      purchasesApi: _purchasesApi,
      directBuyerApi: _api,
      lot: lot,
    );
    if (bought == true) await _refresh();
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
            _header(meta),
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
            _title(widget.state.tr('direct.quickActionsTitle')),
            const SizedBox(height: 10),
            DirectQuickActionsGrid(state: widget.state, personaColor: meta.primaryColor),
            if (a != null) ...[
              const SizedBox(height: 14),
              _title(widget.state.tr('direct.priceVsMandiTitle')),
              const SizedBox(height: 8),
              _card(PriceVsMandiList(state: widget.state, items: a.avgPriceVsMandi)),
              const SizedBox(height: 12),
              _title(widget.state.tr('direct.cropBreakdownTitle')),
              const SizedBox(height: 8),
              _card(CropBreakdownBars(items: a.cropBreakdown, color: meta.primaryColor)),
            ],
            const SizedBox(height: 14),
            _title(widget.state.tr('direct.forYouTitle')),
            const SizedBox(height: 8),
            if (_loading)
              Container(
                height: 110,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
              )
            else if (_feed.isEmpty)
              _card(DirectEmptyState(
                  icon: Icons.inventory_2_outlined,
                  message: widget.state.tr('direct.noLots')))
            else
              FeedLotsRow(state: widget.state, lots: _feed, onTap: (l) => _openLot(context, l)),
            const SizedBox(height: 14),
            _title(widget.state.tr('direct.recentPurchasesTitle')),
            const SizedBox(height: 8),
            if (_purchases.isEmpty)
              _card(DirectEmptyState(
                  icon: Icons.shopping_basket_outlined,
                  message: widget.state.tr('direct.noPurchases')))
            else
              _card(RecentPurchasesList(
                state: widget.state,
                purchases: _purchases,
                onTap: (p) => widget.state.openPurchaseDetail(p.id),
              )),
            const SizedBox(height: 100),
          ],
        ),
      ),
    );
  }

  Widget _statsRow(DirectBuyerAnalytics a) {
    final stats = [
      (widget.state.tr('direct.totalSpendLabel'), "₹${a.totalSpend.toStringAsFixed(0)}",
          Icons.currency_rupee_rounded, const Color(0xFF16A34A)),
      (widget.state.tr('direct.totalVolumeLabel'), "${a.totalVolume.toStringAsFixed(0)} q",
          Icons.scale_rounded, const Color(0xFF0284C7)),
      (widget.state.tr('direct.activeDemands'), "${a.activeDemands}",
          Icons.campaign_rounded, const Color(0xFFEA580C)),
      (widget.state.tr('direct.openOffers'), "${a.openOffers}",
          Icons.handshake_rounded, const Color(0xFFDB2777)),
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

  Widget _title(String title) {
    return Text(
      title,
      style: const TextStyle(
          fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
    );
  }

  Widget _card(Widget child) {
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

  Widget _header(UserProfileMeta meta) {
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.handshake_rounded,
                        color: Colors.white, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      widget.state.tr('direct.buyerBadge'),
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
            widget.state.tr('direct.greeting').replaceAll('{name}', _company),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.92),
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            _company,
            style: const TextStyle(
                color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            widget.state.tr('direct.defaultSubtitle'),
            style: TextStyle(
                color: Colors.white.withValues(alpha: 0.9), fontSize: 12),
          ),
        ],
      ),
    );
  }
}
