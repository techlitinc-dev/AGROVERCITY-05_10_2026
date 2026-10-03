// Direct-buyer shared building blocks — status chips, section cards, info
// rows, empty states, star rating input & status label/color maps.

import 'package:flutter/material.dart';

import '../../state/app_state.dart';

class DirectStatusChip extends StatelessWidget {
  final String label;
  final Color color;

  const DirectStatusChip({super.key, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(7),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: color),
      ),
    );
  }
}

class DirectSectionCard extends StatelessWidget {
  final String title;
  final Widget child;
  final Widget? trailing;

  const DirectSectionCard({
    super.key,
    required this.title,
    required this.child,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
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
                  title,
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class DirectInfoRow extends StatelessWidget {
  final String label;
  final String value;

  const DirectInfoRow({super.key, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Colors.grey.shade600),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
          ),
        ],
      ),
    );
  }
}

class DirectEmptyState extends StatelessWidget {
  final IconData icon;
  final String message;

  const DirectEmptyState({super.key, required this.icon, required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: Column(
        children: [
          Icon(icon, size: 36, color: Colors.grey.shade400),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class DirectStarRating extends StatelessWidget {
  final int value;
  final ValueChanged<int> onChanged;

  const DirectStarRating({super.key, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 1; i <= 5; i++)
          IconButton(
            onPressed: () => onChanged(i),
            icon: Icon(
              i <= value ? Icons.star_rounded : Icons.star_outline_rounded,
              size: 34,
              color: const Color(0xFFF59E0B),
            ),
          ),
      ],
    );
  }
}

Color purchaseStatusColor(String status) => switch (status) {
      'confirmed' => const Color(0xFFD97706),
      'advancePaid' => const Color(0xFF2563EB),
      'pickupScheduled' => const Color(0xFF7C3AED),
      'inTransit' => const Color(0xFF0284C7),
      'delivered' => const Color(0xFF0D9488),
      'qcDisputed' => const Color(0xFFDC2626),
      'completed' => const Color(0xFF16A34A),
      'cancelled' => Colors.grey,
      _ => Colors.grey,
    };

String purchaseStatusLabel(AppState state, String status) =>
    state.tr('direct.st_$status');

String demandStatusLabel(AppState state, String status) =>
    state.tr('direct.demandStatus_$status');

Color demandStatusColor(String status) => switch (status) {
      'open' => const Color(0xFF16A34A),
      'fulfilled' => const Color(0xFF2563EB),
      'closed' => Colors.grey,
      _ => Colors.grey,
    };

String offerStatusLabel(AppState state, String status) =>
    state.tr('direct.offerStatus_$status');

Color offerStatusColor(String status) => switch (status) {
      'pending' => const Color(0xFFD97706),
      'countered' => const Color(0xFF7C3AED),
      'accepted' => const Color(0xFF16A34A),
      'rejected' => const Color(0xFFDC2626),
      'withdrawn' => Colors.grey,
      _ => Colors.grey,
    };

String qtyText(double qty) =>
    qty == qty.roundToDouble() ? qty.toStringAsFixed(0) : qty.toStringAsFixed(2);
