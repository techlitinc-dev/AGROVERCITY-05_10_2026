// Farm Diary monthly income-vs-expense grouped bar chart (model-driven).

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../data/translations.dart';
import '../../models/diary_analytics.dart';
import '../../state/app_state.dart';
import '../mandi/mandi_price_card.dart' show fmtInr;

String _t(AppState? state, String key) =>
    state != null ? state.tr(key) : AppTranslations.get(key, 'hi');

class DiaryMonthlyChart extends StatelessWidget {
  final List<MonthSummary> data;
  final AppState? state;

  const DiaryMonthlyChart({super.key, required this.data, this.state});

  static const _incomeColor = Color(0xFF2D6A4F);
  static const _expenseColor = Color(0xFFE76F51);

  bool get _hasData => data.any((m) => m.income != 0 || m.expense != 0);

  @override
  Widget build(BuildContext context) {
    if (!_hasData) {
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

    final maxVal = data.fold<double>(
      0,
      (max, m) => m.income > max
          ? m.income
          : m.expense > max
              ? m.expense
              : max,
    );
    final topY = (maxVal * 1.25) + 1;
    final labelEvery = (data.length / 7).ceil();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _legendDot(_incomeColor, _t(state, 'farmDiary.income')),
            const SizedBox(width: 14),
            _legendDot(_expenseColor, _t(state, 'farmDiary.expense')),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 210,
          child: BarChart(
            BarChartData(
              minY: 0,
              maxY: topY,
              alignment: BarChartAlignment.spaceAround,
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                horizontalInterval: topY / 4,
                getDrawingHorizontalLine: (value) => FlLine(
                  color: Colors.grey.shade200,
                  strokeWidth: 1,
                ),
              ),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                show: true,
                topTitles: const AxisTitles(),
                rightTitles: const AxisTitles(),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 34,
                    interval: topY / 4,
                    getTitlesWidget: (value, meta) {
                      if (value == 0) return const SizedBox.shrink();
                      return Padding(
                        padding: const EdgeInsets.only(right: 4),
                        child: Text(
                          value >= 1000
                              ? '${(value / 1000).round()}k'
                              : '${value.round()}',
                          style: const TextStyle(
                            fontSize: 8.5,
                            color: Colors.grey,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      );
                    },
                  ),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    interval: 1,
                    getTitlesWidget: (value, meta) {
                      final i = value.toInt();
                      if (i < 0 || i >= data.length) {
                        return const SizedBox.shrink();
                      }
                      if (i % labelEvery != 0) return const SizedBox.shrink();
                      return Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          _monthLabel(data[i].month),
                          style: const TextStyle(
                            fontSize: 8.5,
                            color: Colors.grey,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              barTouchData: BarTouchData(
                handleBuiltInTouches: true,
                touchTooltipData: BarTouchTooltipData(
                  fitInsideHorizontally: true,
                  fitInsideVertically: true,
                  getTooltipColor: (group) => const Color(0xFF112A1F),
                  tooltipPadding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  tooltipRoundedRadius: 8,
                  getTooltipItem: (group, groupIndex, rod, rodIndex) {
                    final label = rodIndex == 0
                        ? _t(state, 'farmDiary.income')
                        : _t(state, 'farmDiary.expense');
                    return BarTooltipItem(
                      '$label\n₹${fmtInr(rod.toY)}',
                      const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        height: 1.3,
                      ),
                    );
                  },
                ),
              ),
              barGroups: [
                for (var i = 0; i < data.length; i++)
                  BarChartGroupData(
                    x: i,
                    barsSpace: 3,
                    barRods: [
                      BarChartRodData(
                        toY: data[i].income,
                        width: 9,
                        color: _incomeColor,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(4),
                        ),
                      ),
                      BarChartRodData(
                        toY: data[i].expense,
                        width: 9,
                        color: _expenseColor,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(4),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _legendDot(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w700),
        ),
      ],
    );
  }

  // "2026-09" → "Sep 26" style label.
  static String _monthLabel(String month) {
    final d = DateTime.tryParse('$month-01');
    if (d == null) return month;
    return DateFormat('MMM yy').format(d);
  }
}
