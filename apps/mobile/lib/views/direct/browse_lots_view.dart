import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/direct_buyer_api.dart';
import '../../api/offers_api.dart';
import '../../api/purchases_api.dart';
import '../../components/direct/direct_buy_sheet.dart';
import '../../components/direct/direct_offer_sheets.dart';
import '../../components/direct/direct_widgets.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';

class BrowseLotsView extends StatefulWidget {
  final AppState state;
  final DirectBuyerApi? directBuyerApi;
  final PurchasesApi? purchasesApi;
  final OffersApi? offersApi;

  const BrowseLotsView({
    super.key,
    required this.state,
    this.directBuyerApi,
    this.purchasesApi,
    this.offersApi,
  });

  @override
  State<BrowseLotsView> createState() => _BrowseLotsViewState();
}

class _BrowseLotsViewState extends State<BrowseLotsView> {
  late final DirectBuyerApi _api = widget.directBuyerApi ?? DirectBuyerApi();
  late final PurchasesApi _purchasesApi =
      widget.purchasesApi ?? PurchasesApi();
  late final OffersApi _offersApi = widget.offersApi ?? OffersApi();
  List<FeedLot> _lots = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final lots = await _api.getFeed(limit: 50);
      if (!mounted) return;
      setState(() {
        _lots = lots;
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _lots = const [];
          _loading = false;
        });
      }
    }
  }

  Future<void> _saveFarmer(FeedLot lot) async {
    try {
      await _api.saveFarmer(lot.farmerId);
      widget.state.showToast(widget.state.tr('direct.farmerSavedMsg'));
    } on ApiException catch (e) {
      widget.state.showToast(e.message);
    }
  }

  Future<void> _makeOffer(FeedLot lot) async {
    final ok = await DirectOfferSheet.show(
      context,
      state: widget.state,
      api: _offersApi,
      targetType: 'lot',
      targetId: lot.id,
      defaultQuantity: lot.quantityQuintals,
    );
    if (ok == true) await _load();
  }

  Future<void> _buy(FeedLot lot) async {
    final ok = await DirectBuySheet.show(
      context,
      state: widget.state,
      purchasesApi: _purchasesApi,
      directBuyerApi: _api,
      lot: lot,
    );
    if (ok == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.state.tr;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
          children: [
            Text(tr('direct.browseLotsTitle'),
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(tr('direct.feedSubtitle'),
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 12),
            if (_loading)
              Container(
                height: 120,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
              )
            else if (_lots.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: DirectEmptyState(
                    icon: Icons.inventory_2_outlined,
                    message: tr('direct.noLots')),
              )
            else
              for (final lot in _lots) _lotCard(lot),
          ],
        ),
      ),
    );
  }

  Widget _lotCard(FeedLot lot) {
    final tr = widget.state.tr;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  lot.variety.isEmpty ? lot.crop : "${lot.crop} (${lot.variety})",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w900),
                ),
              ),
              Text(
                "₹${fmtInr(lot.expectedRate)}/q",
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF16A34A)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            "${qtyText(lot.quantityQuintals)} q • ${lot.harvestDate}",
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 2),
          Text(
            "${lot.farmerName}${lot.farmerVillage.isEmpty ? '' : ' • ${lot.farmerVillage}'}",
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () => _buy(lot),
                  icon: const Icon(Icons.shopping_cart_rounded, size: 16),
                  label: Text(tr('direct.buyNow'),
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF4F46E5),
                    side: const BorderSide(color: Color(0xFF4F46E5)),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () => _makeOffer(lot),
                  child: Text(tr('direct.makeOfferBtn'),
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                ),
              ),
              IconButton(
                tooltip: tr('direct.saveFarmerBtn'),
                onPressed: () => _saveFarmer(lot),
                icon: const Icon(Icons.bookmark_add_outlined,
                    size: 19, color: Color(0xFF4F46E5)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
