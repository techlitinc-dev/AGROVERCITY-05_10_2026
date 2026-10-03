import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/api/land_api.dart';
import 'package:kisan_setu/api/soil_tests_api.dart';
import 'package:kisan_setu/components/soil_test_booking_sheet.dart';
import 'package:kisan_setu/models/land_models.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeBookingSoilTestsApi extends SoilTestsApi {
  Object? bookError;
  final List<Map<String, dynamic>> bookCalls = [];

  @override
  Future<Map<String, dynamic>> bookSoilTest({
    String? plotId,
    required String address,
    required String slot,
  }) async {
    bookCalls.add({'plotId': plotId, 'address': address, 'slot': slot});
    final error = bookError;
    if (error != null) throw error;
    return {'id': 'st-1', 'status': 'booked'};
  }

  @override
  Future<List<Map<String, dynamic>>> listSoilTests() async => const [];
}

class FakePlotsLandApi extends LandApi {
  List<LandPlot> plots = const [
    LandPlot(
      id: 'plot1',
      name: 'प्लॉट A',
      village: 'ओझरखेड',
      district: 'नाशिक',
      areaAcres: 2.5,
      status: 'vacant',
    ),
  ];

  @override
  Future<List<LandPlot>> listPlots() async => plots;
}

Future<void> _openSheet(
  WidgetTester tester,
  FakeBookingSoilTestsApi api,
) async {
  final state = TestAppState();
  await openCheckoutSheet(
    tester,
    state,
    buildSheet: () => SoilTestBookingSheet(
      state: state,
      soilTestsApi: api,
      landApi: FakePlotsLandApi(),
    ),
  );
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('sheet renders fields', (tester) async {
    await _openSheet(tester, FakeBookingSoilTestsApi());

    expect(find.text('मिट्टी परीक्षण बुक करें'), findsOneWidget);
    expect(find.text('बिना प्लॉट'), findsOneWidget);
    expect(find.text('सुबह'), findsOneWidget);
    expect(find.text('दोपहर'), findsOneWidget);
    expect(
        find.widgetWithText(TextField, 'गांव, गट क्रमांक, लैंडमार्क...'),
        findsOneWidget);
  });

  testWidgets('book success shows snackbar', (tester) async {
    final api = FakeBookingSoilTestsApi();
    await _openSheet(tester, api);

    await tester.enterText(
        find.byType(TextField), 'गांव ओझरखेड, गट 123, नाशिक');
    await tester.tap(find.text('बुक करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.bookCalls.length, 1);
    expect(api.bookCalls.first['plotId'], isNull);
    expect(find.text('मिट्टी परीक्षण बुक हुआ'), findsOneWidget);
  });

  testWidgets('already booked shows error', (tester) async {
    final api = FakeBookingSoilTestsApi()
      ..bookError = const ApiException(code: 'SOIL_TEST_ALREADY_BOOKED');
    await _openSheet(tester, api);

    await tester.enterText(
        find.byType(TextField), 'गांव ओझरखेड, गट 123, नाशिक');
    await tester.tap(find.text('बुक करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.textContaining('पहले से बुक है'), findsOneWidget);
  });
}
