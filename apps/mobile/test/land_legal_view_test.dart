import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/land_records_api.dart';
import 'package:kisan_setu/models/land_record.dart';
import 'package:kisan_setu/views/land_legal_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeLandRecordsApi extends LandRecordsApi {
  List<LandRecord712> searchResults = const [];
  Object? searchError;

  final List<Map<String, String?>> searchCalls = [];
  final List<String> importCalls = [];

  @override
  Future<List<LandRecord712>> search({
    String? gatNumber,
    String? village,
    String? district,
    String type = '712',
  }) async {
    searchCalls.add({'gatNumber': gatNumber, 'village': village, 'type': type});
    final error = searchError;
    if (error != null) throw error;
    return searchResults;
  }

  @override
  Future<String> getPdfUrl(String recordId) async =>
      'https://example.com/sample-712.pdf';

  @override
  Future<Map<String, dynamic>> importRecord(String recordId) async {
    importCalls.add(recordId);
    return {'imported': true, 'landAreaAcres': 2.97};
  }
}

const _rec1 = LandRecord712(
  id: 'rec-1',
  gatNumber: '123',
  village: 'Ozarkhed',
  district: 'Nashik',
  ownerName: 'राम सिंह',
  khataNumber: '45',
  totalAreaHectares: 1.2,
  totalAreaAcres: 2.97,
  landClass: 'जिरायत',
  ferfarNumber: 'F-102',
  cropHistory: 'गेहूं, कांदा (2025)',
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('land record card renders owner and area', (tester) async {
    final api = FakeLandRecordsApi()..searchResults = [_rec1];

    await pumpScreen(
      tester,
      Scaffold(
          body: LandLegalView(state: TestAppState(), landRecordsApi: api)),
    );

    await tester.enterText(find.byType(TextField), '123');
    await tester.tap(find.text('खोजें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.searchCalls.length, 1);
    expect(api.searchCalls.first['gatNumber'], '123');
    expect(find.textContaining('राम सिंह'), findsOneWidget);
    expect(find.textContaining('2.97 Acres'), findsOneWidget);
  });

  testWidgets('short village shows inline error', (tester) async {
    final api = FakeLandRecordsApi();

    await pumpScreen(
      tester,
      Scaffold(
          body: LandLegalView(state: TestAppState(), landRecordsApi: api)),
    );

    await tester.tap(find.text('गांव का नाम'));
    await tester.pump();

    await tester.enterText(find.byType(TextField), 'Oz');
    await tester.tap(find.text('खोजें'));
    await tester.pump();

    expect(find.text('कम से कम 3 अक्षर लिखें'), findsOneWidget);
    expect(api.searchCalls, isEmpty);
  });
}
