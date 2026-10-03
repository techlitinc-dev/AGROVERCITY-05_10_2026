import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/livestock_api.dart';
import 'package:kisan_setu/models/livestock_models.dart';
import 'package:kisan_setu/views/profile_home/dairy_manager_home_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class MockDairyLivestockApi extends LivestockApi {
  @override
  Future<MilkProcurementSummary> getProcurementSummary({String? date}) async {
    return const MilkProcurementSummary(
      date: '2026-09-25',
      totalMorningLiters: 152.5,
      totalEveningLiters: 133.0,
      totalLiters: 285.5,
      averageFat: 4.45,
      averageSnf: 8.85,
      totalPayoutRupees: 11420.0,
      farmerCount: 14,
      collectionCount: 22,
    );
  }

  @override
  Future<List<MilkCollection>> listMilkCollections({
    String? date,
    String? shift,
    String? cattleType,
  }) async {
    return const [
      MilkCollection(
        id: 'col-1',
        farmerId: 'farmer-101',
        farmerName: 'रामभाऊ पाटील',
        farmerPhone: '+91 98220 12345',
        date: '2026-09-25',
        shift: 'morning',
        cattleType: 'cow',
        quantityLiters: 12.5,
        fatPercentage: 4.2,
        snfPercentage: 8.7,
        ratePerLiter: 38.30,
        totalPayout: 478.75,
        slipNumber: 'SLIP-20260925-001',
        paymentStatus: 'paid',
        collectedBy: 'dairyManager',
      ),
    ];
  }

  @override
  Future<List<Animal>> listAnimals({
    String? species,
    String? lactationStage,
    String? search,
  }) async {
    return const [
      Animal(
        id: 'anim-1',
        ownerId: 'dairyManager',
        tagId: '100293847501',
        name: 'गंगा (Ganga)',
        species: 'cow',
        breed: 'Gir (गीर)',
        dateOfBirth: '2021-06-15',
        lactationStage: 'milking',
        lactationNumber: 2,
        dailyAvgYield: 14.5,
        healthStatus: 'healthy',
      ),
    ];
  }

  @override
  Future<List<BreedingCycle>> listBreedingCycles({
    String? pdStatus,
    String? tagId,
  }) async {
    return const [
      BreedingCycle(
        id: 'brd-1',
        animalId: 'anim-1',
        tagId: '100293847501',
        heatDate: '2026-07-10',
        aiDate: '2026-07-10',
        bullSemenStrawId: 'GIR-BULL-BAHUBALI-889',
        technicianName: 'डॉ. कदम',
        pdStatus: 'confirmed_pregnant',
        expectedCalvingDate: '2027-04-16',
      ),
    ];
  }

  @override
  Future<List<VetRecord>> listVetRecords({
    String? animalId,
    String? status,
  }) async {
    return const [
      VetRecord(
        id: 'vet-rec-1',
        animalId: 'anim-1',
        tagId: '100293847501',
        vetDoctorId: 'doc-1',
        vetDoctorName: 'डॉ. आनंद पाटील',
        examinationDate: '2026-09-24',
        symptoms: 'ताप १०३° फॅ.',
        clinicalDiagnosis: 'तीव्र कासदाह (Acute Mastitis)',
        treatmentsGiven: ['Intramammary Cefquinome'],
        prescriptions: [
          {
            'medicine': 'Cefquinome',
            'dose': '1 tube',
          }
        ],
        milkWithdrawalDays: 4,
        status: 'under_treatment',
      ),
    ];
  }

  @override
  Future<List<VaccinationSchedule>> listVaccinations({
    String? animalId,
    String? status,
  }) async {
    return const [
      VaccinationSchedule(
        id: 'vac-1',
        animalId: 'anim-1',
        tagId: '100293847501',
        vaccineName: 'FMD (लाळ खुरकूत)',
        diseaseTarget: 'Foot and Mouth Disease',
        scheduledDate: '2026-10-15',
        status: 'scheduled',
      ),
    ];
  }

  @override
  Future<List<CowAdoption>> listCowAdoptions({
    String? status,
    String? gaushalaId,
  }) async {
    return const [
      CowAdoption(
        id: 'adp-1',
        gaushalaId: 'gaushala-1',
        gaushalaName: 'श्री स्वामी समर्थ गोशाळा',
        cowTagId: '100293847501',
        cowName: 'गंगा (Desi Gir)',
        donorName: 'राजेश कुलकर्णी',
        donorPhone: '+91 99887 76655',
        adoptionTier: 'gau_gras',
        amountRupees: 1100,
        durationMonths: 1,
        startDate: '2026-09-01',
        endDate: '2026-10-01',
        taxExemption80GIssued: true,
        receiptNumber: '80G-20260901-0089',
        status: 'active',
      ),
    ];
  }

  @override
  Future<List<FodderDonation>> listFodderDonations({
    String? gaushalaId,
  }) async {
    return const [
      FodderDonation(
        id: 'don-1',
        gaushalaId: 'gaushala-1',
        gaushalaName: 'श्री स्वामी समर्थ गोशाळा',
        donorName: 'सुरेश देशमुख',
        donorPhone: '+91 98221 11222',
        fodderType: 'हिरवा चारा (Green Grass)',
        quantityKg: 500.0,
        monetaryEquivalentRupees: 2500,
        receiptNumber: 'FODDER-20260920-0012',
      ),
    ];
  }

  @override
  Future<List<PanchagavyaProduct>> listPanchagavyaProducts({
    String? category,
    String? gaushalaId,
  }) async {
    return const [
      PanchagavyaProduct(
        id: 'p-1',
        gaushalaId: 'gaushala-1',
        gaushalaName: 'श्री स्वामी समर्थ गोशाळा',
        title: 'शुद्ध बिलोना A2 गीर तूप',
        category: 'ghee',
        price: 1800,
        unit: '1 Liter',
        stockQuantity: 45,
        purityCertified: true,
        description: 'पारंपरिक लाकडी रवीने घुसळून तयार केलेले A2 तूप.',
      ),
    ];
  }
}

