import 'package:flutter/material.dart';
import '../mandi/mandi_price_card.dart';

class CheckoutAddressCard extends StatelessWidget {
  final String? composedAddress;
  final String? label;
  final VoidCallback onTap;

  const CheckoutAddressCard({
    super.key,
    required this.composedAddress,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasAddress = composedAddress != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF86EFAC)),
        ),
        child: Row(
          children: [
            const Icon(Icons.location_on_rounded, size: 18, color: Color(0xFF16A34A)),
            const SizedBox(width: 8),
            Expanded(
              child: hasAddress
                  ? Text(
                      "$label: $composedAddress",
                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF166534)),
                    )
                  : const Text(
                      "डिलीवरी पता चुनें / जोड़ें",
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF166534)),
                    ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF16A34A)),
          ],
        ),
      ),
    );
  }
}

class CheckoutMethodTiles extends StatelessWidget {
  final String groupValue;
  final ValueChanged<String?> onChanged;

  const CheckoutMethodTiles({
    super.key,
    required this.groupValue,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return RadioGroup<String>(
      groupValue: groupValue,
      onChanged: onChanged,
      child: const Column(
        children: [
          _MethodTile(id: 'upi', label: "UPI (Razorpay)", icon: Icons.account_balance_wallet_rounded),
          _MethodTile(id: 'cod', label: "Cash on Delivery (COD)", icon: Icons.payments_rounded),
          _MethodTile(id: 'bnpl', label: "0% BNPL (2 किश्तें)", icon: Icons.schedule_rounded),
        ],
      ),
    );
  }
}

class _MethodTile extends StatelessWidget {
  final String id;
  final String label;
  final IconData icon;

  const _MethodTile({required this.id, required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    return RadioListTile<String>(
      dense: true,
      contentPadding: EdgeInsets.zero,
      activeColor: const Color(0xFF16A34A),
      value: id,
      secondary: Icon(icon, size: 18, color: const Color(0xFF16A34A)),
      title: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
    );
  }
}

class OrderSuccessCard extends StatelessWidget {
  final Map<String, dynamic> order;

  const OrderSuccessCard({super.key, required this.order});

  @override
  Widget build(BuildContext context) {
    final schedule = (order['bnplSchedule'] as List?)?.cast<Map<String, dynamic>>();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F5E9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF16A34A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "✅ ऑर्डर सफल! #${order['orderId']}",
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF14532D)),
          ),
          if (schedule != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                "BNPL: किश्त 1 — ₹${fmtInr((schedule[0]['amount'] as num?) ?? 0)} "
                "(${schedule[0]['dueInDays']} दिन), किश्त 2 — ₹${fmtInr((schedule[1]['amount'] as num?) ?? 0)} "
                "(${schedule[1]['dueInDays']} दिन)",
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF166534)),
              ),
            ),
        ],
      ),
    );
  }
}
