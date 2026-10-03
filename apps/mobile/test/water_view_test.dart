import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/water_api.dart';
import 'package:kisan_setu/views/water_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeWaterApi extends WaterApi {
  List<Map<String, dynamic>> schedule = const [];
  Map<String, dynamic>? groundwater;
  List<Map<String, dynamic>> canals = const [];
  Map<String, dynamic> pmksyResult = const {};

  final List<double> pmksyCalls = [];

  @override
  Future<List<Map<String, dynamic>>> getSchedule() async => schedule;

  @override
  Future<Map<String, dynamic>> getGroundwater(String district) async =>
      groundwater ?? {};

  @override
  Future<List<Map<String, dynamic>>> getCanalRotation({String? canal}) async =>
      canals;

  @override
  Future<Map<String, dynamic>> pmksyCalc(double acres) async {
    pmksyCalls.add(acres);
    return pmksyResult;
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('water renders schedule and groundwater gauge', (tester) async {
    final api = FakeWaterApi()
      ..schedule = const [
        {
          'plotName': 'प्लॉट A — टमाटर',
          'moisturePercent': 52,
          'recommendedMinutes': 90,
          'method': 'drip',
        },
      ]
      ..groundwater = const {
        'depthMeters': 18.5,
        'zone': 'semiCritical',
        'measuredAt': '2026-09-17',
      };

    await pumpScreen(tester,
        Scaffold(body: WaterView(state: TestAppState(), waterApi: api)));

    expect(find.text('प्लॉट A — टमाटर'), findsOneWidget);
    expect(find.text('18.5 m'), findsOneWidget);
    expect(find.text('अर्ध-गंभीर क्षेत्र (Semi-Critical)'), findsOneWidget);
  });

  testWidgets('pmksy shows subsidy split', (tester) async {
    final api = FakeWaterApi()
      ..pmksyResult = const {
        'totalCost': 170000,
        'subsidyPercent': 55,
        'subsidyAmount': 93500,
        'farmerShare': 76500,
      };

    await pumpScreen(tester,
        Scaffold(body: WaterView(state: TestAppState(), waterApi: api)));

    expect(find.textContaining('93,500'), findsOneWidget);
    expect(find.textContaining('76,500'), findsOneWidget);
  });
}