Future<void> pumpDairyManagerHomeView(
  WidgetTester tester, {
  LivestockApi? api,
}) async {
  await pumpScreen(
    tester,
    Scaffold(
      body: DairyManagerHomeView(
        state: TestAppState(),
        api: api ?? MockDairyLivestockApi(),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('DairyManagerHomeView renders banner and top live KPIs',
      (tester) async {
    await pumpDairyManagerHomeView(tester);

    expect(
      find.text('श्री स्वामी समर्थ दूध संकलन केंद्र व गोशाळा संघ'),
      findsOneWidget,
    );
    expect(find.text('आजचे संकलन'), findsOneWidget);
    expect(find.text('एकूण जनावरे'), findsOneWidget);
    expect(find.text('सक्रिय दत्तक'), findsOneWidget);
  });

  testWidgets('DairyManagerHomeView renders 4 tabs and displays milk procurement slips',
      (tester) async {
    await pumpDairyManagerHomeView(tester);

    // Verify Tab chips exist
    expect(find.textContaining('दूध संकलन'), findsWidgets);
    expect(find.textContaining('कळप व आधार'), findsOneWidget);
    expect(find.textContaining('गोशाळा व दत्तक'), findsOneWidget);
    expect(find.textContaining('क्लिनिक व प्रजनन'), findsOneWidget);

    // Tab 0 is active by default: verify milk slip data
    expect(find.text('रामभाऊ पाटील'), findsOneWidget);
    expect(find.textContaining('FAT: 4.2%'), findsOneWidget);
    expect(find.text('₹478.75'), findsOneWidget);
    expect(find.text('+ नवीन दूध संकलन पावती (Milk Slip)'), findsOneWidget);
  });

  testWidgets('DairyManagerHomeView switches to Herd tab and shows Pashu Aadhaar',
      (tester) async {
    await pumpDairyManagerHomeView(tester);

    await tester.tap(find.textContaining('कळप व आधार'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('गंगा (Ganga)'), findsOneWidget);
    expect(find.textContaining('100293847501'), findsOneWidget);
    expect(find.text('पशू आधार नोंद'), findsOneWidget);
  });

  testWidgets('DairyManagerHomeView switches to Gaushala tab and shows 80G adoptions',
      (tester) async {
    await pumpDairyManagerHomeView(tester);

    await tester.tap(find.textContaining('गोशाळा व दत्तक'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('राजेश कुलकर्णी'), findsOneWidget);
    expect(find.textContaining('80G कर सवलत लागू'), findsOneWidget);
    expect(find.text('+ गो-दत्तक प्रायोजकत्व'), findsOneWidget);
    expect(find.text('शुद्ध बिलोना A2 गीर तूप'), findsOneWidget);
  });

  testWidgets('DairyManagerHomeView switches to Vet tab and displays withdrawal alert',
      (tester) async {
    await pumpDairyManagerHomeView(tester);

    await tester.tap(find.textContaining('क्लिनिक व प्रजनन'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('तीव्र कासदाह (Acute Mastitis)'), findsOneWidget);
    expect(
      find.textContaining('दूध विथड्रॉवल अलर्ट: पुढील 4 दिवस दूध संकलनास मनाई!'),
      findsOneWidget,
    );
    expect(find.textContaining('GIR-BULL-BAHUBALI-889'), findsOneWidget);
    expect(find.text('+ AI प्रजनन नोंद'), findsOneWidget);
    expect(find.text('+ क्लिनिकल केस'), findsOneWidget);
  });
}
