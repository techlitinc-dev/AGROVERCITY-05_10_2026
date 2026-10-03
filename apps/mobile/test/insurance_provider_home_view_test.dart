import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/insurance_api.dart';
import 'package:kisan_setu/models/insurance_models.dart';
import 'package:kisan_setu/views/profile_home/insurance_provider_home_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class MockInsuranceProviderApi extends InsuranceApi {
  List<CropInsurancePolicy> policies = [
    const CropInsurancePolicy(
      id: 'pol-101',
      policyNumber: 'PMFBY-2026-0042',
      schemeName: 'PMFBY',
      cropName: 'Wheat',
      season: 'Kharif',
      year: 2026,
      landAreaAcres: 3.5,
      sumInsured: 140000,
      farmerPremium: 2800,
      govtSubsidy: 14700,
      status: 'pending_approval',
      insuranceCompany: 'AIC of India',
      coverageStartDate: '2026-07-01',
      coverageEndDate: '2026-12-31',
      bankName: 'SBI',
      kccAccountNo: 'XXXX1234',
      farmerName: 'सुभाष गायकवाड',
      village: 'दिंडोरी',
      district: 'नाशिक',
      riskScore: 35,
      riskCategory: 'Low',
    ),
  ];

  List<InsuranceClaimRecord> claims = [
    const InsuranceClaimRecord(
      id: 'clm-201',
      claimNumber: 'CLM-2026-MH-0101',
      policyId: 'pol-101',
      cropName: 'Wheat',
      calamityType: 'hailstorm',
      dateOfDamage: '2026-09-14',
      cropStage: 'flowering',
      estimatedLossPercent: 40,
      requestedAmount: 56000,
      status: 'intimated',
      statusText: 'दावा दर्ज — सर्वेयर नियुक्ति लंबित',
      gpsCoordinates: '20.0,73.8',
      village: 'दिंडोरी',
      damagePhotos: [],
      submittedAt: '2026-09-15T00:00:00Z',
      timeline: [],
    ),
  ];

  List<InsuranceScheme> schemes = const [
    InsuranceScheme(
      id: 'pmfby',
      code: 'PMFBY',
      titleEn: 'Pradhan Mantri Fasal Bima Yojana',
      titleHi: 'प्रधानमंत्री फसल बीमा योजना',
      descriptionEn: 'Comprehensive natural risk shield',
      descriptionHi: 'प्राकृतिक आपदाओं से फसल सुरक्षा',
      category: 'crop',
      premiumShareRules: '2% Kharif, 1.5% Rabi',
      applicableCrops: ['Wheat', 'Onion'],
      cutoffNotice: 'Cutoff: 31 July',
    ),
  ];

  List<CropPremiumRate> rates = const [
    CropPremiumRate(
      id: 'wheat-kharif',
      cropName: 'Wheat',
      category: 'kharif-crops',
      season: 'Kharif',
      sumInsuredPerAcre: 40000,
      farmerSharePercent: 2.0,
      totalActuarialRatePercent: 12.5,
      cutoffDate: '2026-07-31',
    ),
  ];

  @override
  Future<InsuranceProviderStats> getProviderStats() async {
    return const InsuranceProviderStats(
      totalPolicies: 12,
      pendingPolicies: 3,
      activePolicies: 8,
      rejectedPolicies: 1,
      totalSumInsured: 1540000,
      totalFarmerPremium: 30800,
      totalGovtSubsidy: 161700,
      totalClaims: 4,
      pendingClaims: 2,
      approvedClaims: 1,
      disbursedClaims: 1,
      totalClaimRequested: 142000,
      totalClaimApproved: 98000,
      totalClaimDisbursed: 64000,
      lossRatioPercent: 20.8,
      byPolicyStatus: {'pending_approval': 3, 'active': 8, 'rejected': 1},
      byClaimStatus: {'intimated': 1, 'surveyorAssigned': 1, 'dbtApproved': 1, 'disbursed': 1},
      byCrop: {'Wheat': 8, 'Onion': 4},
      byCalamity: {'hailstorm': 2, 'flood': 1, 'drought': 1},
    );
  }

  @override
  Future<Map<String, dynamic>> listProviderPolicies({
    String? status,
    String? crop,
    String? category,
    String? q,
    int page = 1,
    int pageSize = 20,
  }) async {
    return {
      'data': policies,
      'page': page,
      'pageSize': pageSize,
      'total': policies.length,
    };
  }

  @override
  Future<Map<String, dynamic>> listProviderClaims({
    String? status,
    String? calamityType,
    String? q,
    int page = 1,
    int pageSize = 20,
  }) async {
    return {
      'data': claims,
      'page': page,
      'pageSize': pageSize,
      'total': claims.length,
    };
  }

  @override
  Future<List<InsuranceScheme>> listSchemes() async => schemes;

  @override
  Future<List<CropPremiumRate>> getRates({String? season, String? crop}) async => rates;

  @override
  Future<CropInsurancePolicy> reviewPolicy(
    String id, {
    required String action,
    String? rejectionReason,
    String? underwriterNotes,
    String? insuranceCompany,
  }) async {
    final idx = policies.indexWhere((p) => p.id == id);
    if (idx != -1) {
      final old = policies[idx];
      final updated = CropInsurancePolicy(
        id: old.id,
        policyNumber: old.policyNumber,
        schemeName: old.schemeName,
        cropName: old.cropName,
        season: old.season,
        year: old.year,
        landAreaAcres: old.landAreaAcres,
        sumInsured: old.sumInsured,
        farmerPremium: old.farmerPremium,
        govtSubsidy: old.govtSubsidy,
        status: action == 'approve' ? 'active' : 'rejected',
        insuranceCompany: insuranceCompany ?? old.insuranceCompany,
        coverageStartDate: old.coverageStartDate,
        coverageEndDate: old.coverageEndDate,
        bankName: old.bankName,
        kccAccountNo: old.kccAccountNo,
        certificateUrl: 'https://storage.example/cert.pdf',
        farmerName: old.farmerName,
        village: old.village,
        district: old.district,
        rejectionReason: rejectionReason,
        underwriterNotes: underwriterNotes,
      );
      policies[idx] = updated;
      return updated;
    }
    return policies.first;
  }
}

