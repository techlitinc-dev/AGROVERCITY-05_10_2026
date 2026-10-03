// Farm Diary daily income & expense line chart (last ≤31 days of byDay).

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../data/translations.dart';
import '../../models/diary_analytics.dart';
import '../../state/app_state.dart';

String _t(AppState? state, String key) =>
    state != null ? state.tr(key) : AppTranslations.get(key, 'hi');

class DiaryActivityChart extends StatelessWidget {
  final List<DaySummary> data; // byDay (ascending); last 31 used
  final AppState? state;

  const DiaryActivityChart({super.key, required this.data, this.state});

  static const _incomeColor = Color(0xFF2D6A4F);
  static const _expenseColor = Color(0xFFE76F51);

  bool get _hasData => data.any((d) => d.income != 0 || d.expense != 0);

  @override
  Widget build(BuildContext context) {
    if (!_hasData) {
      return Container(
        height: 190,
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

    final days =
        data.length > 31 ? data.sublist(data.length - 31) : List.of(data);
    final maxIncome =
        days.fold<double>(0, (m, d) => d.income > m ? d.income : m);
    final maxExpense =
        days.fold<double>(0, (m, d) => d.expense > m ? d.expense : m);
    final topY = ([maxIncome, maxExpense].reduce((a, b) => a > b ? a : b) * 1.2) + 1;
    final lastIndex = days.length - 1;

    LineChartBarData series(
      List<DaySummary> days,
      double Function(DaySummary) get,
      Color color,
      double max,
    ) {
      return LineChartBarData(
        spots: [
          for (var i = 0; i < days.length; i++)
            FlSpot(i.toDouble(), get(days[i])),
        ],
        isCurved: true,
        preventCurveOverShooting: true,
        color: color,
        barWidth: 2.5,
        dotData: FlDotData(
          show: true,
          // Dot only on the series' max point.
          checkToShowDot: (spot, barData) => max > 0 && spot.y == max,
        ),
        belowBarData: BarAreaData(
          show: true,
          color: color.withValues(alpha: 0.08),
        ),
      );
    }

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
          height: 190,
          child: LineChart(
            LineChartData(
              minY: 0,
              maxY: topY,
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                horizontalInterval: topY / 4,
                getDrawingHorizontalLine: (value) => FlLine(
                  color: Colors.grey.shade200,
                  strokeWidth: 1,
                ),
              ),
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
                      if (i != 0 && i != lastIndex) {
                        return const SizedBox.shrink();
                      }
                      if (i < 0 || i >= days.length) {
                        return const SizedBox.shrink();
                      }
                      final d = DateTime.tryParse(days[i].date);
                      if (d == null) return const SizedBox.shrink();
                      return Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          DateFormat('dd MMM').format(d),
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
              borderData: FlBorderData(show: false),
              lineTouchData: const LineTouchData(enabled: false),
              lineBarsData: [
                series(days, (d) => d.income, _incomeColor, maxIncome),
                series(days, (d) => d.expense, _expenseColor, maxExpense),
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
}
