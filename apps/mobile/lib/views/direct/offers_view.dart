import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/offers_api.dart';
import '../../components/direct/direct_counter_sheet.dart';
import '../../components/direct/direct_widgets.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';

class OffersView extends StatefulWidget {
  final AppState state;
  final OffersApi? offersApi;

  const OffersView({super.key, required this.state, this.offersApi});

  @override
  State<OffersView> createState() => _OffersViewState();
}

class _OffersViewState extends State<OffersView> {
  late final OffersApi _api = widget.offersApi ?? OffersApi();
  String _tab = 'sent';
  List<Offer> _offers = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.listMine(filter: _tab);
      if (!mounted) return;
      setState(() {
        _offers = ((res['data'] as List?) ?? const <dynamic>[])
            .map((e) => Offer.fromJson((e as Map).cast<String, dynamic>()))
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _offers = const [];
          _loading = false;
        });
      }
    }
  }

  Future<void> _switchTab(String tab) async {
    setState(() {
      _tab = tab;
      _loading = true;
    });
    await _load();
  }

  Future<void> _act(Future<Offer> Function() action, String msg) async {
    try {
      await action();
      widget.state.showToast(widget.state.tr(msg));
      await _load();
    } on ApiException catch (e) {
      widget.state.showToast(e.message);
    }
  }

  Future<void> _counter(Offer o) async {
    final ok = await DirectCounterSheet.show(context,
        state: widget.state, api: _api, offerId: o.id);
    if (ok == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.state.tr;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: TabBar(
          onTap: (i) => _switchTab(i == 0 ? 'sent' : 'received'),
          indicatorColor: const Color(0xFF4F46E5),
          labelColor: const Color(0xFF4F46E5),
          unselectedLabelColor: Colors.grey.shade600,
          labelStyle: const TextStyle(fontWeight: FontWeight.w900),
          tabs: [
            Tab(text: tr('direct.sentTab')),
            Tab(text: tr('direct.receivedTab')),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 100),
            children: [
              if (_loading)
                Container(
                  height: 100,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                  ),
                )
              else if (_offers.isEmpty)
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
                for (final o in _offers) _offerCard(o),
            ],
          ),
        ),
      ),
    );
  }

  Widget _offerCard(Offer o) {
    final tr = widget.state.tr;
    final sent = _tab == 'sent';
    final counterparty =
        sent ? (o.toName.isEmpty ? o.targetId : o.toName) : o.fromName;
    final pending = o.status == 'pending';
    final countered = o.status == 'countered';
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
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                decoration: BoxDecoration(
                  color: const Color(0xFF4F46E5).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Text(
                  o.targetType == 'demand'
                      ? tr('direct.offerTargetDemand')
                      : tr('direct.offerTargetLot'),
                  style: const TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF4F46E5)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  counterparty,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w900),
                ),
              ),
              DirectStatusChip(
                  label: offerStatusLabel(widget.state, o.status),
                  color: offerStatusColor(o.status)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            "₹${fmtInr(o.pricePerUnit)}/${o.unit == 'kg' ? 'kg' : 'q'} × ${qtyText(o.quantity)} ${o.unit}",
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800),
          ),
          if (o.message.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(o.message,
                  style: TextStyle(
                      fontSize: 11.5, color: Colors.grey.shade700)),
            ),
          if (o.counter != null)
            Container(
              margin: const EdgeInsets.only(top: 6),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF7C3AED).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                "${tr('direct.counterOfferBtn')}: ₹${fmtInr(o.counter!.pricePerUnit)}/${o.unit == 'kg' ? 'kg' : 'q'}",
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF7C3AED)),
              ),
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              if (!sent && pending) ...[
                _actionBtn(tr('direct.accept'), const Color(0xFF16A34A),
                    () => _act(() => _api.accept(o.id), 'direct.offerAcceptedMsg')),
                const SizedBox(width: 6),
                _actionBtn(tr('direct.counterOfferBtn'), const Color(0xFF7C3AED),
                    () => _counter(o)),
                const SizedBox(width: 6),
                _actionBtn(tr('direct.reject'), const Color(0xFFDC2626),
                    () => _act(() => _api.reject(o.id), 'direct.offerRejectedMsg')),
              ] else if (sent && pending) ...[
                _actionBtn(tr('direct.withdrawOfferBtn'), Colors.grey.shade700,
                    () => _act(() => _api.withdraw(o.id), 'direct.offerWithdrawnMsg')),
              ] else if (sent && countered) ...[
                _actionBtn(tr('direct.acceptCounter'), const Color(0xFF16A34A),
                    () => _act(() => _api.accept(o.id), 'direct.offerAcceptedMsg')),
                const SizedBox(width: 6),
                _actionBtn(tr('direct.reject'), const Color(0xFFDC2626),
                    () => _act(() => _api.reject(o.id), 'direct.offerRejectedMsg')),
              ] else
                Text(
                  o.updatedAt,
                  style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: Colors.grey.shade500),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(9),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: color.withValues(alpha: 0.5)),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 10.5, fontWeight: FontWeight.w900, color: color)),
      ),
    );
  }
}
