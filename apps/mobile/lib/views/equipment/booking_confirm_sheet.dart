import 'package:flutter/material.dart';

import '../../state/app_state.dart';

// Pops with true on confirm, null when dismissed.
class BookingConfirmSheet extends StatelessWidget {
  const BookingConfirmSheet({
    super.key,
    required this.state,
    required this.machineName,
    required this.ownerType,
    required this.date,
    required this.slot,
  });

  final AppState state;
  final String machineName;
  final String ownerType;
  final String date;
  final Map<String, dynamic> slot;

  @override
  Widget build(BuildContext context) {
    final price = (slot['priceRupees'] as num?) ?? 0;
    final isFpo = ownerType == 'fpo';
    return Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.tr('equipment.confirmSlotBookingTitle'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          Text(machineName, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF263238))),
          const SizedBox(height: 4),
          Text("$date • ${slot['slotName']}", style: TextStyle(fontSize: 12.5, color: Colors.grey.shade700)),
          Text("${state.tr('equipment.rentLabel')}: ₹${price.toInt()} (${slot['duration']})", style: TextStyle(fontSize: 12.5, color: Colors.grey.shade700)),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isFpo ? const Color(0xFFE8F5E9) : Colors.amber.shade50,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              isFpo ? state.tr('equipment.autoConfirmFpo') : state.tr('equipment.ownerApprovalNeeded'),
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: isFpo ? const Color(0xFF2E7D32) : Colors.amber.shade900,
              ),
            ),
          ),
          const SizedBox(height: 14),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF43A047),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 48),
            ),
            child: Text(state.tr('equipment.confirmBooking'), style: const TextStyle(fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
  }
}
