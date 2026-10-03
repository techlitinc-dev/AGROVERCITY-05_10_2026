// Demo-data excision tests: notifications render from the (fake) API,
// women garden/livestock cards render API data, and the chatbot shows an
// explicit offline notice instead of a fabricated reply on API failure.

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/api_client.dart';
import 'package:kisan_setu/api/notifications_api.dart';
import 'package:kisan_setu/api/women_api.dart';
import 'package:kisan_setu/models/women_models.dart';
import 'package:kisan_setu/state/app_state.dart';
import 'package:kisan_setu/views/account/notifications_view.dart';
import 'package:kisan_setu/views/women_farmer_view.dart';

import 'helpers.dart';

class FakeWomenDataApi extends WomenApi {
  @override
  Future<ShgProfile> getShg() async => const ShgProfile(
        memberCount: 12,
        corpus: 48500,
        loanFund: 30000,
        monthlyDeposit: 500,
      );

  @override
  Future<HomeEnterpriseSummary> getHomeEnterprise() async =>
      const HomeEnterpriseSummary(lines: [], totalMonthlyProfit: 0);

  @override
  Future<List<GardenPlan>> getGardenPlans() async => const [
        GardenPlan(
          id: 'gp-1',
          category: 'Leafy greens',
          items: [
            GardenPlanItem(
              name: 'Spinach',
              vernacularName: 'पालक',
              nutrition: 'Iron',
              companion: 'Coriander',
              daysToHarvest: 30,
            ),
          ],
        ),
      ];

  @override
  Future<List<BackyardLivestock>> getBackyardLivestock() async => const [
        BackyardLivestock(
          id: 'bl-1',
          animal: 'Desi cow',
          vernacularName: 'देसी गाय',
          count: 2,
          yieldLabel: '9.5 litres/day',
          vaccine: 'FMD done',
          vaccineDue: 'HS due Oct',
        ),
      ];
}

class FakeNotificationsApi extends NotificationsApi {
  FakeNotificationsApi();

  List<Map<String, dynamic>> items = const [];
  int markAllReadCalls = 0;

  @override
  Future<NotificationsPage> listNotifications({
    int page = 1,
    int pageSize = 20,
  }) async =>
      NotificationsPage(
        data: items,
        page: page,
        pageSize: pageSize,
        total: items.length,
      );

  @override
  Future<void> markAllRead() async {
    markAllReadCalls += 1;
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('notifications view renders list and mark-all-read',
      (tester) async {
    final api = FakeNotificationsApi()
      ..items = const [
        {
          'id': 'n-1',
          'userId': 'u1',
          'title': 'मौसम अलर्ट',
          'body': 'बारिश की संभावना',
          'type': 'weather_alert',
          'read': false,
          'createdAt': '2026-09-27T06:00:00.000Z',
        },
      ];

    await pumpScreen(
      tester,
      Scaffold(body: NotificationsView(state: TestAppState(), notificationsApi: api)),
    );

    expect(find.text('मौसम अलर्ट'), findsOneWidget);
    expect(api.markAllReadCalls, 0);

    await tester.tap(find.text('सभी पढ़ें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.markAllReadCalls, 1);
  });

  testWidgets('women garden tab renders API plan items', (tester) async {
    await pumpScreen(
      tester,
      Scaffold(
          body: WomenFarmerView(state: TestAppState(), womenApi: FakeWomenDataApi())),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.text('🥗 पोषण वाटिका'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('पालक (Spinach)'), findsOneWidget);
    expect(find.textContaining('Iron'), findsOneWidget);
  });

  testWidgets('women livestock tab renders API records', (tester) async {
    await pumpScreen(
      tester,
      Scaffold(
          body: WomenFarmerView(state: TestAppState(), womenApi: FakeWomenDataApi())),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.text('🐄 पशुधन स्वास्थ्य'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('देसी गाय (Desi cow) × 2'), findsOneWidget);
    expect(find.text('9.5 litres/day'), findsOneWidget);
  });

  test('chatbot failure shows offline notice, success renders API text',
      () async {
    final adapter = FakeHttpAdapter();
    adapter.onPost(
      '/chatbot/messages',
      () => errorEnvelope('NETWORK_ERROR', 500, message: 'boom'),
    );
    final failing = AppState(
      apiClient: ApiClient(
        dio: Dio(BaseOptions(baseUrl: 'http://fake'))
          ..httpClientAdapter = adapter,
      ),
    );

    await failing.sendChatbotMessage('hello');
    expect(failing.chatbotMessages.last.sender, 'bot');
    expect(failing.chatbotMessages.last.text,
        failing.tr('chatbot.offlineNotice'));

    final okAdapter = FakeHttpAdapter();
    okAdapter.onPost(
      '/chatbot/messages',
      () => jsonResponse({
        'id': 'm-1',
        'text': 'Real answer from server',
        'quickReplies': <String>[],
      }, 200),
    );
    final working = AppState(
      apiClient: ApiClient(
        dio: Dio(BaseOptions(baseUrl: 'http://fake'))
          ..httpClientAdapter = okAdapter,
      ),
    );
    await working.sendChatbotMessage('mandi bhav?');
    expect(working.chatbotMessages.last.text, 'Real answer from server');
  });
}
