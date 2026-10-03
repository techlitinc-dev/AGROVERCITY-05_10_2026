// Advisory module tests — every tab renders real (fake-API) backend data.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/advisory_api.dart';
import 'package:kisan_setu/models/advisory_models.dart';
import 'package:kisan_setu/views/advisory_view.dart';

import 'helpers.dart';

class FakeAdvisoryApi extends AdvisoryApi {
  SaturationAdvisory saturation = const SaturationAdvisory(
    sowingCount: 12,
    radiusKm: 10,
    expectedArrivalIncrease: '96%',
    riskLevel: 'red',
    predictedPrice: 880,
    predictedDate: '2026-12-26',
    alternativeCrops: [
      AlternativeCrop(crop: 'Soybean', expectedPrice: 5040),
    ],
  );
  List<PestRadarItem> radar = const [
    PestRadarItem(
      disease: 'Pink bollworm',
      crop: 'Cotton',
      distanceKm: 3.2,
      riskLevel: 'yellow',
      reportedAt: '2026-09-27',
    ),
  ];
  List<DiseaseScanResult> scanResults = const [
    DiseaseScanResult(
      diseaseName: 'Early blight',
      crop: 'Tomato',
      pathogen: 'Alternaria solani',
      confidence: 0.87,
      symptoms: 'Brown spots on lower leaves',
      chemicalTreatment: 'Mancozeb 75% WP',
      organicTreatment: 'Neem oil',
      dosage: '2.5g per litre',
      estimatedCost: 450,
    ),
  ];
  NpkRecommendation npk = const NpkRecommendation(
    recommendations: ['यूरिया 10.0 किग्रा प्रति एकड़ दें'],
    ureaKgPerAcre: 10.0,
    dapKgPerAcre: 13.0,
    mopKgPerAcre: 13.3,
  );

  String? lastSaturationCrop;
  Object? saturationError;

  @override
  Future<SaturationAdvisory> checkSaturation({
    required String crop,
    required String district,
    required double lat,
    required double lng,
    int radiusKm = 10,
    bool shareSowingIntent = true,
  }) async {
    lastSaturationCrop = crop;
    final error = saturationError;
    if (error != null) throw error;
    return saturation;
  }

  @override
  Future<List<PestRadarItem>> getPestRadar({
    required double lat,
    required double lng,
    int radiusKm = 5,
  }) async =>
      radar;

  @override
  Future<List<DiseaseScanResult>> scanDisease({
    required List<int> imageBytes,
    required String filename,
    String? contentType,
  }) async =>
      scanResults;

  @override
  Future<NpkRecommendation> getNpkRecommendation({
    required double n,
    required double p,
    required double k,
    required String crop,
    required String soilType,
  }) async =>
      npk;
}

Future<void> pumpAdvisory(
  WidgetTester tester,
  FakeAdvisoryApi api, {
  Future<({String filename, List<int> bytes, String? contentType})?> Function()?
      pickImage,
}) async {
  final state = TestAppState();
  state.profile.activeCrops.add('Tomato (टमाटर)');
  state.profile.district = 'Nashik';
  await pumpScreen(
    tester,
    Scaffold(
      body: AdvisoryView(
        state: state,
        advisoryApi: api,
        pickLeafImage: pickImage,
      ),
    ),
  );
  // StaggeredSlideFade entrance animations must settle before taps hit.
  await tester.pump(const Duration(seconds: 2));
}

Future<void> tapTab(WidgetTester tester, String label) async {
  await tester.ensureVisible(find.text(label));
  await tester.pump();
  await tester.tap(find.text(label));
  await tester.pump();
  await tester.pump(const Duration(seconds: 2));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('market saturation tab renders API advisory', (tester) async {
    final api = FakeAdvisoryApi();
    await pumpAdvisory(tester, api);

    expect(api.lastSaturationCrop, isNull);
    await tester.ensureVisible(find.text('संतृप्ति जांचें'));
    await tester.pump();
    await tester.tap(find.text('संतृप्ति जांचें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.lastSaturationCrop, 'Tomato');
    expect(find.textContaining('Tomato'), findsWidgets);
    expect(find.textContaining('96%'), findsOneWidget);
    expect(find.textContaining('₹880'), findsOneWidget);
    expect(find.textContaining('Soybean — ₹5040'), findsOneWidget);
  });

  testWidgets('pest radar tab renders API alerts', (tester) async {
    final api = FakeAdvisoryApi();
    await pumpAdvisory(tester, api);

    await tapTab(tester, '📡 5km Pest Radar');

    expect(find.text('Pink bollworm • Cotton'), findsOneWidget);
    expect(find.textContaining('3.2'), findsOneWidget);
  });

  testWidgets('disease scan tab renders API diagnosis', (tester) async {
    final api = FakeAdvisoryApi();
    await pumpAdvisory(
      tester,
      api,
      pickImage: () async =>
          (filename: 'leaf.jpg', bytes: const [1, 2, 3], contentType: 'image/jpeg'),
    );

    await tapTab(tester, '📸 Leaf Disease Scan');
    await tester.ensureVisible(find.text('पत्ते की फोटो अपलोड करें'));
    await tester.pump();
    await tester.tap(find.text('पत्ते की फोटो अपलोड करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Early blight'), findsOneWidget);
    expect(find.text('87% विश्वसनीयता'), findsOneWidget);
    expect(find.textContaining('Mancozeb'), findsOneWidget);
  });

  testWidgets('npk tab renders computed recommendation', (tester) async {
    final api = FakeAdvisoryApi();
    await pumpAdvisory(tester, api);

    await tapTab(tester, '🧪 NPK Soil Calculator');
    await tester.enterText(find.byType(TextField).at(0), 'Tomato');
    await tester.enterText(find.byType(TextField).at(1), 'Black soil');
    await tester.ensureVisible(find.text('उर्वरक सिफारिश प्राप्त करें'));
    await tester.pump();
    await tester.tap(find.text('उर्वरक सिफारिश प्राप्त करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.textContaining('यूरिया 10.0 किग्रा प्रति एकड़ दें'), findsOneWidget);
    expect(find.text('10.0'), findsOneWidget);
  });
}
