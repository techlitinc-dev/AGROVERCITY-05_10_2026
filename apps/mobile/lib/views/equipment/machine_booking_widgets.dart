import 'package:flutter/material.dart';

import 'equipment_widgets.dart' show slotStatusLabel;

class MachineSelectCard extends StatelessWidget {
  const MachineSelectCard({
    super.key,
    required this.machine,
    required this.selected,
    required this.onTap,
  });

  final Map<String, dynamic> machine;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isFpo = machine['ownerType'] == 'fpo';
    final rate = (machine['hourlyRate'] as num?) ?? 0;
    final distance = (machine['distanceKm'] as num?) ?? 0;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFE8F5E9) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? const Color(0xFF43A047) : const Color(0xFFECEFF1),
            width: selected ? 1.5 : 1,
          ),
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
                      Flexible(
                        child: Text(
                          "${machine['name']}",
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF263238)),
                        ),
                      ),
                      if (isFpo)
                        Container(
                          margin: const EdgeInsets.only(left: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1B4332),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text("FPO", style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                        ),
                    ],
                  ),
                  Text(
                    "${machine['type']} • $distance km दूर",
                    style: const TextStyle(fontSize: 11, color: Colors.black54),
                  ),
                ],
              ),
            ),
            Text(
              "₹${rate.toInt()} / घंटा",
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF2E7D32)),
            ),
          ],
        ),
      ),
    );
  }
}

class DayCell extends StatelessWidget {
  const DayCell({
    super.key,
    required this.day,
    required this.selected,
    required this.onTap,
  });

  final DateTime day;
  final bool selected;
  final VoidCallback onTap;

  static const dayNames = ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'];

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF43A047) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? const Color(0xFF43A047) : Colors.grey.shade300),
        ),
        child: Column(
          children: [
            Text(
              dayNames[day.weekday - 1],
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: selected ? Colors.white : Colors.grey),
            ),
            Text(
              "${day.day}/${day.month}",
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: selected ? Colors.white : const Color(0xFF263238)),
            ),
          ],
        ),
      ),
    );
  }
}

class MyBookingCard extends StatelessWidget {
  const MyBookingCard({super.key, required this.booking, this.onRebook});

  final Map<String, dynamic> booking;
  final VoidCallback? onRebook;

  @override
  Widget build(BuildContext context) {
    final status = "${booking['status']}";
    final price = (booking['priceRupees'] as num?) ?? 0;
    final rejected = status == 'rejected';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: rejected ? Colors.red.shade200 : Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  "${booking['equipmentName'] ?? ''}",
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF263238)),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: rejected ? Colors.red.shade50 : Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  rejected ? "अस्वीकृत" : slotStatusLabel(status),
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: rejected ? Colors.red : Colors.amber.shade900,
                  ),
                ),
              ),
            ],
          ),
          Text(
            "${booking['date'] ?? ''} • ${booking['slotName'] ?? ''} • ₹${price.toInt()}",
            style: const TextStyle(fontSize: 11.5, color: Colors.grey),
          ),
          if (rejected) ...[
            const SizedBox(height: 4),
            Text(
              "कारण: ${booking['rejectionReason'] ?? ''}",
              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFFDC2626)),
            ),
            TextButton.icon(
              onPressed: onRebook,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text("फिर से बुक करें", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            ),
          ],
        ],
      ),
    );
  }
}
