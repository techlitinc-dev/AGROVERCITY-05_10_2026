// E-Market dashboard building blocks — stat cards & plain-widget bar charts
// (no chart package; bars are Containers/Rows per project convention).

import 'package:flutter/material.dart';
import '../../models/emarket_models.dart';
import '../mandi/mandi_price_card.dart';

class CustomerStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const CustomerStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.25)),
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.08), blurRadius: 10),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w700, color: Colors.grey.shade600),
          ),
        ],
      ),
    );
  }
}

class CategorySpendBars extends StatelessWidget {
  final List<CategorySpend> items;
  final Color color;

  const CategorySpendBars({super.key, required this.items, required this.color});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox(
        height: 54,
        child: Center(
          child: Text('—', style: TextStyle(color: Colors.grey)),
        ),
      );
    }
    final max = items.fold<double>(
      0,
      (m, e) => e.amount > m ? e.amount : m,
    );
    return Column(
      children: [
        for (final e in items.take(5))
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                SizedBox(
                  width: 86,
                  child: Text(
                    e.category,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
                  ),
                ),
                Expanded(
                  child: Stack(
                    children: [
                      Container(
                        height: 14,
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(7),
                        ),
                      ),
                      FractionallySizedBox(
                        widthFactor: max > 0 ? (e.amount / max).clamp(0.04, 1.0) : 0.04,
                        child: Container(
                          height: 14,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [color.withValues(alpha: 0.75), color],
                            ),
                            borderRadius: BorderRadius.circular(7),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  "₹${fmtInr(e.amount)}",
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class MonthlySpendChart extends StatelessWidget {
  final List<SpendMonth> months;
  final Color color;

  const MonthlySpendChart({super.key, required this.months, required this.color});

  @override
  Widget build(BuildContext context) {
    if (months.isEmpty) {
      return const SizedBox(
        height: 74,
        child: Center(child: Text('—', style: TextStyle(color: Colors.grey))),
      );
    }
    final max = months.fold<double>(0, (m, e) => e.amount > m ? e.amount : m);
    final shown = months.length > 12 ? months.sublist(months.length - 12) : months;
    return SizedBox(
      height: 86,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final m in shown)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Container(
                      height: max > 0 ? (58 * (m.amount / max)).clamp(3.0, 58.0) : 3,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [color.withValues(alpha: 0.55), color],
                        ),
                        borderRadius: BorderRadius.circular(5),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      m.month.length > 3 ? m.month.substring(0, 3) : m.month,
                      maxLines: 1,
                      style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
