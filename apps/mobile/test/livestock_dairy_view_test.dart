import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/livestock_api.dart';
import 'package:kisan_setu/models/livestock_models.dart';
import 'package:kisan_setu/views/livestock_dairy_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeLivestockApi extends LivestockApi {
  List<GaushalaItem> gaushalas = const [];
  List<PlantNursery> nurseries = const [];
  List<VetDoctor> vets = const [];
  List<DairyProductItem> dairy = const [];

  @override
  Future<List<GaushalaItem>> listGaushalas({String? district}) async =>
      gaushalas;

  @override
  Future<List<PlantNursery>> listNurseries() async => nurseries;

  @override
  Future<List<VetDoctor>> listVets({bool emergency = false}) async => vets;

  @override
  Future<List<DairyProductItem>> listDairyProducts({String? category}) async =>
      dairy;
}

VetDoctor _vet() => const VetDoctor(
      id: 'vet-1',
      name: 'Dr. Anand Kulkarni',
      qualification: 'M.V.Sc',
      specialization: 'Large Ruminants',
      clinicAddress: 'Panchvati, Nashik',
      distanceKm: 3.2,
      phone: '+919800000001',
      experienceYears: 12,
      consultationFeeRupees: 500,
      rating: 4.7,
      availableForFarmVisit: true,
      emergencyAvailable: true,
      nextAvailableSlot: '2026-09-18T10:00:00Z',
    );

DairyProductItem _dairy({bool inStock = true}) => DairyProductItem(
      id: 'dp-1',
      title: 'शुद्ध देशी A2 गायीचे तूप (500ml)',
      farmName: 'Panchvati Farm',
      category: 'A2 Ghee',
      price: 650,
      unit: '500ml',
      rating: 4.8,
      reviewsCount: 120,
      purityCertification: 'AGMARK शुद्धता प्रमाणपत्र',
      inStock: inStock,
      description: 'बिलोना पद्धतीने तयार शुद्ध तूप.',
    );

Future<void> pumpLivestockView(
    WidgetTester tester, FakeLivestockApi api) async {
  await pumpScreen(
    tester,
    Scaffold(
      body: LivestockDairyView(state: TestAppState(), livestockApi: api),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('livestock renders 4 tabs', (tester) async {
    await pumpLivestockView(tester, FakeLivestockApi());

    expect(find.textContaining('🛕 गौशाळा'), findsOneWidget);
    expect(find.textContaining('🪴 रोपवाटिका'), findsOneWidget);
    expect(find.textContaining('🩺 Dr. for गाय'), findsOneWidget);
    expect(find.textContaining('🥛 दुग्धजन्य पदार्थ'), findsOneWidget);
  });

  testWidgets('vet card renders with fee', (tester) async {
    final api = FakeLivestockApi()..vets = [_vet()];
    await pumpLivestockView(tester, api);

    await tester.tap(find.textContaining('🩺 Dr. for गाय'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));

    expect(find.textContaining('₹500'), findsWidgets);
  });

  testWidgets('out of stock dairy card greyed', (tester) async {
    final api = FakeLivestockApi()..dairy = [_dairy(inStock: false)];
    await pumpLivestockView(tester, api);

    await tester.ensureVisible(find.textContaining('🥛 दुग्धजन्य पदार्थ'));
    await tester.pump();
    await tester.tap(find.textContaining('🥛 दुग्धजन्य पदार्थ'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('स्टॉक में नहीं'), findsOneWidget);
    expect(find.text('थेट खरेदी करा'), findsNothing);
  });
}
