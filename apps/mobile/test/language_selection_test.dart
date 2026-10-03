import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/user_api.dart';
import 'package:kisan_setu/main.dart';
import 'package:kisan_setu/state/app_state.dart';
import 'package:kisan_setu/views/account/settings_view.dart';
import 'package:kisan_setu/components/navigation/bottom_menu_bar.dart';
import 'package:kisan_setu/components/navigation/all_tools_sheet.dart';
import 'package:kisan_setu/components/layout/luxury_top_bar_actions.dart';
import 'package:kisan_setu/components/navigation/dashboard_profile_switcher_bar.dart';
import 'package:kisan_setu/views/onboarding/language_select_view.dart';
import 'package:kisan_setu/views/onboarding/profile_select_view.dart';
import 'package:kisan_setu/views/onboarding/auth_view.dart';
import 'package:kisan_setu/views/onboarding/farm_map_marker_view.dart';
import 'package:kisan_setu/views/onboarding/splash_screen.dart';
import 'package:kisan_setu/views/marketplace_view.dart';
import 'package:kisan_setu/views/mandi_view.dart';
import 'package:kisan_setu/views/home_view.dart';
import 'package:kisan_setu/api/weather_api.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class MockWeatherApi extends WeatherApi {
  @override
  Future<Map<String, dynamic>> getWeather(double lat, double lng) async => {
    'temperature': 28,
    'condition': 'Sunny',
  };
}

class MockUserLanguageApi extends UserApi {
  final List<Map<String, dynamic>> savedSettings = [];

  @override
  Future<Map<String, dynamic>> updateSettings(Map<String, dynamic> settings) async {
    savedSettings.add(settings);
    return {'ok': true, ...settings};
  }

  @override
  Future<Map<String, dynamic>> getConsents() async {
    return {'dataSharing': false, 'location': false, 'marketing': false};
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('default language of AppState is english', () {
    final state = AppState();
    expect(state.language, 'en');
    expect(state.tr('home'), 'Home');
    expect(state.tr('mandi'), 'Mandi Prices');
  });

  testWidgets('splash screen is in English before any language is selected', (tester) async {
    final state = AppState();

    await pumpScreen(tester, SplashScreen(state: state));
    // pumpScreen already advanced 1s (past the 750ms DDS phase + fade);
    // advance a bit more so the brand phase is fully built. Stay well below
    // the ~2.9s auto-advance into the app-config gate.
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('AGROVERCITY • Digital Agriculture Platform'), findsOneWidget);
    expect(find.text('Get Started'), findsOneWidget);
  });

