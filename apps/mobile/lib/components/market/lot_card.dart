import 'package:flutter/material.dart';
import '../mandi/mandi_price_card.dart';

class LotFormField extends StatelessWidget {
  final String label;
  final Widget child;
  final String? error;

  const LotFormField({
    super.key,
    required this.label,
    required this.child,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: error != null ? Colors.red : const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
          const SizedBox(height: 4),
          child,
          if (error != null)
            Text(error!, style: const TextStyle(fontSize: 10.5, color: Colors.red, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class LotCard extends StatelessWidget {
  final Map<String, dynamic> lot;
  final VoidCallback onEdit;
  final VoidCallback onWithdraw;

  const LotCard({
    super.key,
    required this.lot,
    required this.onEdit,
    required this.onWithdraw,
  });

  @override
  Widget build(BuildContext context) {
    final status = "${lot['status']}";
    final (chipColor, chipLabel) = switch (status) {
      'open' => (const Color(0xFF16A34A), 'open'),
      'sold' => (const Color(0xFF2563EB), 'sold'),
      _ => (Colors.grey, 'withdrawn'),
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        "${lot['crop']}",
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF1B4332)),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: chipColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(chipLabel, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: chipColor)),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  "${lot['quantityQuintals']} क्विंटल • ₹${fmtInr((lot['expectedRate'] as num?) ?? 0)}/qtl • कटाई ${lot['harvestDate']}",
                  style: const TextStyle(fontSize: 11, color: Colors.black54),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: "संपादित करें",
            icon: const Icon(Icons.edit_rounded, size: 18, color: Color(0xFF2E7D32)),
            onPressed: onEdit,
          ),
          IconButton(
            tooltip: "वापस लें",
            icon: const Icon(Icons.undo_rounded, size: 18, color: Color(0xFFDC2626)),
            onPressed: onWithdraw,
          ),
        ],
      ),
    );
  }
}
