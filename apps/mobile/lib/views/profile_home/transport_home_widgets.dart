import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../components/common/motion_animations.dart';

String formatRupees(num value) =>
    NumberFormat.decimalPattern('en_IN').format(value);

String tripStatusChip(String status) => switch (status) {
      'requested' => "अनुरोध ⚪",
      'accepted' => "स्वीकृत 🟡",
      'enRoute' => "रास्ते में 🟢",
      'delivered' => "पूर्ण ✅",
      'cancelled' => "रद्द 🔴",
      _ => status,
    };

class MetricPill extends StatelessWidget {
  const MetricPill({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
  });

  final String title;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          children: [
            Icon(icon, size: 16, color: Colors.white),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w900)),
            Text(title, style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 9)),
          ],
        ),
      ),
    );
  }
}

class TransportActionCard extends StatelessWidget {
  const TransportActionCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
    this.badgeCount = 0,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    return BouncyPressable(
      onTap: onTap,
      child: Container(
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
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: color, size: 20),
                ),
                if (badgeCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDC2626),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      "$badgeCount",
                      style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w900),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
            const SizedBox(height: 2),
            Text(subtitle, style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600)),
          ],
        ),
      ),
    );
  }
}

class TripRow extends StatelessWidget {
  const TripRow({
    super.key,
    required this.booking,
    required this.onTap,
    this.onTracking,
    this.onBilty,
    this.onExpenses,
  });

  final Map<String, dynamic> booking;
  final VoidCallback onTap;
  final VoidCallback? onTracking;
  final VoidCallback? onBilty;
  final VoidCallback? onExpenses;

  @override
  Widget build(BuildContext context) {
    final vehicleNo = booking['vehicleNo'] as String?;
    final fare = (booking['fare'] as num?) ?? 0;
    final status = "${booking['status']}";
    final canShowActions = status == 'accepted' || status == 'enRoute' || status == 'delivered';

    return BouncyPressable(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      vehicleNo == null || vehicleNo.isEmpty
                          ? "— (${booking['vehicleType']})"
                          : "$vehicleNo (${booking['vehicleType']})",
                      style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                    ),
                    Text(
                      "${booking['pickup']} ➔ ${booking['drop']}",
                      style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text("₹${formatRupees(fare)}", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF0284C7))),
                  Text(tripStatusChip(status), style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
          if (canShowActions && (onTracking != null || onBilty != null || onExpenses != null)) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (onTracking != null)
                  _miniButton(
                    icon: Icons.navigation_rounded,
                    label: "ट्रैकिंग",
                    color: const Color(0xFF0284C7),
                    onTap: onTracking!,
                  ),
                if (onBilty != null) ...[
                  const SizedBox(width: 6),
                  _miniButton(
                    icon: Icons.receipt_long_rounded,
                    label: "ई-बिल्टी",
                    color: const Color(0xFF0D9488),
                    onTap: onBilty!,
                  ),
                ],
                if (onExpenses != null) ...[
                  const SizedBox(width: 6),
                  _miniButton(
                    icon: Icons.monetization_on_rounded,
                    label: "खर्च",
                    color: const Color(0xFF16A34A),
                    onTap: onExpenses!,
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _miniButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 11.5, color: color),
            const SizedBox(width: 3.5),
            Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}
