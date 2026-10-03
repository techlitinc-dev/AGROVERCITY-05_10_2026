import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:kisan_setu/api/insurance_api.dart';
import 'package:kisan_setu/models/insurance_models.dart';
import 'package:kisan_setu/views/crop_insurance_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeInsuranceApi extends InsuranceApi {
  List<CropInsurancePolicy> policies = const [];
  List<InsuranceClaimRecord> claims = const [];
  List<CropPremiumRate> rates = const [];
  Map<String, dynamic> submitResponse = const {'claimNumber': 'CLM-2026-MH-0001'};

  Map<String, String>? lastSubmitFields;
  int lastSubmitPhotoCount = 0;
  String? lastRatesSeason;
  final List<List<Object?>> appealCalls = [];
  Object? appealError;

  @override
  Future<List<CropInsurancePolicy>> listPolicies() async => policies;

  @override
  Future<CropInsurancePolicy> applyPolicy({
    required String cropName,
    required String season,
    required double landAreaAcres,
  }) async =>
      policies.first;

  @override
  Future<String?> getCertificate(String policyId) async =>
      'https://fake.example/cert.pdf';

  @override
  Future<List<CropPremiumRate>> getRates({String? season, String? crop}) async {
    lastRatesSeason = season;
    return rates;
  }

  @override
  Future<Map<String, dynamic>> submitClaim(
    Map<String, String> fields,
    List<XFile> photos,
  ) async {
    lastSubmitFields = fields;
    lastSubmitPhotoCount = photos.length;
    return submitResponse;
  }

  @override
  Future<List<InsuranceClaimRecord>> listClaims() async => claims;

  @override
  Future<InsuranceClaimRecord> getClaim(String id) async =>
      claims.firstWhere((c) => c.id == id, orElse: () => claims.first);

  @override
  Future<InsuranceClaimRecord> appealClaim(
    String id,
    String reason,
    List<String> photos,
  ) async {
    appealCalls.add([id, reason, photos]);
    final error = appealError;
    if (error != null) throw error;
    final updated = claims
        .map((c) => c.id == id ? copyClaim(c, status: 'intimated', appealCount: c.appealCount + 1) : c)
        .toList();
    claims = updated;
    return updated.firstWhere((c) => c.id == id);
  }
}

CropInsurancePolicy policyFixture() => const CropInsurancePolicy(
      id: 'pol-1',
      policyNumber: 'PMFBY-2026-0001',
      schemeName: 'PMFBY',
      cropName: 'Wheat',
      season: 'Kharif',
      year: 2026,
      landAreaAcres: 2.0,
      sumInsured: 80000,
      farmerPremium: 1600,
      govtSubsidy: 8400,
      status: 'active',
      insuranceCompany: 'AIC of India',
      coverageStartDate: '2026-07-01',
      coverageEndDate: '2026-12-31',
      bankName: 'SBI',
      kccAccountNo: 'XXXX4521',
    );

CropPremiumRate rateFixture() => const CropPremiumRate(
      id: 'rate-1',
      cropName: 'Wheat',
      category: 'kharif-crops',
      season: 'Kharif',
      sumInsuredPerAcre: 40000,
      farmerSharePercent: 2.0,
      totalActuarialRatePercent: 12.5,
      cutoffDate: '2026-07-31',
    );

InsuranceClaimRecord claimFixture({
  String status = 'surveyorAssigned',
  String? rejectionReason,
  int appealCount = 0,
}) =>
    InsuranceClaimRecord(
      id: 'clm-1',
      claimNumber: 'CLM-2026-MH-0001',
      policyId: 'pol-1',
      cropName: 'Wheat',
      calamityType: 'ओलावृष्टि (Hailstorm)',
      dateOfDamage: '2026-09-10',
      cropStage: 'खड़ी फसल (Standing Crop)',
      estimatedLossPercent: 40,
      requestedAmount: 32000,
      status: status,
      statusText: 'सर्वेयर नियुक्त',
      surveyorName: 'संदीप कुलकर्णी',
      surveyorPhone: '+919811000001',
      surveyorVisitDate: '2026-09-20',
      gpsCoordinates: '20.0,73.8',
      village: 'Ozarkhed',
      damagePhotos: const ['https://fake.example/p1.jpg'],
      submittedAt: '2026-09-12T10:00:00Z',
      timeline: const [],
      appealCount: appealCount,
      rejectionReason: rejectionReason,
    );

InsuranceClaimRecord copyClaim(
  InsuranceClaimRecord c, {
  String? status,
  int? appealCount,
}) =>
    InsuranceClaimRecord(
      id: c.id,
      claimNumber: c.claimNumber,
      policyId: c.policyId,
      cropName: c.cropName,
      calamityType: c.calamityType,
      dateOfDamage: c.dateOfDamage,
      cropStage: c.cropStage,
      estimatedLossPercent: c.estimatedLossPercent,
      requestedAmount: c.requestedAmount,
      approvedAmount: c.approvedAmount,
      status: status ?? c.status,
      statusText: 'दावा दर्ज — सर्वेयर नियुक्ति लंबित',
      surveyorName: c.surveyorName,
      surveyorPhone: c.surveyorPhone,
      surveyorVisitDate: c.surveyorVisitDate,
      gpsCoordinates: c.gpsCoordinates,
      village: c.village,
      damagePhotos: c.damagePhotos,
      submittedAt: c.submittedAt,
      dbtTransactionId: c.dbtTransactionId,
      bankAccountLast4: c.bankAccountLast4,
      timeline: c.timeline,
      appealCount: appealCount ?? c.appealCount,
      rejectionReason: c.rejectionReason,
    );

