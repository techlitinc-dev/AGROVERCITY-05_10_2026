import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/gyan_api.dart';
import 'package:kisan_setu/models/gyan_models.dart';
import 'package:kisan_setu/views/gyan_hub_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeGyanApi extends GyanApi {
  List<PaidWorkshop> workshops = const [];
  List<ExpertTalk> talks = const [];
  List<VideoGuide> videos = const [];
  List<BlogArticle> blogs = const [];

  final List<String> registeredTalks = [];

  @override
  Future<List<PaidWorkshop>> listWorkshops() async => workshops;

  @override
  Future<List<ExpertTalk>> listTalks() async => talks;

  @override
  Future<List<VideoGuide>> listVideos({String? category}) async => videos;

  @override
  Future<List<BlogArticle>> listBlogs({String? category}) async => blogs;

  @override
  Future<Map<String, dynamic>> registerTalk(String talkId) async {
    registeredTalks.add(talkId);
    return {'registered': true, 'agriCoinsEarned': 25};
  }
}

PaidWorkshop _workshop() => PaidWorkshop(
      id: 'ws-1',
      title: 'पॉलीहाऊस मास्टरक्लास',
      instructor: 'डॉ. देशपांडे',
      instructorRole: 'ICAR शास्त्रज्ञ',
      institution: 'ICAR-IARI',
      feeRupees: 499,
      coinsDiscountAllowed: 200,
      duration: '4 आठवडे',
      batchDate: '1 ऑक्टो 2026',
      timing: 'सायं. 6:00',
      rating: 4.8,
      enrolledCount: 380,
      totalSeats: 500,
      isCertified: true,
      certificateTitle: 'ICAR प्रमाणपत्र',
      syllabusModules: const ['मॉड्यूल 1'],
      deliverables: const ['प्रमाणपत्र'],
    );

ExpertTalk _talk() => const ExpertTalk(
      id: 'talk-1',
      expertName: 'डॉ. आनंद कुलकर्णी',
      institution: 'MPKV Rahuri',
      topic: 'असमान्य पावसाचे व्यवस्थापन',
      scheduledTime: 'शुक्रवार सायं. 7:00',
      isLive: true,
      registeredCount: 240,
      description: 'खरीप पिकांमधील बुरषीजन्य रोगांवर चर्चा.',
    );

Future<void> pumpGyanHub(WidgetTester tester, FakeGyanApi api) async {
  await pumpScreen(
    tester,
    Scaffold(
      body: GyanHubView(
        state: TestAppState(),
        gyanApi: api,
        enableVideo: false,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('gyan hub renders 4 tabs', (tester) async {
    await pumpGyanHub(tester, FakeGyanApi());

    expect(find.textContaining('🎓 सशुल्क कार्यशालाएँ'), findsOneWidget);
    expect(find.textContaining('🎙️ विशेषज्ञ लाइव टॉक'), findsOneWidget);
    expect(find.textContaining('🎬 वीडियो ट्यूटोरियल्स'), findsOneWidget);
    expect(find.textContaining('📰 एग्रोनॉमी ब्लॉग्स'), findsOneWidget);
  });

  testWidgets('workshop card shows seats progress', (tester) async {
    final api = FakeGyanApi()..workshops = [_workshop()];
    await pumpGyanHub(tester, api);

    expect(find.textContaining('380/500'), findsOneWidget);
  });

  testWidgets('talk register awards coins', (tester) async {
    final api = FakeGyanApi()..talks = [_talk()];
    await pumpGyanHub(tester, api);

    await tester.tap(find.textContaining('विशेषज्ञ लाइव टॉक'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.text('पंजीकरण करें (+25 कॉइन)'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));

    expect(api.registeredTalks, ['talk-1']);
    expect(find.text('+25 AgriCoins मिले!'), findsOneWidget);
    expect(find.text('पंजीकृत ✓'), findsOneWidget);
  });
}
