import 'package:flutter/material.dart';

import '../equipment/equipment_widgets.dart' show slotStatusColor;

// Pops with the chosen unit count (>=1), or null when cancelled.
class JoinPoolDialog extends StatefulWidget {
  const JoinPoolDialog({super.key, required this.item});

  final String item;

  @override
  State<JoinPoolDialog> createState() => _JoinPoolDialogState();
}

class _JoinPoolDialogState extends State<JoinPoolDialog> {
  int _units = 1;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Text("पूल में यूनिट जोड़ें", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(widget.item, style: TextStyle(fontSize: 12.5, color: Colors.grey.shade700)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                key: const ValueKey('join-units-minus'),
                onPressed: _units > 1 ? () => setState(() => _units--) : null,
                icon: const Icon(Icons.remove_circle_outline_rounded),
              ),
              Text("$_units यूनिट", style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
              IconButton(
                key: const ValueKey('join-units-plus'),
                onPressed: () => setState(() => _units++),
                icon: const Icon(Icons.add_circle_outline_rounded),
              ),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text("रद्द करें")),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white),
          onPressed: () => Navigator.pop(context, _units),
          child: const Text("पुष्टि करें", style: TextStyle(fontWeight: FontWeight.w900)),
        ),
      ],
    );
  }
}

class PoolCard extends StatelessWidget {
  const PoolCard({super.key, required this.pool, required this.onJoin});

  final Map<String, dynamic> pool;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    final booked = (pool['bookedUnits'] as num?) ?? 0;
    final target = (pool['targetUnits'] as num?) ?? 1;
    final discount = (pool['discountPercent'] as num?) ?? 0;
    final progress = target > 0 ? (booked / target).clamp(0.0, 1.0) : 0.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text("📦 सामूहिक खरीद पूल: ${pool['item']}", style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800)),
            ),
            Text("$discount% छूट अनलॉक!", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF16A34A))),
          ],
        ),
        const SizedBox(height: 8),
        Text("$booked/$target बुक हो चुकी हैं", style: const TextStyle(fontSize: 11.5, color: Colors.grey)),
        const SizedBox(height: 8),
        LinearProgressIndicator(
          value: progress.toDouble(),
          backgroundColor: Colors.grey.shade200,
          valueColor: const AlwaysStoppedAnimation(Color(0xFF16A34A)),
        ),
        const SizedBox(height: 12),
        ElevatedButton.icon(
          onPressed: booked >= target ? null : onJoin,
          icon: const Icon(Icons.add_shopping_cart_rounded, size: 16),
          label: const Text("ग्रुप पूल में यूनिट जोड़ें", style: TextStyle(fontWeight: FontWeight.w700)),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1B4332),
            foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 40),
          ),
        ),
      ],
    );
  }
}

class MachineryCalendar extends StatelessWidget {
  const MachineryCalendar({super.key, required this.machines});

  final List<Map<String, dynamic>> machines;

  @override
  Widget build(BuildContext context) {
    if (machines.isEmpty) {
      return const Text("कोई FPO मशीन उपलब्ध नहीं", style: TextStyle(fontSize: 12, color: Colors.grey));
    }
    return Column(
      children: machines.map(_buildMachine).toList(),
    );
  }

  Widget _buildMachine(Map<String, dynamic> m) {
    final days = (m['days'] as Map?)?.cast<String, dynamic>() ?? const {};
    final dates = days.keys.toList()..sort();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("${m['name']}", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
          const SizedBox(height: 6),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: dates.map((d) => _buildDayCell(d, days[d])).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDayCell(String date, dynamic slotsRaw) {
    final slots = (slotsRaw as List?) ?? const [];
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Text(
            date.substring(5),
            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Colors.grey),
          ),
          const SizedBox(height: 4),
          Row(
            children: slots
                .map(
                  (s) => Container(
                    margin: const EdgeInsets.only(right: 2),
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: slotStatusColor("${(s as Map)['status']}"),
                      shape: BoxShape.circle,
                    ),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }
}