Future<void> pumpInsuranceProviderHome(
  WidgetTester tester, {
  InsuranceApi? api,
}) async {
  await pumpScreen(
    tester,
    Scaffold(
      body: InsuranceProviderHomeView(
        state: TestAppState(),
        insuranceApi: api ?? MockInsuranceProviderApi(),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('InsuranceProviderHomeView renders header identity and KPI cards',
      (tester) async {
    await pumpInsuranceProviderHome(tester);

    expect(find.textContaining('बीमा प्रदाता'), findsWidgets);
    expect(find.textContaining('AIC of India'), findsOneWidget);
    expect(find.text('लंबित समीक्षा'), findsOneWidget);
    expect(find.text('सक्रिय कवर'), findsOneWidget);
    expect(find.text('दावे लंबित'), findsOneWidget);
    expect(find.text('दावा अनुपात'), findsOneWidget);
  });

  testWidgets('InsuranceProviderHomeView displays pending policy application with review buttons',
      (tester) async {
    await pumpInsuranceProviderHome(tester);

    expect(find.text('PMFBY-2026-0042'), findsOneWidget);
    expect(find.textContaining('सुभाष गायकवाड'), findsOneWidget);
    expect(find.textContaining('जोखिम: Low'), findsOneWidget);
    expect(find.text('स्वीकृत करें'), findsOneWidget);
    expect(find.text('अस्वीकृत करें'), findsOneWidget);
  });

  testWidgets('InsuranceProviderHomeView approves policy and updates status',
      (tester) async {
    await pumpInsuranceProviderHome(tester);

    await tester.tap(find.text('स्वीकृत करें'));
    await tester.pumpAndSettle();

    expect(find.textContaining('पॉलिसी स्वीकृति'), findsOneWidget);
    expect(find.text('अंडरराइटर टिप्पणी (Notes)'), findsOneWidget);

    // Tap confirm in dialog
    await tester.tap(find.descendant(
      of: find.byType(AlertDialog),
      matching: find.widgetWithText(ElevatedButton, 'स्वीकृत करें'),
    ));
    await tester.pumpAndSettle();

    // Verify dialog closed
    expect(find.text('पॉलिसी स्वीकृति (Approve)'), findsNothing);
  });

  testWidgets('InsuranceProviderHomeView switches to Claims tab',
      (tester) async {
    await pumpInsuranceProviderHome(tester);

    await tester.tap(find.text('दावा निपटान'));
    await tester.pumpAndSettle();

    expect(find.text('CLM-2026-MH-0101'), findsOneWidget);
    expect(find.textContaining('आपदा: hailstorm'), findsOneWidget);
    expect(find.textContaining('सर्वेयर नियुक्त करें'), findsOneWidget);
  });

  testWidgets('InsuranceProviderHomeView switches to Schemes and Rates tab',
      (tester) async {
    await pumpInsuranceProviderHome(tester);

    await tester.tap(find.text('योजनाएं व दरें'));
    await tester.pumpAndSettle();

    expect(find.text('PMFBY'), findsOneWidget);
    expect(find.text('प्रधानमंत्री फसल बीमा योजना'), findsOneWidget);
    expect(find.textContaining('Wheat (Kharif)'), findsOneWidget);
  });

  testWidgets('InsuranceProviderHomeView switches to Analytics tab',
      (tester) async {
    await pumpInsuranceProviderHome(tester);

    await tester.tap(find.text('विश्लेषण'));
    await tester.pumpAndSettle();

    expect(find.textContaining('पोर्टफोलियो जोखिम विश्लेषण'), findsOneWidget);
    expect(find.textContaining('कुल बीमित दायित्व'), findsOneWidget);
  });
}
