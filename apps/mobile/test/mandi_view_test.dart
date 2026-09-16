import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/views/mandi_view.dart';

import 'helpers.dart';

const _tomato1 = {
  'id': 'mandi-1',
  'mandiName': 'Pimpalgaon Baswant APMC',
  'distanceKm': 4.2,
  'commodity': 'Tomato (टमाटर)',
  'variety': 'Hybrid Red',
  'minPrice': 1600,
  'maxPrice': 2250,
  'modalPrice': 1950,
  'msp': 1400,
  'trend': 'up',
  'changePercent': '+8.4%',
  'arrivalsQuintals': 2400,
  'updatedAt': '10 mins ago',
};

const _tomato2 = {
  'id': 'mandi-2',
  'mandiName': 'Nashik (Dindori Road) APMC',
  'distanceKm': 18.5,
  'commodity': 'Tomato (टमाटर)',
  'variety': 'Abhinav Grade A',
  'minPrice': 1750,
  'maxPrice': 2400,
  'modalPrice': 2150,
  'msp': 1400,
  'trend': 'up',
  'changePercent': '+12.1%',
  'arrivalsQuintals': 4800,
  'updatedAt': '25 mins ago',
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('renders price cards from API', (tester) async {
    final api = FakeMandiApi();
    api.pricesResponse = const {
      'data': [_tomato1, _tomato2],
      'page': 1,
      'pageSize': 20,
      'total': 2,
    };

    await pumpScreen(tester, MandiView(state: TestAppState(), mandiApi: api));

    expect(find.text('Pimpalgaon Baswant APMC'), findsOneWidget);
    expect(find.text('Nashik (Dindori Road) APMC'), findsOneWidget);
    expect(find.text('₹1,950'), findsOneWidget);
    expect(find.text('₹2,150'), findsOneWidget);
  });

  testWidgets('crop chip filters request', (tester) async {
    final api = FakeMandiApi();
    api.pricesResponse = const {
      'data': [_tomato1],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };

    await pumpScreen(tester, MandiView(state: TestAppState(), mandiApi: api));
    expect(api.lastPricesCrop, isNull);

    await tester.tap(find.text('🧅 प्याज'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.lastPricesCrop, 'Onion');
  });

  testWidgets('error shows retry banner', (tester) async {
    final api = FakeMandiApi();
    api.pricesError = const ApiException(code: 'NETWORK_ERROR');

    await pumpScreen(tester, MandiView(state: TestAppState(), mandiApi: api));

    expect(find.text('पुनः प्रयास करें'), findsOneWidget);
  });
}
