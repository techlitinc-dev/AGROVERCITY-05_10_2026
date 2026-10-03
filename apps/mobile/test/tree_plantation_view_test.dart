import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/tree_api.dart';
import 'package:kisan_setu/models/tree_models.dart';
import 'package:kisan_setu/views/tree_plantation_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeTreeApi extends TreeApi {
  List<TreeArticle> articles = const [];
  List<NgoOrganization> ngos = const [];
  List<BiofuelTree> biofuel = const [];
  List<TreeCareGuide> careGuides = const [];
  List<TreePlantation> plantations = const [];
  List<AgroforestryScheme> schemes = const [];
  List<SpeciesRecommendation> recommendations = const [];

  @override
  Future<List<TreeArticle>> listArticles({String? category}) async => articles;

  @override
  Future<List<NgoOrganization>> listNgos() async => ngos;

  @override
  Future<List<BiofuelTree>> listBiofuel() async => biofuel;

  @override
  Future<List<TreeCareGuide>> listCareGuides() async => careGuides;

  @override
  Future<List<TreePlantation>> listMyPlantations() async => plantations;

  @override
  Future<CarbonEstimate> estimateCarbon({
    required String treeSpecies,
    required int treeCount,
    int ageYears = 1,
    String landType = 'bund',
  }) async =>
      CarbonEstimate(
        treeSpecies: treeSpecies,
        treeCount: treeCount,
        ageYears: ageYears,
        co2PerTreePerYearKg: 22.0,
        annualCo2Kg: 2200.0,
        tenYearCo2Kg: 22000.0,
        carbonCredits10Yr: 22.0,
        estimatedEarningsInr: 26400.0,
        formulaExplanation: 'ICRAF Allometric Carbon Equation',
      );

  @override
  Future<List<AgroforestryScheme>> listSchemes() async => schemes;

  @override
  Future<List<SpeciesRecommendation>> getSpeciesSuitability({
    String soilType = 'black_cotton',
    String waterAvailability = 'limited_drip',
  }) async =>
      recommendations;
}

TreeCareGuide _guide(String id, int step) => TreeCareGuide(
      id: id,
      title: 'पायरी $step मार्गदर्शक',
      stepNumber: step,
      stage: 'पहिले वर्ष',
      instructions: 'सूचना $step',
      wateringRule: 'आठवड्यातून दोनदा',
      fertilizerSchedule: 'वर्मीकंपोस्ट',
      pestProtection: 'कडुलिंब फवारणी',
    );

NgoOrganization _ngo() => const NgoOrganization(
      id: 'ngo-1',
      name: 'Vanashree Foundation',
      focusArea: 'Agro-forestry',
      location: 'Nashik',
      contactPhone: '+919800000002',
      email: 'vanashree@example.org',
      treesPlantedCount: 520000,
      rating: 4.8,
      servicesOffered: ['मोफत रोपे', 'प्रशिक्षण'],
      providesFreeSaplings: true,
      websiteUrl: 'https://example.org',
    );

TreePlantation _plantation() => const TreePlantation(
      id: 'pl-1',
      farmerId: 'farmer-1',
      farmerName: 'सुनील देशमुख',
      parcelName: 'गट क्र. ४२ (उत्तर बांध)',
      treeSpecies: 'Bamboo (Tulda)',
      vernacularSpecies: 'तुळदा बांबू',
      treeCount: 250,
      plantingDate: '2026-06-15',
      landType: 'bund',
      latitude: 19.9975,
      longitude: 73.7898,
      initialHeightCm: 45.0,
      photoUrl: '',
      irrigationType: 'drip',
      status: 'verified',
      survivalRate: 94.0,
      currentAvgHeightCm: 140.0,
      estimatedCo2KgPerYear: 5500.0,
      logsCount: 2,
      createdAt: '2026-06-15T09:00:00Z',
      logs: [],
    );

AgroforestryScheme _scheme() => const AgroforestryScheme(
      id: 'sch-1',
      name: 'Sub-Mission on Agroforestry (SMAF)',
      vernacularName: 'हर मेढ पर पेड योजना (SMAF)',
      department: 'कृषी व शेतकरी कल्याण मंत्रालय',
      subsidyAmount: '₹७० प्रति रोप (५०% पर्यंत)',
      eligibility: 'शेतजमिनीवर बांधावर किंवा पिकांसोबत झाडे लावणे आवश्यक.',
      documentsRequired: ['७/१२ उतारा', '८-अ', 'आधार कार्ड'],
      applicationProcess: 'कृषी सहाय्यकाकडे अर्ज करा किंवा महाडीबीटी पोर्टलवर नोंदवा.',
      portalUrl: 'https://agricoop.nic.in',
      status: 'active',
    );

