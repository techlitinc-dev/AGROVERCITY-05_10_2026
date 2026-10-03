// Day 14 Task B1/B5 widget tests — women/climate/post-harvest views with
// fake-API injection, plus the cold-storage booking dialog flow.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/api/climate_api.dart';
import 'package:kisan_setu/api/post_harvest_api.dart';
import 'package:kisan_setu/api/women_api.dart';
import 'package:kisan_setu/models/climate_models.dart';
import 'package:kisan_setu/models/post_harvest_models.dart';
import 'package:kisan_setu/models/women_models.dart';
import 'package:kisan_setu/views/climate_carbon_view.dart';
import 'package:kisan_setu/views/post_harvest_view.dart';
import 'package:kisan_setu/views/women_farmer_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeWomenApi extends WomenApi {
  ShgProfile shg = const ShgProfile(
    memberCount: 12,
    corpus: 48500,
    loanFund: 30000,
    monthlyDeposit: 500,
  );
  HomeEnterpriseSummary enterprise = const HomeEnterpriseSummary(
    lines: [
      EnterpriseLine(product: 'अचार', monthlyProfit: 3200),
      EnterpriseLine(product: 'पापड़', monthlyProfit: 2100),
      EnterpriseLine(product: 'A2 घी', monthlyProfit: 4500),
    ],
    totalMonthlyProfit: 9800,
  );
  Object? depositError;
  final List<Map<String, dynamic>> depositCalls = [];

  @override
  Future<ShgProfile> getShg() async => shg;

  @override
  Future<HomeEnterpriseSummary> getHomeEnterprise() async => enterprise;

  @override
  Future<Map<String, dynamic>> deposit({
    required double amount,
    required String month,
  }) async {
    depositCalls.add({'amount': amount, 'month': month});
    final error = depositError;
    if (error != null) throw error;
    return {'deposited': amount, 'newCorpus': shg.corpus + amount};
  }
}

class FakeClimateApi extends ClimateApi {
  CarbonPotential potential = const CarbonPotential(
    co2eTonnes: 4.6,
    annualIncomePotential: 9200,
    practices: ['biochar', 'zero-till', 'green-manure'],
  );
  List<ResilientVariety> varieties = const [
    ResilientVariety(
      variety: 'Swarna Sub-1',
      crop: 'rice',
      trait: 'flood-tolerant',
      source: 'IRRI',
    ),
  ];
  String? lastCrop;

  @override
  Future<CarbonPotential> carbonPotential({double? lat, double? lng}) async =>
      potential;

  @override
  Future<List<ResilientVariety>> resilientVarieties({String? crop}) async {
    lastCrop = crop;
    return varieties;
  }
}

class FakePostHarvestApi extends PostHarvestApi {
  List<ColdStorageFacility> facilities = const [];
  GradeResult gradeResult = const GradeResult(
    grade: 'AGMARK A',
    uniformityPercent: 88,
    shelfLifeDays: 12,
    recommendedPrice: 1650,
  );
  final List<Map<String, dynamic>> bookCalls = [];

  @override
  Future<List<ColdStorageFacility>> listColdStorage({
    double? lat,
    double? lng,
  }) async =>
      facilities;

  @override
  Future<GradeResult> grade(List<XFile> images) async => gradeResult;

  @override
  Future<Map<String, dynamic>> bookColdStorage(
    String facilityId, {
    required double quantityQuintals,
    required String fromDate,
    required int months,
  }) async {
    bookCalls.add({
      'facilityId': facilityId,
      'quantityQuintals': quantityQuintals,
      'fromDate': fromDate,
      'months': months,
    });
    return {'id': 'csb_1', 'status': 'booked'};
  }
}

ColdStorageFacility facility(String id, String name) => ColdStorageFacility(
      id: id,
      name: name,
      distanceKm: 7.2,
      tempRange: '2°C to 4°C',
      availableMT: 1200,
      ratePerQuintalMonth: 95,
    );

Future<void> pumpWomenView(WidgetTester tester, FakeWomenApi api) async {
  await pumpScreen(
    tester,
    Scaffold(body: WomenFarmerView(state: TestAppState(), womenApi: api)),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

Future<void> pumpClimateView(WidgetTester tester, FakeClimateApi api) async {
  await pumpScreen(
    tester,
    Scaffold(body: ClimateCarbonView(state: TestAppState(), climateApi: api)),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

Future<void> pumpPostHarvestView(
  WidgetTester tester,
  FakePostHarvestApi api, {
  Future<List<XFile>> Function()? pickImages,
}) async {
  await pumpScreen(
    tester,
    Scaffold(
      body: PostHarvestView(
        state: TestAppState(),
        postHarvestApi: api,
        pickImages: pickImages,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('women SHG tab renders corpus', (tester) async {
    await pumpWomenView(tester, FakeWomenApi());
    expect(find.text('₹48,500'), findsOneWidget);
    expect(find.text('12 सदस्य'), findsOneWidget);
  });

  testWidgets('women deposit duplicate shows snackbar', (tester) async {
    final api = FakeWomenApi()
      ..depositError = const ApiException(code: 'DUPLICATE_DEPOSIT_MONTH');
    await pumpWomenView(tester, api);

    await tester.tap(find.text('मासिक जमा करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('इस महीने की जमा हो चुकी है'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('climate hero renders', (tester) async {
    await pumpClimateView(tester, FakeClimateApi());
    expect(find.textContaining('₹9,200'), findsOneWidget);
    expect(find.textContaining('4.6 MT CO2e'), findsOneWidget);
    expect(find.text('बायोचार'), findsOneWidget);
  });

  testWidgets('cold storage cards render', (tester) async {
    final api = FakePostHarvestApi()
      ..facilities = [
        facility('cs-1', 'Sahyadri Mega Agro Cold Chain Ltd.'),
        facility('cs-2', 'Niphad Onion & Agri Warehouse'),
        facility('cs-3', 'Lasalgaon Fresh Storage'),
        facility('cs-4', 'Ozarkhed Agro Coolers'),
      ];
    await pumpPostHarvestView(tester, api);

    expect(find.text('Sahyadri Mega Agro Cold Chain Ltd.'), findsOneWidget);
    expect(find.text('Niphad Onion & Agri Warehouse'), findsOneWidget);
    expect(find.text('Lasalgaon Fresh Storage'), findsOneWidget);
    expect(find.text('Ozarkhed Agro Coolers'), findsOneWidget);
    expect(find.text('बुक करें'), findsNWidgets(4));
  });

  testWidgets('post-harvest grade result renders', (tester) async {
    await pumpPostHarvestView(
      tester,
      FakePostHarvestApi(),
      pickImages: () async => [XFile('a.png')],
    );

    await tester.tap(find.text('फोटो से ग्रेड करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.textContaining('AGMARK A'), findsOneWidget);
    expect(find.textContaining('88%'), findsOneWidget);
  });

  testWidgets('book dialog posts', (tester) async {
    final api = FakePostHarvestApi()
      ..facilities = [facility('cs-1', 'Sahyadri Mega Agro Cold Chain Ltd.')];
    await pumpPostHarvestView(tester, api);

    await tester.tap(find.text('बुक करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.enterText(find.byType(TextField), '20');
    await tester.pump();
    await tester.tap(find.text('बुक करें').last);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.bookCalls, hasLength(1));
    expect(api.bookCalls.first['facilityId'], 'cs-1');
    expect(api.bookCalls.first['quantityQuintals'], 20.0);
    expect(api.bookCalls.first['months'], 1);
    expect(find.text('स्टोरेज बुक हुआ'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
  });
}
