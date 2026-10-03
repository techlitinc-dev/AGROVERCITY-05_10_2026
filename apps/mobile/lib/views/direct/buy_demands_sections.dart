import 'package:flutter/material.dart';

import '../../components/direct/direct_widgets.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';

class FarmerDemandCard extends StatelessWidget {
  final AppState state;
  final Demand demand;
  final VoidCallback onOffer;

  const FarmerDemandCard({
    super.key,
    required this.state,
    required this.demand,
    required this.onOffer,
  });

  @override
  Widget build(BuildContext context) {
    final tr = state.tr;
    final d = demand;
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
                  d.variety.isEmpty ? d.crop : "${d.crop} (${d.variety})",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w900),
                ),
              ),
              Text(
                "₹${fmtInr(d.maxPrice)}/${d.unit == 'kg' ? 'kg' : 'q'}",
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF16A34A)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            "${qtyText(d.quantity)} ${d.unit} • ${tr('direct.gradeLabel')} ${d.qualityGrade} • ${tr('direct.neededByLabel')} ${d.neededBy}",
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
          ),
          Text(
            "${d.buyerCompany} • ${d.deliveryLocation}",
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700),
          ),
          const SizedBox(height: 10),
          InkWell(
            onTap: onOffer,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF16A34A),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  tr('direct.makeOfferBtn'),
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w900),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class FarmerLotOfferCard extends StatelessWidget {
  final AppState state;
  final Offer offer;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  final VoidCallback onCounter;

  const FarmerLotOfferCard({
    super.key,
    required this.state,
    required this.offer,
    required this.onAccept,
    required this.onReject,
    required this.onCounter,
  });

  Widget _btn(String label, Color color, VoidCallback onTap) {
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
                child: Text(o.fromName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w900)),
              ),
              DirectStatusChip(
                  label: offerStatusLabel(state, o.status),
                  color: offerStatusColor(o.status)),
            ],
          ),
          const SizedBox(height: 4),
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
              if (pending) ...[
                _btn(tr('direct.accept'), const Color(0xFF16A34A), onAccept),
                const SizedBox(width: 6),
                _btn(tr('direct.counterOfferBtn'), const Color(0xFF7C3AED), onCounter),
                const SizedBox(width: 6),
                _btn(tr('direct.reject'), const Color(0xFFDC2626), onReject),
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
