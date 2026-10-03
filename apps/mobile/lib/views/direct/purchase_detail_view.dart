import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/direct_buyer_api.dart';
import '../../api/purchases_api.dart';
import '../../components/direct/direct_buy_sheet.dart';
import '../../components/direct/direct_widgets.dart';
import '../../components/direct/purchase_advance_pickup_sheets.dart';
import '../../components/direct/payment_sheet.dart';
import '../../components/direct/purchase_invoice_sheet.dart';
import '../../components/direct/purchase_resolve_rate_sheets.dart';
import '../../components/direct/purchase_settlement_sheets.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/direct_buyer_models.dart';
import '../../models/user_profile_type.dart';
import '../../state/app_state.dart';
import 'purchase_action_bar.dart';
import 'purchase_detail_sections.dart';

class PurchaseDetailView extends StatefulWidget {
  final AppState state;
  final PurchasesApi? purchasesApi;
  final DirectBuyerApi? directBuyerApi;

  const PurchaseDetailView({
    super.key,
    required this.state,
    this.purchasesApi,
    this.directBuyerApi,
  });

  @override
  State<PurchaseDetailView> createState() => _PurchaseDetailViewState();
}

class _PurchaseDetailViewState extends State<PurchaseDetailView> {
  late final PurchasesApi _api = widget.purchasesApi ?? PurchasesApi();
  Purchase? _purchase;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool get _isFarmer => widget.state.activeProfile == UserProfileType.farmer;

