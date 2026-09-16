import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/views/farmer/sell_produce_view.dart';

import 'helpers.dart';

const _lot1 = {
  'id': 'lot_1',
  'farmerId': 'u1',
  'crop': 'Tomato (टमाटर)',
  'quantityQuintals': 10.0,
  'expectedRate': 1950,
  'harvestDate': '2026-09-10',
  'photos': <String>[],
  'location': {'lat': 20.0, 'lng': 73.8},
  'status': 'open',
  'createdAt': '2026-09-10T08:00:00.000Z',
};

const _lot2 = {
  'id': 'lot_2',
  'farmerId': 'u1',
  'crop': 'Onion (प्याज)',
  'quantityQuintals': 25.0,
  'expectedRate': 2100,
  'harvestDate': '2026-09-01',
  'photos': <String>[],
  'location': {'lat': 20.0, 'lng': 73.8},
  'status': 'withdrawn',
  'createdAt': '2026-09-01T08:00:00.000Z',
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('form validates quantity > 0', (tester) async {
    final api = FakeLotsApi();

    await pumpScreen(
      tester,
      Scaffold(body: SellProduceView(state: TestAppState(), lotsApi: api)),
    );

    await tester.enterText(find.byType(TextField).first, '0');
    await tester.tap(find.text('लॉट पोस्ट करें'));
    await tester.pump();

    expect(find.text('मात्रा 0 से अधिक होनी चाहिए'), findsOneWidget);
    expect(api.lastCreateFields, isNull);
  });

  testWidgets('submit records createLot with fields', (tester) async {
    final api = FakeLotsApi();

    await pumpScreen(
      tester,
      Scaffold(body: SellProduceView(state: TestAppState(), lotsApi: api)),
    );

    await tester.enterText(find.byType(TextField).at(0), '10');
    await tester.enterText(find.byType(TextField).at(1), '1950');
    await tester.tap(find.text('लॉट पोस्ट करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    final fields = api.lastCreateFields;
    expect(fields, isNotNull);
    expect(fields!['quantityQuintals'], 10.0);
    expect(fields['expectedRate'], 1950);
    expect(fields['crop'], isNotEmpty);
    expect(fields['harvestDate'], matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
    expect(fields['location'], isA<Map>());

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('my lots list shows status chips and withdraw works',
      (tester) async {
    final api = FakeLotsApi();
    api.lotsResponse = const {
      'data': [_lot1, _lot2],
      'page': 1,
      'pageSize': 20,
      'total': 2,
    };

    await pumpScreen(
      tester,
      Scaffold(body: SellProduceView(state: TestAppState(), lotsApi: api)),
    );

    expect(find.text('open'), findsOneWidget);
    expect(find.text('withdrawn'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.undo_rounded).first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    await tester.tap(find.widgetWithText(ElevatedButton, 'वापस लें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.lastWithdrawnId, 'lot_1');

    await tester.pump(const Duration(seconds: 5));
  });
}
