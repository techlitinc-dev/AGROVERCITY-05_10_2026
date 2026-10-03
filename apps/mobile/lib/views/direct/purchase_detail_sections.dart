import 'package:flutter/material.dart';

import '../../components/direct/direct_widgets.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';

class PurchaseTimeline extends StatelessWidget {
  final AppState state;
  final List<PurchaseEvent> events;

  const PurchaseTimeline({super.key, required this.state, required this.events});

  static String fmtAt(String at) {
    final dt = DateTime.tryParse(at);
    if (dt == null) return at;
    final local = dt.toLocal();
    String two(int v) => v.toString().padLeft(2, '0');
    return "${two(local.day)}/${two(local.month)} ${two(local.hour)}:${two(local.minute)}";
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < events.length; i++)
          _timelineTile(events[i], i == events.length - 1),
      ],
    );
  }

  Widget _timelineTile(PurchaseEvent e, bool isLast) {
    const known = [
      'confirmed',
      'advancePaid',
      'pickupScheduled',
      'inTransit',
      'delivered',
      'qcDisputed',
      'completed',
      'cancelled',
    ];
    final color = purchaseStatusColor(e.status);
    final label =
        known.contains(e.status) ? purchaseStatusLabel(state, e.status) : e.status;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              Container(
                width: 12,
                height: 12,
                margin: const EdgeInsets.only(top: 3),
                decoration:
                    BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              if (!isLast)
                Expanded(
                    child: Container(width: 2, color: color.withValues(alpha: 0.3))),
            ],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          color: color)),
                  if (e.note.isNotEmpty)
                    Text(e.note,
                        style: TextStyle(
                            fontSize: 10.5, color: Colors.grey.shade600)),
                  if (e.at.isNotEmpty)
                    Text(fmtAt(e.at),
                        style: TextStyle(
                            fontSize: 9.5, color: Colors.grey.shade400)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
