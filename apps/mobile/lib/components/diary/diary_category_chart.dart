// Farm Diary expense-by-category donut chart with center total + legend.

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../data/translations.dart';
import '../../models/diary_analytics.dart';
import '../../state/app_state.dart';
import '../mandi/mandi_price_card.dart' show fmtInr;

String _t(AppState? state, String key) =>
    state != null ? state.tr(key) : AppTranslations.get(key, 'hi');

class DiaryCategoryChart extends StatelessWidget {
  final List<CategorySummary> data; // byCategory (expense rows used)
  final AppState? state;

  const DiaryCategoryChart({super.key, required this.data, this.state});

  static const _palette = [
    Color(0xFF4338CA), // indigo
    Color(0xFFE9C46A), // gold
    Color(0xFF2D6A4F), // green
    Color(0xFFE76F51), // orange
    Color(0xFF7C3AED), // violet
    Color(0xFF0891B2), // cyan
  ];
  static const _otherColor = Color(0xFF94A3B8);

  @override
  Widget build(BuildContext context) {
    // Expense rows only, sorted amount desc, top 6 + "others" bucket.
    final expenses = data
        .where((c) => c.type == 'expense' && c.amount > 0)
        .toList()
      ..sort((a, b) => b.amount.compareTo(a.amount));

    if (expenses.isEmpty) {
      return Container(
        height: 200,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          _t(state, 'noDataAvailable'),
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: Colors.grey,
          ),
        ),
      );
    }

    final top = expenses.take(6).toList();
    final restAmount =
        expenses.skip(6).fold<double>(0, (sum, c) => sum + c.amount);
    final total = expenses.fold<double>(0, (sum, c) => sum + c.amount);

    final slices = <({String name, double amount, Color color})>[
      for (var i = 0; i < top.length; i++)
        (name: top[i].category, amount: top[i].amount, color: _palette[i]),
      if (restAmount > 0)
        (
          name: _t(state, 'farmDiary.otherCategory'),
          amount: restAmount,
          color: _otherColor
        ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 185,
          child: Stack(
            alignment: Alignment.center,
            children: [
              PieChart(
                PieChartData(
                  centerSpaceRadius: 46,
                  centerSpaceColor: Colors.white,
                  sectionsSpace: 2,
                  borderData: FlBorderData(show: false),
                  pieTouchData: PieTouchData(enabled: false),
                  sections: [
                    for (final s in slices)
                      PieChartSectionData(
                        // Keep tiny slices visible: clamp to 1% of the total.
                        value: s.amount / total < 0.01
                            ? total * 0.01
                            : s.amount,
                        color: s.color,
                        radius: 58,
                        showTitle: false,
                      ),
                  ],
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _t(state, 'farmDiary.totalExpense'),
                    style: const TextStyle(
                      fontSize: 9.5,
                      color: Colors.grey,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    '₹${fmtInr(total)}',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF112A1F),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            for (final s in slices)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: s.color.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration:
                          BoxDecoration(color: s.color, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      '${s.name} • ₹${fmtInr(s.amount)}',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF374151),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }
}
