import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/components/navigation/profile_switcher_sheet.dart';
import 'package:kisan_setu/models/user_profile_type.dart';

import 'helpers.dart';

Future<void> openSwitcherSheet(WidgetTester tester, TestAppState state) async {
  await pumpScreen(
    tester,
    Builder(
      builder: (context) => Scaffold(
        body: Center(
          child: ElevatedButton(
            onPressed: () => showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (_) => ProfileSwitcherSheet(state: state),
            ),
            child: const Text('open'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('sheet lists linked profiles from state', (tester) async {
    final state = TestAppState(
      linked: const [UserProfileType.farmer, UserProfileType.seller],
      user: const {
        'linkedProfiles': ['farmer', 'seller'],
        'activeProfile': 'farmer',
      },
    );

    await openSwitcherSheet(tester, state);

    expect(find.text('किसान'), findsWidgets);
    expect(find.text('व्यापारी'), findsWidgets);
    expect(find.text('जोड़ें +'), findsWidgets);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('tapping a profile calls activate', (tester) async {
    final userApi = FakeUserApi();
    userApi.activateResponse = const {
      'activeProfile': 'seller',
      'defaultHomeRoute': 'home',
      'user': {
        'linkedProfiles': ['farmer', 'seller'],
        'activeProfile': 'seller',
      },
    };
    final state = TestAppState(
      linked: const [UserProfileType.farmer, UserProfileType.seller],
      user: const {
        'linkedProfiles': ['farmer', 'seller'],
        'activeProfile': 'farmer',
      },
      userApi: userApi,
    );

    await openSwitcherSheet(tester, state);

    await tester.tap(find.text('व्यापारी').first);
    await tester.pump();
    await tester.pumpAndSettle();

    expect(userApi.lastActivated, 'seller');

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('LAST_PROFILE error shows toast and keeps sheet open',
      (tester) async {
    final userApi = FakeUserApi();
    userApi.unlinkError = const ApiException(
      code: 'LAST_PROFILE',
      message: 'कम से कम एक प्रोफाइल आवश्यक है',
      statusCode: 409,
    );
    final state = TestAppState(
      linked: const [UserProfileType.farmer, UserProfileType.seller],
      user: const {
        'linkedProfiles': ['farmer', 'seller'],
        'activeProfile': 'farmer',
      },
      userApi: userApi,
    );

    await openSwitcherSheet(tester, state);

    // Seller is linked but not active → its manage-row toggle reads "हटाएं".
    await tester.tap(find.text('हटाएं'));
    await tester.pumpAndSettle();

    // Confirm dialog → confirm the unlink.
    await tester.tap(find.widgetWithText(ElevatedButton, 'हटाएं'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(userApi.lastUnlinked, 'seller');
    expect(find.textContaining('कम से कम'), findsOneWidget);
    expect(find.text('प्रोफाइल स्विचर (Role Switcher)'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });
}
