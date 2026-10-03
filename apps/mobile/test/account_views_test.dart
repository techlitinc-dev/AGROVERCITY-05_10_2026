import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/api/notifications_api.dart';
import 'package:kisan_setu/api/user_api.dart';
import 'package:kisan_setu/views/account/account_delete_view.dart';
import 'package:kisan_setu/views/account/notifications_view.dart';
import 'package:kisan_setu/views/account/settings_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeSettingsUserApi extends UserApi {
  Map<String, dynamic> consents = const {
    'dataSharing': false,
    'location': false,
    'marketing': false,
    'updatedAt': '2026-09-17T00:00:00Z',
  };
  Object? consentsError;
  Object? putError;
  Object? deleteError;

  final List<Map<String, dynamic>> settingsCalls = [];
  final List<Map<String, bool>> putConsentCalls = [];
  final List<String> deleteCalls = [];

  @override
  Future<Map<String, dynamic>> updateSettings(
      Map<String, dynamic> settings) async {
    settingsCalls.add(settings);
    return {'ok': true};
  }

  @override
  Future<Map<String, dynamic>> getConsents() async {
    final error = consentsError;
    if (error != null) throw error;
    return consents;
  }

  @override
  Future<Map<String, dynamic>> putConsents({
    required bool dataSharing,
    required bool location,
    required bool marketing,
  }) async {
    putConsentCalls.add({
      'dataSharing': dataSharing,
      'location': location,
      'marketing': marketing,
    });
    final error = putError;
    if (error != null) throw error;
    return {
      'dataSharing': dataSharing,
      'location': location,
      'marketing': marketing,
      'updatedAt': '2026-09-17T00:00:00Z',
    };
  }

  @override
  Future<Map<String, dynamic>> deleteAccount(String mpin) async {
    deleteCalls.add(mpin);
    final error = deleteError;
    if (error != null) throw error;
    return {'deleted': true};
  }
}

class FakeNotificationsApi extends NotificationsApi {
  List<Map<String, dynamic>> items = const [];
  Object? listError;
  int markAllReadCalls = 0;
  final List<String> markReadCalls = [];

  @override
  Future<NotificationsPage> listNotifications({
    int page = 1,
    int pageSize = 20,
  }) async {
    final error = listError;
    if (error != null) throw error;
    return NotificationsPage(
      data: items,
      page: page,
      pageSize: pageSize,
      total: items.length,
    );
  }

  @override
  Future<void> markAllRead() async {
    markAllReadCalls += 1;
  }

  @override
  Future<void> markRead(String id) async {
    markReadCalls.add(id);
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('settings renders toggles', (tester) async {
    await pumpScreen(
      tester,
      Scaffold(
          body: SettingsView(
              state: TestAppState(), userApi: FakeSettingsUserApi())),
    );

    expect(find.text('भाषा'), findsOneWidget);
    expect(find.text('महिला मोड'), findsOneWidget);
    expect(find.text('हाई कंट्रास्ट'), findsOneWidget);
    expect(find.text('डार्क मोड'), findsOneWidget);
    expect(find.text('खाता हटाएं'), findsWidgets);
    expect(find.text('ऐप संस्करण 1.0.0'), findsOneWidget);
  });

  testWidgets('account delete shows warning', (tester) async {
    await pumpScreen(
      tester,
      Scaffold(
          body: AccountDeleteView(
              state: TestAppState(), userApi: FakeSettingsUserApi())),
    );

    expect(find.textContaining('पूर्ववत नहीं की जा सकती'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'MPIN दर्ज करें'), findsOneWidget);
  });

  testWidgets('notifications empty state', (tester) async {
    final api = FakeNotificationsApi()
      ..listError = const ApiException(code: 'NOT_FOUND', statusCode: 404);

    await pumpScreen(
      tester,
      Scaffold(
          body: NotificationsView(
              state: TestAppState(), notificationsApi: api)),
    );

    expect(find.text('कोई सूचना नहीं'), findsOneWidget);
  });

  testWidgets('consent toggles render and save', (tester) async {
    final api = FakeSettingsUserApi();

    await pumpScreen(
      tester,
      Scaffold(
          body: SettingsView(state: TestAppState(), userApi: api)),
    );

    expect(find.text('गोपनीयता और सहमति'), findsOneWidget);

    final tile = find.widgetWithText(
        SwitchListTile, 'डेटा साझाकरण (सलाह के लिए)');
    expect(tile, findsOneWidget);
    expect(tester.widget<SwitchListTile>(tile).value, isFalse);

    await tester.tap(tile);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.putConsentCalls.length, 1);
    expect(api.putConsentCalls.first['dataSharing'], isTrue);
    expect(api.putConsentCalls.first['location'], isFalse);
    expect(api.putConsentCalls.first['marketing'], isFalse);
  });
}