Future<void> pumpInsuranceView(
  WidgetTester tester,
  FakeInsuranceApi api, {
  int initialTab = 0,
  Future<XFile?> Function()? photoPicker,
}) async {
  await pumpScreen(
    tester,
    Scaffold(
      body: CropInsuranceView(
        state: TestAppState(),
        insuranceApi: api,
        initialTab: initialTab,
        photoPicker: photoPicker,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('insurance view renders 4 tabs', (tester) async {
    await pumpInsuranceView(tester, FakeInsuranceApi());
    expect(find.text('मेरी पॉलिसी'), findsOneWidget);
    expect(find.text('दावा सूचना'), findsOneWidget);
    expect(find.text('कैलकुलेटर'), findsOneWidget);
    expect(find.text('दावा स्थिति'), findsOneWidget);
  });

  testWidgets('policy card renders', (tester) async {
    final api = FakeInsuranceApi()..policies = [policyFixture()];
    await pumpInsuranceView(tester, api);
    expect(find.text('PMFBY-2026-0001'), findsOneWidget);
  });

  testWidgets('claim tracker renders surveyor box', (tester) async {
    final api = FakeInsuranceApi()
      ..policies = [policyFixture()]
      ..claims = [claimFixture(status: 'surveyorAssigned')];
    await pumpInsuranceView(tester, api, initialTab: 3);
    expect(find.text('संदीप कुलकर्णी'), findsOneWidget);
    expect(find.text('सर्वेक्षक'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
  });

  testWidgets('premium calculator computes from rates', (tester) async {
    final api = FakeInsuranceApi()..rates = [rateFixture()];
    await pumpInsuranceView(tester, api, initialTab: 2);
    expect(find.text('₹80,000'), findsOneWidget);
    expect(find.text('₹1,600'), findsOneWidget);
  });

  testWidgets('claim success shows claim number dialog', (tester) async {
    final api = FakeInsuranceApi()
      ..policies = [policyFixture()]
      ..submitResponse = const {
        'claimNumber': 'CLM-2026-MH-0001',
        'photoGuidelines': ['पूरे खेत की एक चौड़ी फोटो लें'],
      };
    await pumpInsuranceView(
      tester,
      api,
      initialTab: 1,
      photoPicker: () async => XFile('fake/claim-photo.jpg'),
    );

    await tester.ensureVisible(find.text('सूखा (Drought)'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    await tester.tap(find.text('सूखा (Drought)'));
    await tester.pump();

    await tester.ensureVisible(find.text('फोटो जोड़ें (कैमरा)'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    await tester.tap(find.text('फोटो जोड़ें (कैमरा)'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.ensureVisible(
      find.text('दावा सूचना दर्ज करें (Submit Claim Intimation)'),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    await tester.tap(
      find.text('दावा सूचना दर्ज करें (Submit Claim Intimation)'),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('दावा क्रमांक: CLM-2026-MH-0001'), findsOneWidget);
    expect(find.textContaining('पूरे खेत की एक चौड़ी फोटो लें'), findsOneWidget);

    await tester.tap(find.text('ठीक है'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));

    expect(
      find.text('दावा स्थिति व लाइव क्षति सत्यापन ट्रैकर'),
      findsOneWidget,
    );
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
  });

  testWidgets('rejected claim shows reason and appeal button', (tester) async {
    final api = FakeInsuranceApi()
      ..policies = [policyFixture()]
      ..claims = [
        claimFixture(status: 'rejected', rejectionReason: 'अपर्याप्त फोटो साक्ष्य'),
      ];
    await pumpInsuranceView(tester, api, initialTab: 3);
    expect(
      find.text('अस्वीकृति का कारण: अपर्याप्त फोटो साक्ष्य'),
      findsOneWidget,
    );
    expect(find.text('अपील करें / पुनः जमा करें'), findsOneWidget);
  });

  testWidgets('appeal submit returns claim to intimated', (tester) async {
    final api = FakeInsuranceApi()
      ..policies = [policyFixture()]
      ..claims = [
        claimFixture(status: 'rejected', rejectionReason: 'अपर्याप्त फोटो साक्ष्य'),
      ];
    await pumpInsuranceView(tester, api, initialTab: 3);

    await tester.ensureVisible(find.text('अपील करें / पुनः जमा करें'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    await tester.tap(find.text('अपील करें / पुनः जमा करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.enterText(
      find.byType(TextField),
      'सर्वेयर ने गलत फसल स्टेज दर्ज की थी, नई फोटो संलग्न हैं',
    );
    await tester.pump();

    await tester.tap(find.text('अपील जमा करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.textContaining('अपील दर्ज हुई'), findsOneWidget);

    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('अपील करें / पुनः जमा करें'), findsNothing);
    expect(find.text('CLM-2026-MH-0001'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await tester.pump();
  });
}
