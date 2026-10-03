import 'package:flutter/material.dart';

import '../../components/direct/direct_widgets.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';

class DemandOfferTile extends StatelessWidget {
  final AppState state;
  final Offer offer;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  final VoidCallback onCounter;

  const DemandOfferTile({
    super.key,
    required this.state,
    required this.offer,
    required this.onAccept,
    required this.onReject,
    required this.onCounter,
  });

  Widget _miniBtn(String label, Color color, VoidCallback onTap) {
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

  @override
  Widget build(BuildContext context) {
    final tr = state.tr;
    final o = offer;
    final pending = o.status == 'pending';
    final countered = o.status == 'countered';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(o.fromName,
                    style: const TextStyle(
                        fontSize: 12.5, fontWeight: FontWeight.w900)),
              ),
              Text(
                "₹${fmtInr(o.pricePerUnit)}/${o.unit == 'kg' ? 'kg' : 'q'} × ${qtyText(o.quantity)} ${o.unit}",
                style:
                    const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
              ),
            ],
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
                "${tr('direct.counterOfferBtn')}: ₹${fmtInr(o.counter!.pricePerUnit)}/${o.unit == 'kg' ? 'kg' : 'q'}${o.counter!.note.isEmpty ? '' : ' — ${o.counter!.note}'}",
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF7C3AED)),
              ),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              DirectStatusChip(
                  label: offerStatusLabel(state, o.status),
                  color: offerStatusColor(o.status)),
              const Spacer(),
              if (pending) ...[
                _miniBtn(tr('direct.accept'), const Color(0xFF16A34A), onAccept),
                const SizedBox(width: 6),
                _miniBtn(tr('direct.counterOfferBtn'), const Color(0xFF7C3AED), onCounter),
                const SizedBox(width: 6),
                _miniBtn(tr('direct.reject'), const Color(0xFFDC2626), onReject),
              ] else if (countered)
                Text(tr('direct.counterSubmittedMsg'),
                    style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: Colors.grey.shade500)),
            ],
          ),
        ],
      ),
    );
  }
}