  testWidgets('splash screen follows the persisted language for returning users', (tester) async {
    final state = AppState(initialLanguage: 'mr');

    await pumpScreen(tester, SplashScreen(state: state));
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('AGROVERCITY • डिजिटल कृषी प्लॅटफॉर्म'), findsOneWidget);
    expect(find.text('सुरुवात करा'), findsOneWidget);
  });

  test('selecting marathi switches entire translations to marathi and syncs to backend', () async {
    // Signed-in user: sync to backend is expected.
    SharedPreferences.setMockInitialValues({'kAccessToken': 'tok'});
    final mockApi = MockUserLanguageApi();
    final state = AppState(userApi: mockApi);

    expect(state.language, 'en');
    expect(state.tr('home'), 'Home');

    // Switch language to Marathi
    state.setLanguage('mr');

    expect(state.language, 'mr');
    expect(state.tr('home'), 'मुख्यपृष्ठ');
    expect(state.tr('mandi'), 'बाजारभाव');
    expect(state.tr('advisory'), 'पीक सल्ला');
    expect(state.tr('marketplace'), 'कृषी बाजार');
    expect(state.tr('profitLoss'), 'नफा-तोटा (P&L)');
    expect(state.tr('schemes'), 'सरकारी योजना');
    expect(state.tr('settings'), 'सेटिंग्ज');
    expect(state.tr('allTools'), 'सर्व सेवा (Menu)');

    // Verify backend API sync was triggered
    await Future.delayed(const Duration(milliseconds: 50));
    expect(mockApi.savedSettings.isNotEmpty, isTrue);
    expect(mockApi.savedSettings.last['language'], 'mr');
    expect(mockApi.savedSettings.last['preferredLanguage'], 'mr');

    // Verify persistence to SharedPreferences
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('language'), 'mr');
    expect(prefs.getString('preferred_language'), 'mr');
  });

  test('language change before sign-in does not call the authenticated settings API', () async {
    // No kAccessToken in prefs -> onboarding user; sync must be skipped
    // (the language is instead sent with the registration payload).
    final mockApi = MockUserLanguageApi();
    final state = AppState(userApi: mockApi);

    state.setLanguage('hi');
    await Future.delayed(const Duration(milliseconds: 50));

    expect(state.language, 'hi');
    expect(mockApi.savedSettings, isEmpty);
  });

  testWidgets('MaterialApp resolves MaterialLocalizations for non-English locales', (tester) async {
    // Regression: supportedLocales declared mr/hi/... but no
    // localizationsDelegates were configured, so running the app in mr/hi
    // crashed with "No MaterialLocalizations found".
    final state = AppState(initialLanguage: 'mr');

    await tester.pumpWidget(KisanSetuApp(appState: state));
    // Stay within the splash's first phase so no gate/API timers fire.
    await tester.pump(const Duration(milliseconds: 100));

    final context = tester.element(find.byType(Navigator));
    expect(Localizations.localeOf(context), const Locale('mr'));
    expect(MaterialLocalizations.of(context), isNotNull);
    expect(MaterialLocalizations.of(context).okButtonLabel, isNotEmpty);
    expect(tester.takeException(), isNull);
  });

  testWidgets('settings view displays marathi when language is mr and persists change', (tester) async {
    final mockApi = MockUserLanguageApi();
    final state = AppState(userApi: mockApi, initialLanguage: 'mr');

    await pumpScreen(
      tester,
      Scaffold(body: SettingsView(state: state, userApi: mockApi)),
    );

    // Settings title and items should be in Marathi
    expect(find.text('सेटिंग्ज'), findsOneWidget);
    expect(find.text('भाषा'), findsOneWidget);
    expect(find.text('महिला मोड'), findsOneWidget);
    expect(find.text('हाय कॉन्ट्रास्ट'), findsOneWidget);
    expect(find.text('डार्क मोड'), findsOneWidget);
    expect(find.text('खाते हटवा'), findsWidgets);
    expect(find.text('अ‍ॅप आवृत्ती 1.0.0'), findsOneWidget);
  });

  testWidgets('bottom menu bar shows marathi labels for farmer tabs', (tester) async {
    final state = AppState(initialLanguage: 'mr');

    await pumpScreen(
      tester,
      Stack(children: [BottomMenuBar(state: state)]),
    );

    // Farmer tabs: Home • Mandi • Sell Produce • Wallet • Profile
    expect(find.text('मुख्यपृष्ठ'), findsOneWidget);
    expect(find.text('थेट APMC'), findsOneWidget);
    expect(find.text('तुमचा शेतमाल विका'), findsOneWidget);
    expect(find.text('वॉलेट'), findsOneWidget);
    expect(find.text('प्रोफाइल'), findsOneWidget);
  });

  testWidgets('all tools sheet renders marathi module titles', (tester) async {
    final state = AppState(initialLanguage: 'mr');

    await pumpScreen(
      tester,
      AllToolsSheet(state: state),
    );

    expect(find.textContaining('सर्व सेवा (Menu)'), findsOneWidget);
    expect(find.text('मुख्यपृष्ठ'), findsOneWidget);
    expect(find.text('पीक सल्ला'), findsOneWidget);
    expect(find.text('बाजारभाव'), findsOneWidget);
  });

  testWidgets('top bar actions displays language pill and allows switching to Marathi', (tester) async {
    final mockApi = MockUserLanguageApi();
    final state = AppState(userApi: mockApi);

    await pumpScreen(
      tester,
      Scaffold(
        body: TopBarActions(state: state, isWomen: false),
      ),
    );

    // Initial state is English -> pill shows "EN"
    expect(find.text('EN'), findsOneWidget);

    // Tap on language button
    await tester.tap(find.byKey(const ValueKey('topbar_language_button')));
    await tester.pumpAndSettle();

    // Verify Marathi option is present
    expect(find.text('मराठी (Marathi)'), findsOneWidget);

    // Select Marathi
    await tester.tap(find.text('मराठी (Marathi)'));
    await tester.pumpAndSettle();

    // Language in state is now 'mr'
    expect(state.language, 'mr');
    expect(find.text('MR'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('language select view shows English default and Marathi card', (tester) async {
    final mockApi = MockUserLanguageApi();
    final state = AppState(userApi: mockApi);

    await pumpScreen(
      tester,
      LanguageSelectView(state: state),
    );

    // English card and Marathi card are visible
    expect(find.text('English'), findsOneWidget);
    expect(find.text('मराठी'), findsOneWidget);
    expect(find.text('🌐 Default'), findsOneWidget);

    // Tap Marathi card
    await tester.tap(find.text('मराठी'));
    await tester.pumpAndSettle();

    expect(state.language, 'mr');
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('dashboard profile switcher bar renders marathi when state is mr', (tester) async {
    final state = AppState(initialLanguage: 'mr');

    await pumpScreen(
      tester,
      Scaffold(body: DashboardProfileSwitcherBar(state: state)),
    );

    expect(find.text('भूमिका बदला (Switch Role):'), findsOneWidget);
    expect(find.text('शेतकरी'), findsOneWidget);
  });

  testWidgets('settings view dropdown switches language to Marathi and persists', (tester) async {
    final mockApi = MockUserLanguageApi();
    final state = AppState(userApi: mockApi, initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: SettingsView(state: state, userApi: mockApi)),
    );

    expect(find.text('Settings'), findsOneWidget);
    expect(find.text('Language'), findsOneWidget);

    // Open language dropdown
    await tester.tap(find.byKey(const ValueKey('settings_lang_en')));
    await tester.pumpAndSettle();

    // Select Marathi
    await tester.tap(find.text('मराठी (Marathi)').last);
    await tester.pumpAndSettle();

    expect(state.language, 'mr');
    expect(find.text('सेटिंग्ज'), findsOneWidget);
    expect(find.text('भाषा'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('modal language sheet switches language and closes', (tester) async {
    final mockApi = MockUserLanguageApi();
    final state = AppState(userApi: mockApi, initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(
        body: Builder(
          builder: (ctx) => ElevatedButton(
            onPressed: () => showLanguageSelectionSheet(ctx, state),
            child: const Text('Open Sheet'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open Sheet'));
    await tester.pumpAndSettle();

    expect(find.text('मराठी (Marathi)'), findsOneWidget);

    await tester.tap(find.text('मराठी (Marathi)'));
    await tester.pumpAndSettle();

    expect(state.language, 'mr');
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('home view displays full marathi translations when language is mr', (tester) async {
    final state = AppState(initialLanguage: 'mr');

    await pumpScreen(
      tester,
      Scaffold(
        body: HomeView(
          state: state,
          onOpenVoice: () {},
          weatherApi: MockWeatherApi(),
        ),
      ),
    );

    // Header greeting in Marathi
    expect(find.text('शुभ सकाळ'), findsOneWidget);
    // Services section in Marathi
    expect(find.text('आमच्या सेवा'), findsOneWidget);
    // Role switcher in Marathi
    expect(find.textContaining('सक्रिय भूमिका'), findsOneWidget);
    expect(find.textContaining('शेतकरी'), findsWidgets);
    // Mandi widget title in Marathi
    expect(find.text('आजचे बाजारभाव (Live APMC)'), findsOneWidget);
    // Hot offer in Marathi
    expect(find.text('विशेष ऑफर 🔥'), findsOneWidget);
    expect(find.text('50% सूट'), findsOneWidget);
  });

  testWidgets('onboarding and auth flow in Marathi displays all Marathi texts', (tester) async {
    final state = AppState(initialLanguage: 'mr');

    // 1. LanguageSelectView
    await pumpScreen(
      tester,
      Scaffold(body: LanguageSelectView(state: state)),
    );
    expect(find.text('पायरी 1 / 4 • भाषा'), findsOneWidget);
    expect(find.text('तुमची पसंतीची भाषा निवडा'), findsOneWidget);
    expect(find.text('भाषा निवडून पुढे जा →'), findsOneWidget);

    // 2. ProfileSelectView
    await pumpScreen(
      tester,
      Scaffold(body: ProfileSelectView(state: state)),
    );
    expect(find.text('पायरी 2 / 4 • प्रोफाइल्स'), findsOneWidget);
    expect(find.text('तुमच्या भूमिका निवडा (Multi-Role)'), findsOneWidget);
    expect(find.textContaining('मुख्य भूमिका:', findRichText: true), findsOneWidget);
    expect(find.textContaining('पुढे जा'), findsOneWidget);

    // 3. AuthView (Login) — phone + MPIN; OTP only for registration
    await pumpScreen(
      tester,
      Scaffold(body: AuthView(state: state, initialMode: 'login')),
    );
    expect(find.text('डिजिटल कृषी प्लॅटफॉर्म'), findsOneWidget);
    expect(find.text('लॉगिन'), findsWidgets);
    expect(find.text('नोंदणी करा'), findsWidgets);
    expect(find.text('मोबाइल नंबर'), findsOneWidget);
    expect(find.text('पुढे जा'), findsWidgets);
    await tester.enterText(find.byType(TextField).first, '9876543210');
    await tester.tap(find.text('पुढे जा').first);
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('MPIN प्रविष्ट करा'), findsOneWidget);

    // 3b. AuthView (Register)
    await pumpScreen(
      tester,
      Scaffold(body: AuthView(state: state, initialMode: 'register')),
    );
    // 'ओळख व संपर्क' appears in both the progress-bar label and the step title
    expect(find.text('ओळख व संपर्क'), findsWidgets);
    expect(find.text('पूर्ण नाव'), findsOneWidget);
    expect(find.text('राज्य'), findsOneWidget);
    expect(find.text('रेफरल कोड (पर्यायी)'), findsOneWidget);

    // 4. FarmMapMarkerView
    await pumpScreen(
      tester,
      Scaffold(body: FarmMapMarkerView(state: state)),
    );
    expect(find.text('पायरी 4 / 4 • शेत नकाशा'), findsOneWidget);
    expect(find.text('GPS द्वारे शोधा'), findsOneWidget);
    expect(find.text('शेताचे डिजिटल सीमांकन'), findsOneWidget);
    expect(find.text('ओलावा थर'), findsOneWidget);
    expect(find.text('अचूक क्षेत्र:'), findsOneWidget);
    expect(find.text('शेताची पुष्टी करा व डॅशबोर्ड उघडा →'), findsOneWidget);
  });

  testWidgets('onboarding and auth flow in English displays all English texts', (tester) async {
    final state = AppState(initialLanguage: 'en');

    // 1. LanguageSelectView
    await pumpScreen(
      tester,
      Scaffold(body: LanguageSelectView(state: state)),
    );
    expect(find.text('Step 1 / 4 • Language'), findsOneWidget);
    expect(find.text('Select Your Preferred Language'), findsOneWidget);
    expect(find.text('Continue →'), findsOneWidget);

    // 2. ProfileSelectView
    await pumpScreen(
      tester,
      Scaffold(body: ProfileSelectView(state: state)),
    );
    expect(find.text('Step 2 / 4 • Profiles'), findsOneWidget);
    expect(find.text('Select Your Roles (Multi-Role)'), findsOneWidget);
    expect(find.textContaining('Primary Role:', findRichText: true), findsOneWidget);
    expect(find.textContaining('Continue (1 profiles) ➔'), findsOneWidget);

    // 3. AuthView (Login) — phone + MPIN; OTP only for registration
    await pumpScreen(
      tester,
      Scaffold(body: AuthView(state: state, initialMode: 'login')),
    );
    expect(find.text('Digital Agriculture Platform'), findsOneWidget);
    expect(find.text('Login'), findsWidgets);
    expect(find.text('Register'), findsWidgets);
    expect(find.text('Mobile Number'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, '9876543210');
    await tester.tap(find.text('Continue'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Enter MPIN'), findsOneWidget);

    // 3b. AuthView (Register)
    await pumpScreen(
      tester,
      Scaffold(body: AuthView(state: state, initialMode: 'register')),
    );
    expect(find.text('Identity & Contact'), findsWidgets);
    expect(find.text('Step 3 / 4 • Account & Details'), findsOneWidget);

    // 4. FarmMapMarkerView
    await pumpScreen(
      tester,
      Scaffold(body: FarmMapMarkerView(state: state)),
    );
    expect(find.text('Step 4 / 4 • Farm Map'), findsOneWidget);
    expect(find.text('Find by GPS'), findsOneWidget);
    expect(find.text('Digital Farm Geofencing'), findsOneWidget);
    expect(find.text('Moisture Layer'), findsOneWidget);
    expect(find.text('Calculated Area:'), findsOneWidget);
    expect(find.text('Confirm Farm & Open Dashboard →'), findsOneWidget);
  });

  testWidgets('marketplace and mandi views display Marathi when state is mr', (tester) async {
    final state = AppState(initialLanguage: 'mr');
    final fakeMarketplace = FakeMarketplaceApi();
    final fakeMandi = FakeMandiApi();

    // MarketplaceView
    await pumpScreen(
      tester,
      Scaffold(body: MarketplaceView(state: state, marketplaceApi: fakeMarketplace)),
    );
    expect(find.text('ई-मार्केट'), findsOneWidget);
    expect(find.text('विश्वसनीय ऑनलाइन कृषी बाजार'), findsOneWidget);
    expect(find.text('बियाणे'), findsOneWidget);
    expect(find.text('वाहने'), findsOneWidget);
    expect(find.text('खते'), findsOneWidget);
    expect(find.text('कीटकनाशके'), findsOneWidget);
    expect(find.text('अवजारे'), findsOneWidget);

    // MandiView
    await pumpScreen(
      tester,
      Scaffold(body: MandiView(state: state, mandiApi: fakeMandi)),
    );
    expect(find.text('थेट बाजारभाव व नफा अनुकूलक'), findsOneWidget);
    expect(find.text('सर्व पिके'), findsOneWidget);
    expect(find.text('स्मार्ट बाजार निवड'), findsOneWidget);
    expect(find.text('तुमचा शेतमाल विका'), findsOneWidget);
  });
}
