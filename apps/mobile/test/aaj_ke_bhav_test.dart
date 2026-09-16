import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/components/mandi/aaj_ke_bhav_widget.dart';

import 'helpers.dart';

const _rate1 = {
  'id': 'vyapari-1',
  'crop': 'Tomato (टमाटर)',
  'rateDisplay': '₹24/kg',
  'priceChange': '₹2',
  'changeDir': 'up',
  'mandiName': 'Nashik Mandi',
  'vyapariCount': 3,
  'lastUpdated': '10 mins ago',
};

const _rate2 = {
  'id': 'vyapari-2',
  'crop': 'Onion (प्याज)',
  'rateDisplay': '₹18/kg',
  'priceChange': '₹1',
  'changeDir': 'down',
  'mandiName': 'Pimpalgaon Mandi',
  'vyapariCount': 5,
  'lastUpdated': '15 mins ago',
};

void main() {
  testWidgets('widget renders vyapari rates', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final api = FakeMandiApi();
    api.vyapariResponse = const {
      'data': [_rate1, _rate2],
      'cachedAt': '2026-09-16T10:00:00.000Z',
    };

    await pumpScreen(
      tester,
      AajKeBhavWidget(state: TestAppState(), mandiApi: api),
    );

    expect(find.text('₹24/kg'), findsOneWidget);
    expect(find.textContaining('Nashik Mandi'), findsWidgets);
    expect(find.text('₹18/kg'), findsOneWidget);

    await tester.pump(const Duration(seconds: 1));
  });

  testWidgets('falls back to cache on error', (tester) async {
    SharedPreferences.setMockInitialValues({
      kVyapariCache: jsonEncode({
        'fetchedAt': '2026-09-16T10:30:00.000',
        'data': [_rate1],
      }),
    });
    final api = FakeMandiApi();
    api.vyapariError = const ApiException(code: 'NETWORK_ERROR');

    await pumpScreen(
      tester,
      AajKeBhavWidget(state: TestAppState(), mandiApi: api),
    );

    expect(find.text('₹24/kg'), findsOneWidget);
    expect(find.textContaining('cached'), findsOneWidget);

    await tester.pump(const Duration(seconds: 1));
  });
}
