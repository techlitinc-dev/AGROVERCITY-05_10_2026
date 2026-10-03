import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/demands_api.dart';
import '../../api/offers_api.dart';
import '../../components/direct/direct_counter_sheet.dart';
import '../../components/direct/direct_widgets.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';
import 'demand_detail_sections.dart';
import 'demand_form_sheet.dart';

class DemandDetailView extends StatefulWidget {
  final AppState state;
  final DemandsApi? demandsApi;
  final OffersApi? offersApi;

  const DemandDetailView({
    super.key,
    required this.state,
    this.demandsApi,
    this.offersApi,
  });

  @override
  State<DemandDetailView> createState() => _DemandDetailViewState();
}

class _DemandDetailViewState extends State<DemandDetailView> {
  late final DemandsApi _api = widget.demandsApi ?? DemandsApi();
  late final OffersApi _offersApi = widget.offersApi ?? OffersApi();
  Demand? _demand;
  List<Offer> _offers = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final id = widget.state.selectedDemandId;
    if (id == null) {
      setState(() => _loading = false);
      return;
    }
    final results = await Future.wait([
      _api.getDemand(id).then<Demand?>((d) => d, onError: (_) => null),
      _offersApi.listMine(filter: 'received', targetType: 'demand').then<
              Map<String, dynamic>>(
          (r) => r,
          onError: (_) => const <String, dynamic>{}),
    ]);
    if (!mounted) return;
    final res = results[1] as Map<String, dynamic>;
    setState(() {
      _demand = results[0] as Demand?;
      _offers = ((res['data'] as List?) ?? const <dynamic>[])
          .map((e) => Offer.fromJson((e as Map).cast<String, dynamic>()))
          .where((o) => o.targetId == id)
          .toList();
      _loading = false;
    });
  }

  Future<void> _edit() async {
    final d = _demand;
    if (d == null) return;
    final ok =
        await DemandFormSheet.show(context, state: widget.state, api: _api, existing: d);
    if (ok == true) await _load();
  }

  Future<void> _toggleClose() async {
    final d = _demand;
    if (d == null) return;
    try {
      if (d.status == 'open') {
        await _api.closeDemand(d.id);
      } else if (d.status == 'closed') {
        await _api.reopenDemand(d.id);
      } else {
        return;
      }
      widget.state.showToast(widget.state.tr('direct.demandUpdatedMsg'));
      await _load();
    } on ApiException catch (e) {
      widget.state.showToast(e.message);
    }
  }

  Future<void> _delete() async {
    final d = _demand;
    if (d == null) return;
    final tr = widget.state.tr;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(tr('direct.deleteDemandTitle'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Text(d.crop),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(tr('cancel'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(tr('direct.deleteDemandTitle')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.deleteDemand(d.id);
      widget.state.showToast(tr('direct.demandDeletedMsg'));
      if (mounted) widget.state.navigateBack();
    } on ApiException catch (e) {
      widget.state.showToast(e.message);
    }
  }

  Future<void> _actOnOffer(Offer o, Future<Offer> Function() action, String msg) async {
    try {
      await action();
      widget.state.showToast(widget.state.tr(msg));
      await _load();
    } on ApiException catch (e) {
      widget.state.showToast(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.state.tr;
    final d = _demand;
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_loading)
            Container(
              height: 140,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
              ),
            )
          else if (d == null)
            DirectEmptyState(icon: Icons.error_outline_rounded, message: tr('direct.noDemands'))
          else ...[
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        d.variety.isEmpty ? d.crop : "${d.crop} (${d.variety})",
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 2),
                      Text("${d.buyerCompany} • ${d.state}",
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade600)),
                    ],
                  ),
                ),
                DirectStatusChip(
                    label: demandStatusLabel(widget.state, d.status),
                    color: demandStatusColor(d.status)),
              ],
            ),
            const SizedBox(height: 12),
            DirectSectionCard(
              title: tr('direct.specTitle'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DirectInfoRow(
                      label: tr('direct.quantityLabel'),
                      value: "${qtyText(d.quantity)} ${d.unit}"),
                  DirectInfoRow(
                      label: tr('direct.gradeLabel'), value: d.qualityGrade),
                  DirectInfoRow(
                      label: tr('direct.maxPriceLabel'),
                      value: "₹${fmtInr(d.maxPrice)}/${d.unit == 'kg' ? 'kg' : 'q'}"),
                  DirectInfoRow(
                      label: tr('direct.packagingLabel'),
                      value: d.packaging.isEmpty ? '—' : d.packaging),
                  DirectInfoRow(
                      label: tr('direct.deliveryLocationLabel'),
                      value: d.deliveryLocation),
                  DirectInfoRow(
                      label: tr('direct.neededByLabel'), value: d.neededBy),
                  DirectInfoRow(
                      label: tr('direct.frequencyLabel'),
                      value: tr('direct.frequency_${d.frequency}')),
                  if (d.notes.isNotEmpty)
                    DirectInfoRow(
                        label: tr('direct.notesLabel'), value: d.notes),
                ],
              ),
            ),
            if (d.status == 'open') ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF4F46E5),
                        side: const BorderSide(color: Color(0xFF4F46E5)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: _edit,
                      icon: const Icon(Icons.edit_rounded, size: 16),
                      label: Text(tr('direct.editDemand'),
                          style: const TextStyle(fontWeight: FontWeight.w900)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.grey.shade700,
                        side: BorderSide(color: Colors.grey.shade400),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: _toggleClose,
                      child: Text(
                          d.status == 'open'
                              ? tr('direct.closeDemand')
                              : tr('direct.reopenDemand'),
                          style: const TextStyle(fontWeight: FontWeight.w900)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    tooltip: tr('direct.deleteDemandTitle'),
                    onPressed: _delete,
                    icon: const Icon(Icons.delete_outline_rounded,
                        color: Color(0xFFDC2626)),
                  ),
                ],
              ),
            ] else if (d.status == 'closed') ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF16A34A),
                    side: const BorderSide(color: Color(0xFF16A34A)),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _toggleClose,
                  child: Text(tr('direct.reopenDemand'),
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                ),
              ),
            ],
            const SizedBox(height: 14),
            DirectSectionCard(
              title:
                  "${tr('direct.demandOffersTitle')} (${_offers.length})",
              child: _offers.isEmpty
                  ? DirectEmptyState(
                      icon: Icons.handshake_outlined,
                      message: tr('direct.noOffers'))
                  : Column(
                      children: [
                        for (final o in _offers)
                          DemandOfferTile(
                            state: widget.state,
                            offer: o,
                            onAccept: () => _actOnOffer(
                                o,
                                () => _offersApi.accept(o.id),
                                'direct.offerAcceptedMsg'),
                            onReject: () => _actOnOffer(
                                o,
                                () => _offersApi.reject(o.id),
                                'direct.offerRejectedMsg'),
                            onCounter: () async {
                              final ok = await DirectCounterSheet.show(context,
                                  state: widget.state,
                                  api: _offersApi,
                                  offerId: o.id);
                              if (ok == true) await _load();
                            },
                          ),
                      ],
                    ),
            ),
          ],
        ],
      ),
    );
  }


}
