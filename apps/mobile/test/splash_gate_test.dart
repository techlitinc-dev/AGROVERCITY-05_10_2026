import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/api/app_config_api.dart';
import 'package:kisan_setu/views/onboarding/language_select_view.dart';
import 'package:kisan_setu/views/onboarding/splash_screen.dart';

import 'helpers.dart';

class FakeAppConfigApi extends AppConfigApi {
  FakeAppConfigApi({this.config, this.error});

  final Map<String, dynamic>? config;
  final Object? error;

  @override
  Future<Map<String, dynamic>> getAppConfig() async {
    final e = error;
    if (e != null) throw e;
    return config!;
  }
}

Widget _harness(TestAppState state, AppConfigApi api) {
  return MaterialApp(
    home: ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        if (state.onboardingStep == 'splash') {
          return SplashScreen(state: state, appConfigApi: api);
        }
        return LanguageSelectView(state: state);
      },
    ),
  );
}

Future<void> _pumpPastSplashTimers(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 800)); // phase 1 timer (750ms)
  await tester.pump(const Duration(milliseconds: 500)); // fade reverse (400ms)
  await tester.pump(const Duration(milliseconds: 1900)); // phase 2 timer (1800ms)
  await tester.pump(); // flush the gate microtask
  await tester.pump(const Duration(milliseconds: 500)); // fade reverse -> advance
  await tester.pump();
  await tester.pump(const Duration(seconds: 1)); // staggered entrance animations
}

void main() {
  testWidgets('forceUpdate true shows blocking dialog and blocks navigation',
      (tester) async {
    final state = TestAppState();
    await tester.pumpWidget(_harness(
      state,
      FakeAppConfigApi(config: const {
        'minSupportedVersion': '1.0.0',
        'forceUpdate': true,
        'featureFlags': <String, bool>{},
        'maintenanceMode': false,
      }),
    ));

    await _pumpPastSplashTimers(tester);

    expect(find.text('अपडेट आवश्यक'), findsOneWidget);
    expect(find.text('अपडेट करें'), findsOneWidget);
    expect(find.text('अपनी भाषा चुनें'), findsNothing);
  });

  testWidgets('forceUpdate false advances to language select', (tester) async {
    final state = TestAppState();
    await tester.pumpWidget(_harness(
      state,
      FakeAppConfigApi(config: const {
        'minSupportedVersion': '1.0.0',
        'forceUpdate': false,
        'featureFlags': <String, bool>{},
        'maintenanceMode': false,
      }),
    ));

    await _pumpPastSplashTimers(tester);

    expect(find.text('अपनी भाषा चुनें'), findsOneWidget);
  });

  testWidgets('api error fails open', (tester) async {
    final state = TestAppState();
    await tester.pumpWidget(_harness(
      state,
      FakeAppConfigApi(error: const ApiException(code: 'NETWORK_ERROR')),
    ));

    await _pumpPastSplashTimers(tester);

    expect(find.text('अपनी भाषा चुनें'), findsOneWidget);
  });
}