  Future<void> _load() async {
    final id = widget.state.selectedPurchaseId;
    if (id == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final p = await _api.getPurchase(id);
      if (!mounted) return;
      setState(() {
        _purchase = p;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _run(Future<Purchase> Function() action, String msg) async {
    try {
      await action();
      widget.state.showToast(widget.state.tr(msg));
      await _load();
    } on ApiException catch (e) {
      widget.state.showToast(e.message);
    }
  }

  Future<void> _sheet(Future<bool> Function() show, String msg) async {
    final ok = await show();
    if (ok == true) {
      widget.state.showToast(widget.state.tr(msg));
      await _load();
    }
  }

  Future<void> _openInvoice() async {
    final p = _purchase;
    if (p == null) return;
    try {
      final invoice = await _api.getInvoice(p.id);
      if (!mounted) return;
      await PurchaseInvoiceSheet.show(context,
          state: widget.state, purchase: p, invoice: invoice);
    } on ApiException catch (e) {
      widget.state.showToast(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.state.tr;
    final p = _purchase;
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_loading)
            Container(
              height: 160,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
              ),
            )
          else if (p == null)
            DirectEmptyState(
                icon: Icons.error_outline_rounded,
                message: tr('direct.noPurchases'))
          else ...[
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.variety.isEmpty ? p.crop : "${p.crop} (${p.variety})",
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 2),
                      Text("${tr('direct.sourceLabel')}: ${p.sourceType}",
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade600)),
                    ],
                  ),
                ),
                DirectStatusChip(
                    label: purchaseStatusLabel(widget.state, p.status),
                    color: purchaseStatusColor(p.status)),
              ],
            ),
            const SizedBox(height: 12),
            _specCard(p),
            if (p.pickup.isNotEmpty) ...[
              const SizedBox(height: 10),
              _pickupCard(p),
            ],
            if (p.qc.isNotEmpty) ...[
              const SizedBox(height: 10),
              _qcCard(p),
            ],
            if (p.payments.isNotEmpty) ...[
              const SizedBox(height: 10),
              _paymentsCard(p),
            ],
            const SizedBox(height: 10),
            DirectSectionCard(
              title: tr('direct.statusLabel'),
              child: PurchaseTimeline(state: widget.state, events: p.events),
            ),
            const SizedBox(height: 14),
            PurchaseActionBar(
              state: widget.state,
              purchase: p,
              isFarmer: _isFarmer,
              onPayAdvance: () => _sheet(
                  () => PayAdvanceSheet.show(context,
                      state: widget.state, api: _api, purchase: p),
                  'direct.paymentRecordedMsg'),
              onRecordPayment: () => _sheet(
                  () => PaymentSheet.show(context,
                      state: widget.state, api: _api, purchase: p),
                  'direct.paymentRecordedMsg'),
              onCancel: () async {
                final ok =
                    await promptCancelPurchase(context, widget.state, _api, p);
                if (ok) await _load();
              },
              onSchedulePickup: () => _sheet(
                  () => PickupSheet.show(context,
                      state: widget.state, api: _api, purchase: p),
                  'direct.demandUpdatedMsg'),
              onDispatch: () =>
                  _run(() => _api.dispatch(p.id), 'direct.demandUpdatedMsg'),
              onDeliver: () =>
                  _run(() => _api.deliver(p.id), 'direct.demandUpdatedMsg'),
              onQc: () => _sheet(
                  () => QcSheet.show(context,
                      state: widget.state, api: _api, purchase: p),
                  'direct.demandUpdatedMsg'),
              onResolve: () => _sheet(
                  () => ResolveSheet.show(context,
                      state: widget.state, api: _api, purchase: p),
                  'direct.disputeResolvedMsg'),
              onInvoice: _openInvoice,
              onRate: () => _sheet(
                  () => RateSheet.show(context,
                      state: widget.state,
                      api: _api,
                      purchase: p,
                      target: _isFarmer ? 'buyer' : 'farmer'),
                  'direct.rateSubmittedMsg'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _specCard(Purchase p) {
    final tr = widget.state.tr;
    return DirectSectionCard(
      title: tr('direct.specTitle'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DirectInfoRow(
              label: tr('direct.quantityLabel'),
              value: "${qtyText(p.quantity)} ${p.unit}"),
          DirectInfoRow(
              label: tr('direct.agreedPriceLabel'),
              value:
                  "₹${fmtInr(p.agreedPricePerUnit)}/${p.unit == 'kg' ? 'kg' : 'q'}"),
          DirectInfoRow(
              label: tr('direct.totalAmountLabel'),
              value: "₹${fmtInr(p.totalAmount)}"),
          DirectInfoRow(
              label: tr('direct.advancePaidLabel'),
              value: "₹${fmtInr(p.advancePaid)}"),
          if (p.finalAmount != null)
            DirectInfoRow(
                label: tr('direct.finalAmountLabel'),
                value: "₹${fmtInr(p.finalAmount!)}"),
          DirectInfoRow(
              label: _isFarmer
                  ? tr('persona.directBuyer.label')
                  : tr('persona.farmer.label'),
              value: _isFarmer ? p.buyerName : p.farmerName),
          DirectInfoRow(
              label: tr('direct.balanceDueLabel'),
              value: "₹${fmtInr(p.amountDue)}"),
          if (!_isFarmer)
            Align(
              alignment: Alignment.centerLeft,
              child: SaveFarmerButton(
                state: widget.state,
                api: widget.directBuyerApi ?? DirectBuyerApi(),
                farmerId: p.farmerId,
              ),
            ),
        ],
      ),
    );
  }

  Widget _pickupCard(Purchase p) {
    final tr = widget.state.tr;
    return DirectSectionCard(
      title: tr('direct.pickupDetailsTitle'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DirectInfoRow(
              label: tr('direct.pickupDateLabel'),
              value: "${p.pickup['date'] ?? ''}"),
          DirectInfoRow(
              label: tr('direct.vehicleTypeLabel'),
              value: "${p.pickup['vehicleType'] ?? ''}"),
          DirectInfoRow(
              label: tr('direct.pickupAddressLabel'),
              value: "${p.pickup['address'] ?? ''}"),
          if ((p.pickup['notes'] as String?)?.isNotEmpty == true)
            DirectInfoRow(
                label: tr('direct.pickupNotesLabel'),
                value: "${p.pickup['notes']}"),
        ],
      ),
    );
  }

  Widget _qcCard(Purchase p) {
    final tr = widget.state.tr;
    return DirectSectionCard(
      title: tr('direct.qcFormTitle'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DirectInfoRow(
              label: tr('direct.qcGradeLabel'), value: "${p.qc['grade'] ?? ''}"),
          DirectInfoRow(
              label: tr('direct.qcAcceptedQtyHint'),
              value: "${p.qc['acceptedQty'] ?? ''}"),
          DirectInfoRow(
              label: tr('direct.qcRejectedQtyHint'),
              value: "${p.qc['rejectedQty'] ?? ''}"),
          if (p.status == 'qcDisputed')
            Text(tr('direct.qcDisputedNote'),
                style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFDC2626))),
        ],
      ),
    );
  }

  Widget _paymentsCard(Purchase p) {
    final tr = widget.state.tr;
    return DirectSectionCard(
      title: tr('direct.paidTotalLabel'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final pay in p.payments)
            DirectInfoRow(
              label: "${pay.kind} • ${PurchaseTimeline.fmtAt(pay.at)}",
              value: "₹${fmtInr(pay.amount)}",
            ),
        ],
      ),
    );
  }
}