SpeciesRecommendation _recommendation() => const SpeciesRecommendation(
      id: 'rec-1',
      name: 'Bamboo (Manga)',
      vernacularName: 'माणगा बांबू (Dendrocalamus strictus)',
      suitabilityScore: 95,
      recommendedSpacing: '३ × ३ मीटर (बांधावर)',
      gestationYears: '४ वर्षे',
      expectedAnnualRevenue: '₹२.५ लाख प्रति एकर',
      carbonPotential: 'उच्च (वार्षिक २५ kg CO₂/झाड)',
      careSummary: 'कमी पाण्यात उत्तम वाढ, पहिल्या वर्षी ठिबक सिंचन आवश्यक.',
    );

Future<void> pumpTreeView(WidgetTester tester, FakeTreeApi api) async {
  await pumpScreen(
    tester,
    Scaffold(body: TreePlantationView(state: TestAppState(), treeApi: api)),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(const Duration(seconds: 1));
}

Future<void> openTab(WidgetTester tester, String label) async {
  final finder = find.textContaining(label);
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('tree view renders 4 tabs', (tester) async {
    await pumpTreeView(tester, FakeTreeApi());

    expect(find.textContaining('📰 लेख व तंत्रज्ञान'), findsOneWidget);
    expect(find.textContaining('🤝 सामाजिक संस्था'), findsOneWidget);
    expect(find.textContaining('⚡ Fuel झाड'), findsOneWidget);
    expect(find.textContaining('🌿 संगोपन मार्गदर्शक'), findsOneWidget);
  });

  testWidgets('care guides ordered by step', (tester) async {
    final api = FakeTreeApi()
      ..careGuides = [_guide('g3', 3), _guide('g1', 1), _guide('g2', 2)];
    await pumpTreeView(tester, api);
    await openTab(tester, '🌿 संगोपन मार्गदर्शक');

    final first = tester.getTopLeft(find.text('पायरी 1 मार्गदर्शक'));
    final second = tester.getTopLeft(find.text('पायरी 2 मार्गदर्शक'));
    final third = tester.getTopLeft(find.text('पायरी 3 मार्गदर्शक'));
    expect(first.dy, lessThan(second.dy));
    expect(second.dy, lessThan(third.dy));
  });

  testWidgets('free saplings badge renders', (tester) async {
    final api = FakeTreeApi()..ngos = [_ngo()];
    await pumpTreeView(tester, api);
    await openTab(tester, '🤝 सामाजिक संस्था');

    expect(find.text('मुफ्त पौधे'), findsOneWidget);
  });

  testWidgets('my plantations tab renders geo-tagged trees & MRV stats', (tester) async {
    final api = FakeTreeApi()..plantations = [_plantation()];
    await pumpTreeView(tester, api);
    await openTab(tester, '🌳 माझी झाडे & MRV');

    expect(find.text('गट क्र. ४२ (उत्तर बांध)'), findsOneWidget);
    expect(find.text('तुळदा बांबू'), findsOneWidget);
    expect(find.text('250'), findsOneWidget);
    expect(find.text('झाडे (Trees)'), findsOneWidget);
    expect(find.textContaining('94%'), findsWidgets);
  });

  testWidgets('carbon calculator tab calculates estimated credits & earnings', (tester) async {
    final api = FakeTreeApi();
    await pumpTreeView(tester, api);
    await openTab(tester, '🌱 कार्बन कॅल्क्युलेटर');

    expect(find.text('कार्बन क्रेडिट व उत्पन्न कॅल्क्युलेटर'), findsOneWidget);
    expect(find.text('22.0 Credits'), findsOneWidget);
    expect(find.text('₹26400'), findsOneWidget);
  });

  testWidgets('government schemes tab renders schemes & subsidy amount', (tester) async {
    final api = FakeTreeApi()..schemes = [_scheme()];
    await pumpTreeView(tester, api);
    await openTab(tester, '🏛️ शासकीय योजना');

    expect(find.text('हर मेढ पर पेड योजना (SMAF)'), findsOneWidget);
    expect(find.text('कृषी व शेतकरी कल्याण मंत्रालय'), findsOneWidget);
  });

  testWidgets('species suitability advisor recommends species', (tester) async {
    final api = FakeTreeApi()..recommendations = [_recommendation()];
    await pumpTreeView(tester, api);
    await openTab(tester, '🎯 जमीन सल्लागार');

    expect(find.text('मातीचा प्रकार निवडा (Select Soil Type)'), findsOneWidget);
    expect(find.text('माणगा बांबू (Dendrocalamus strictus)'), findsOneWidget);
    expect(find.text('95% योग्य'), findsOneWidget);
  });
}
