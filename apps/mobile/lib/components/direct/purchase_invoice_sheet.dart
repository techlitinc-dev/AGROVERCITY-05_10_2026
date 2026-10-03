import 'package:flutter/material.dart';

import '../../components/mandi/mandi_price_card.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';
import 'direct_widgets.dart';

class PurchaseInvoiceSheet extends StatelessWidget {
  final AppState state;
  final Purchase purchase;
  final PurchaseInvoice invoice;

  const PurchaseInvoiceSheet({
    super.key,
    required this.state,
    required this.purchase,
    required this.invoice,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required Purchase purchase,
    required PurchaseInvoice invoice,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SizedBox(
        height: MediaQuery.of(ctx).size.height * 0.85,
        child: PurchaseInvoiceSheet(
            state: state, purchase: purchase, invoice: invoice),
      ),
    );
  }

  String _fmtAt(String at) {
    final dt = DateTime.tryParse(at);
    if (dt == null) return at;
    final local = dt.toLocal();
    String two(int v) => v.toString().padLeft(2, '0');
    return "${two(local.day)}/${two(local.month)}/${local.year} ${two(local.hour)}:${two(local.minute)}";
  }

  @override
  Widget build(BuildContext context) {
    final tr = state.tr;
    final p = purchase;
    final rejectedQty = (p.qc['rejectedQty'] as num?)?.toDouble() ?? 0;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF16A34A).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.receipt_long_rounded,
                  color: Color(0xFF16A34A), size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(invoice.number,
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w900)),
                  Text(
                    "${tr('direct.invoiceIssuedLabel')}: ${_fmtAt(invoice.issuedAt)}",
                    style: TextStyle(
                        fontSize: 11, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
          ],
        ),
        const Divider(height: 24),
        _row(
            tr('direct.specTitle'),
            p.variety.isEmpty ? p.crop : "${p.crop} (${p.variety})"),
        _row(tr('persona.directBuyer.label'), p.buyerName),
        _row(tr('persona.farmer.label'), p.farmerName),
        _row(tr('direct.sourceLabel'), "${p.sourceType} • ${p.sourceRefId}"),
        const Divider(height: 24),
        _row(
          "${qtyText(p.quantity)} ${p.unit} × ₹${fmtInr(p.agreedPricePerUnit)}",
          "₹${fmtInr(p.totalAmount)}",
        ),
        if (rejectedQty > 0) ...[
          const SizedBox(height: 4),
          _row(
            "${tr('direct.qcRejectedQtyHint')}: ${qtyText(rejectedQty)} ${p.unit}",
            "− ₹${fmtInr(p.totalAmount - (p.finalAmount ?? p.totalAmount))}",
            valueColor: const Color(0xFFDC2626),
          ),
        ],
        const Divider(height: 24),
        for (final pay in p.payments)
          _row(
            "${pay.kind} • ${pay.method.isEmpty ? '—' : pay.method}",
            "₹${fmtInr(pay.amount)}",
            sub: pay.reference.isEmpty ? null : pay.reference,
          ),
        const Divider(height: 24),
        _row(tr('direct.paidTotalLabel'), "₹${fmtInr(p.paidTotal)}"),
        _row(tr('direct.finalAmountLabel'),
            "₹${fmtInr(p.finalAmount ?? p.totalAmount)}"),
        _row(tr('direct.balanceDueLabel'), "₹${fmtInr(p.amountDue)}",
            valueColor: p.amountDue > 0
                ? const Color(0xFFDC2626)
                : const Color(0xFF16A34A)),
      ],
    );
  }

  Widget _row(String label, String value, {String? sub, Color? valueColor}) {
    if (label.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Colors.grey.shade700)),
                if (sub != null)
                  Text(sub,
                      style: TextStyle(
                          fontSize: 10, color: Colors.grey.shade500)),
              ],
            ),
          ),
          if (value.isNotEmpty)
            Text(value,
                style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w900,
                    color: valueColor ?? const Color(0xFF1E293B))),
        ],
      ),
    );
  }
}
