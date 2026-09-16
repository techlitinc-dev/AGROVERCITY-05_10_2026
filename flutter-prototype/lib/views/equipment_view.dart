// Module L: Equipment Sharing Network Flutter View (CRD Change 10)

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';

class EquipmentView extends StatefulWidget {
  final AppState state;
  const EquipmentView({super.key, required this.state});

  @override
  State<EquipmentView> createState() => _EquipmentViewState();
}

class _EquipmentViewState extends State<EquipmentView> {
  String _selectedEquipmentId = 'eq1';

  @override
  Widget build(BuildContext context) {
    final slots = widget.state.yantraSlots.where((s) => s.equipmentId == _selectedEquipmentId).toList();

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Time-Slot Yantra Booking", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                  Text("Morning, Afternoon, Evening, Night Slots", style: TextStyle(fontSize: 11.5, color: Color(0xFF90A4AE))),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(8)),
                child: const Text("Max 2 Slots", style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32))),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Equipment Selection Cards
          _buildEquipmentCard("eq1", "Mahindra 575 DI Tractor + Cultivator", "Subhash Shinde (+91 94222 11099)", "1.8 km • Pimpalgaon", "₹800 / slot"),
          _buildEquipmentCard("eq2", "Automated Laser Land Leveler", "CHC Krishi Vikas (+91 98900 44321)", "4.5 km • Niphad", "₹1,200 / slot"),
          const SizedBox(height: 16),

          // Time Slots Matrix (CRD Change 10)
          GlassCard(
            backgroundColor: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("⏰ Select Time Slots (Today)", style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                    Text("Rule: Max 2 slots", style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey)),
                  ],
                ),
                const SizedBox(height: 10),

                // Status Indicator Legend
                Row(
                  children: [
                    _legendItem(Colors.green, "Available"),
                    const SizedBox(width: 12),
                    _legendItem(Colors.red, "Booked"),
                    const SizedBox(width: 12),
                    _legendItem(Colors.amber, "Pending Approval"),
                  ],
                ),
                const SizedBox(height: 14),

                // 4 Time Slots Cards
                ...slots.map((s) => _buildSlotTile(s)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _legendItem(Color c, String label) {
    return Row(
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Color(0xFF263238))),
      ],
    );
  }

  Widget _buildEquipmentCard(String id, String name, String owner, String loc, String rate) {
    final sel = _selectedEquipmentId == id;
    return GlassCard(
      onTap: () => setState(() => _selectedEquipmentId = id),
      backgroundColor: sel ? const Color(0xFFE8F5E9) : Colors.white,
      border: Border.all(color: sel ? const Color(0xFF43A047) : const Color(0xFFECEFF1), width: sel ? 1.5 : 1),
      margin: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(loc, style: const TextStyle(fontSize: 10.5, color: Color(0xFF90A4AE))),
                Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF263238))),
                Text("Owner: $owner", style: const TextStyle(fontSize: 11, color: Colors.black54)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(rate, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF2E7D32))),
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.call_rounded, size: 18, color: Color(0xFF43A047)),
                    onPressed: () => widget.state.showToast("Calling Owner: $owner..."),
                  ),
                  IconButton(
                    icon: const Icon(Icons.map_rounded, size: 18, color: Color(0xFF0284C7)),
                    onPressed: () => widget.state.showToast("Opening Map Route ($loc)..."),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSlotTile(YantraSlot s) {
    Color statusColor = Colors.green;
    String statusText = "Available";
    if (s.status == 'booked') {
      statusColor = Colors.red;
      statusText = "Booked";
    } else if (s.status == 'pending') {
      statusColor = Colors.amber.shade800;
      statusText = "Pending Approval";
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: statusColor.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Text(s.slotName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF263238))),
                ],
              ),
              const SizedBox(height: 2),
              Text("${s.timeRange} • ₹${s.price.toInt()} / slot", style: const TextStyle(fontSize: 11.5, color: Colors.grey)),
            ],
          ),
          if (s.status == 'available')
            ElevatedButton(
              onPressed: () => widget.state.bookYantraSlot(s.id),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF43A047), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6)),
              child: const Text("Book Slot", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
            )
          else if (s.status == 'booked')
            OutlinedButton(
              onPressed: () => widget.state.showToast("Waitlist registered for slot ${s.slotName}! Owner will notify if cancelled."),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red, side: const BorderSide(color: Colors.red)),
              child: const Text("Join Waitlist", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: Colors.amber.shade100, borderRadius: BorderRadius.circular(8)),
              child: Text(statusText, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Colors.amber.shade900)),
            ),
        ],
      ),
    );
  }
}

