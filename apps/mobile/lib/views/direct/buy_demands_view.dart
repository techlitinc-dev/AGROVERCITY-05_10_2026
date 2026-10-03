import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/demands_api.dart';
import '../../api/offers_api.dart';
import '../../components/direct/direct_counter_sheet.dart';
import '../../components/direct/direct_offer_sheets.dart';
import '../../components/direct/direct_widgets.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';
import 'buy_demands_sections.dart';

class BuyDemandsView extends StatefulWidget {
  final AppState state;
  final DemandsApi? demandsApi;
  final OffersApi? offersApi;

  const BuyDemandsView({
    super.key,
    required this.state,
    this.demandsApi,
    this.offersApi,
  });

  @override
  State<BuyDemandsView> createState() => _BuyDemandsViewState();
}

class _BuyDemandsViewState extends State<BuyDemandsView> {
  late final DemandsApi _demandsApi = widget.demandsApi ?? DemandsApi();
  late final OffersApi _offersApi = widget.offersApi ?? OffersApi();
  List<Demand> _demands = const [];
  List<Offer> _lotOffers = const [];
  bool _loadingDemands = true;
  bool _loadingOffers = true;
  String _cropFilter = '';

  @override
  void initState() {
    super.initState();
    _loadDemands();
    _loadLotOffers();
  }

  Future<void> _loadDemands() async {
    try {
      final res = await _demandsApi.listDemands(status: 'open');
      if (!mounted) return;
      setState(() {
        _demands = ((res['data'] as List?) ?? const <dynamic>[])
            .map((e) => Demand.fromJson((e as Map).cast<String, dynamic>()))
            .toList();
        _loadingDemands = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingDemands = false);
    }
  }

  Future<void> _loadLotOffers() async {
    try {
      final res =
          await _offersApi.listMine(filter: 'received', targetType: 'lot');
      if (!mounted) return;
      setState(() {
        _lotOffers = ((res['data'] as List?) ?? const <dynamic>[])
            .map((e) => Offer.fromJson((e as Map).cast<String, dynamic>()))
            .toList();
        _loadingOffers = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingOffers = false);
    }
  }

  List<Demand> get _filtered => _cropFilter.trim().isEmpty
      ? _demands
      : _demands
          .where((d) =>
              d.crop.toLowerCase().contains(_cropFilter.trim().toLowerCase()))
          .toList();

  Future<void> _offer(Demand d) async {
    final ok = await DirectOfferSheet.show(
      context,
      state: widget.state,
      api: _offersApi,
      targetType: 'demand',
      targetId: d.id,
      defaultQuantity: d.quantity,
      unit: d.unit,
      askQuantity: true,
    );
    if (ok == true) await _loadDemands();
  }

  Future<void> _act(
      Offer o, Future<Offer> Function() action, String msg) async {
    try {
      await action();
      widget.state.showToast(widget.state.tr(msg));
      await _loadLotOffers();
    } on ApiException catch (e) {
      widget.state.showToast(e.message);
    }
  }

  Future<void> _counter(Offer o) async {
    final ok = await DirectCounterSheet.show(context,
        state: widget.state, api: _offersApi, offerId: o.id);
    if (ok == true) await _loadLotOffers();
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.state.tr;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: TabBar(
          indicatorColor: const Color(0xFF16A34A),
          labelColor: const Color(0xFF16A34A),
          unselectedLabelColor: Colors.grey.shade600,
          labelStyle: const TextStyle(fontWeight: FontWeight.w900),
          tabs: [
            Tab(text: tr('direct.buyDemandsTitle')),
            Tab(text: tr('direct.lotOffersTab')),
          ],
        ),
        body: TabBarView(
          children: [
            RefreshIndicator(
              onRefresh: _loadDemands,
              child: ListView(
                physics: const BouncingScrollPhysics(
                  parent: AlwaysScrollableScrollPhysics(),
                ),
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 100),
                children: [
                  Text(tr('direct.buyDemandsSubtitle'),
                      style:
                          TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  const SizedBox(height: 10),
                  TextField(
                    onChanged: (v) => setState(() => _cropFilter = v),
                    decoration: InputDecoration(
                      hintText: tr('direct.filterCropHint'),
                      prefixIcon: const Icon(Icons.search_rounded, size: 18),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: Colors.grey.shade200),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: Colors.grey.shade200),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_loadingDemands)
                    Container(
                      height: 100,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                    )
                  else if (_filtered.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: DirectEmptyState(
                          icon: Icons.campaign_outlined,
                          message: tr('direct.noDemandsFarmer')),
                    )
                  else
                    for (final d in _filtered)
                      FarmerDemandCard(
                          state: widget.state, demand: d, onOffer: () => _offer(d)),
                ],
              ),
            ),
            RefreshIndicator(
              onRefresh: _loadLotOffers,
              child: ListView(
                physics: const BouncingScrollPhysics(
                  parent: AlwaysScrollableScrollPhysics(),
                ),
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 100),
                children: [
                  Text(tr('direct.lotOffersNote'),
                      style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: Colors.grey.shade600)),
                  const SizedBox(height: 10),
                  if (_loadingOffers)
                    Container(
                      height: 100,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                    )
                  else if (_lotOffers.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: DirectEmptyState(
                          icon: Icons.handshake_outlined,
                          message: tr('direct.noOffers')),
                    )
                  else
                    for (final o in _lotOffers)
                      FarmerLotOfferCard(
                        state: widget.state,
                        offer: o,
                        onAccept: () => _act(
                            o, () => _offersApi.accept(o.id), 'direct.offerAcceptedMsg'),
                        onReject: () => _act(
                            o, () => _offersApi.reject(o.id), 'direct.offerRejectedMsg'),
                        onCounter: () => _counter(o),
                      ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
