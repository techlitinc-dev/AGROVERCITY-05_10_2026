import 'package:flutter/material.dart';

Color slotStatusColor(String status) => switch (status) {
      'booked' => Colors.red,
      'pending' => Colors.amber.shade800,
      _ => Colors.green,
    };

String slotStatusLabel(String status) => switch (status) {
      'booked' => "बुक्ड",
      'pending' => "स्वीकृति लंबित",
      _ => "उपलब्ध",
    };

class SlotStatusLegend extends StatelessWidget {
  const SlotStatusLegend({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _legendItem(Colors.green, "उपलब्ध"),
        const SizedBox(width: 12),
        _legendItem(Colors.red, "बुक्ड"),
        const SizedBox(width: 12),
        _legendItem(Colors.amber, "स्वीकृति लंबित"),
      ],
    );
  }

  Widget _legendItem(Color c, String label) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: c, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Color(0xFF263238))),
      ],
    );
  }
}

class SlotCard extends StatelessWidget {
  const SlotCard({
    super.key,
    required this.slot,
    required this.mine,
    this.onBook,
    this.onCancel,
    this.onWaitlist,
  });

  final Map<String, dynamic> slot;
  final bool mine;
  final VoidCallback? onBook;
  final VoidCallback? onCancel;
  final VoidCallback? onWaitlist;

  @override
  Widget build(BuildContext context) {
    final status = "${slot['status']}";
    final color = slotStatusColor(status);
    final price = (slot['priceRupees'] as num?) ?? 0;
    return GestureDetector(
      onLongPress: mine && onCancel != null ? onCancel : null,
      child: Container(
        key: ValueKey('slot-card-${slot['id']}'),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        key: ValueKey('slot-dot-$status'),
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          "${slot['slotName']}",
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF263238)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    "${slot['duration']} • ₹${price.toInt()} / slot",
                    style: const TextStyle(fontSize: 11.5, color: Colors.grey),
                  ),
                  Text(
                    "${slot['recommendedTask'] ?? ''}",
                    style: const TextStyle(fontSize: 10.5, color: Colors.grey),
                  ),
                  if (status == 'booked' && slot['bookedByName'] != null)
                    Text(
                      "${slot['bookedByName']}",
                      style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Colors.red),
                    ),
                  if (mine)
                    const Text(
                      "रद्द करने हेतु दबाकर रखें",
                      style: TextStyle(fontSize: 9.5, fontStyle: FontStyle.italic, color: Colors.grey),
                    ),
                ],
              ),
            ),
            _buildAction(status),
          ],
        ),
      ),
    );
  }

  Widget _buildAction(String status) {
    if (status == 'available') {
      return ElevatedButton(
        onPressed: onBook,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF43A047),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          minimumSize: const Size(48, 48),
        ),
        child: const Text("बुक करें", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
      );
    }
    if (mine) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: slotStatusColor(status).withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          slotStatusLabel(status),
          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: slotStatusColor(status)),
        ),
      );
    }
    return OutlinedButton(
      onPressed: onWaitlist,
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.red,
        side: const BorderSide(color: Colors.red),
        minimumSize: const Size(48, 48),
      ),
      child: const Text("वेटलिस्ट जोड़ें", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }
}

