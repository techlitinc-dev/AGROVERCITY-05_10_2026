import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/components/mandi/price_history_chart.dart';

import 'helpers.dart';

Map<String, dynamic> _point(DateTime date, int price) => {
      'date':
          "${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}",
      'modalPrice': price,
    };

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('chart renders with last price label', (tester) async {
    final api = FakeMandiApi();
    final start = DateTime(2026, 6, 18);
    api.historyResponse = {
      'data': [
        for (var i = 0; i < 90; i++)
          _point(start.add(Duration(days: i)), 1900 + i * 2),
      ],
    };

    await pumpScreen(
      tester,
      PriceHistoryChart(
        crop: 'Tomato',
        mandi: 'Pimpalgaon Baswant APMC',
        mandiApi: api,
      ),
    );

    expect(find.byType(LineChart), findsOneWidget);
    expect(find.text('₹2,078'), findsNWidgets(2)); // last == max: 1900 + 89*2
    expect(find.text('₹1,900'), findsOneWidget); // min
    expect(find.text('अंतिम भाव'), findsOneWidget);
    expect(api.lastHistoryCrop, 'Tomato');
    expect(api.lastHistoryMandi, 'Pimpalgaon Baswant APMC');
    expect(api.lastHistoryMonths, 3);
  });

  testWidgets('empty history shows fallback', (tester) async {
    final api = FakeMandiApi();
    api.historyResponse = const {'data': <Map<String, dynamic>>[]};

    await pumpScreen(
      tester,
      PriceHistoryChart(crop: 'Tomato', mandi: 'Unknown Mandi', mandiApi: api),
    );

    expect(find.text('डेटा उपलब्ध नहीं'), findsOneWidget);
    expect(find.byType(LineChart), findsNothing);
  });
}
