import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/components/diary/diary_monthly_chart.dart';
import 'package:kisan_setu/data/translations.dart';
import 'package:kisan_setu/models/diary_analytics.dart';

Widget _host(Widget child) =>
    MaterialApp(home: Scaffold(body: Center(child: child)));

void main() {
  testWidgets('renders grouped bars and month labels from byMonth data',
      (tester) async {
    await tester.pumpWidget(_host(const DiaryMonthlyChart(
      data: [
        MonthSummary(
            month: '2026-08', income: 4000, expense: 1500, net: 2500, count: 4),
        MonthSummary(
            month: '2026-09', income: 8000, expense: 3000, net: 5000, count: 6),
      ],
    )));

    expect(find.byType(BarChart), findsOneWidget);
    expect(find.text('Aug 26'), findsOneWidget);
    expect(find.text('Sep 26'), findsOneWidget);
    expect(find.text('आय'), findsOneWidget); // legend (hi fallback)
    expect(find.text('खर्च'), findsOneWidget); // legend (hi fallback)
  });

  testWidgets('shows empty state when there is no data', (tester) async {
    await tester.pumpWidget(_host(const DiaryMonthlyChart(data: [])));

    expect(find.byType(BarChart), findsNothing);
    expect(find.text(AppTranslations.get('noDataAvailable', 'hi')),
        findsOneWidget);
  });

  testWidgets('shows empty state when months are all zero', (tester) async {
    await tester.pumpWidget(_host(const DiaryMonthlyChart(
      data: [
        MonthSummary(month: '2026-09', income: 0, expense: 0, net: 0, count: 2),
      ],
    )));

    expect(find.byType(BarChart), findsNothing);
    expect(find.text(AppTranslations.get('noDataAvailable', 'hi')),
        findsOneWidget);
  });
}
