import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/models/user_profile_type.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';
import 'register_referral_test.dart' show pumpWizard, completeToStep3;

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  TestAppState transportState(FakeAuthApi authApi) => TestAppState(
        linked: const [UserProfileType.farmer, UserProfileType.transport],
        authApi: authApi,
      );

  testWidgets('profile wizard pages farmer details first, then transport',
      (tester) async {
    await pumpWizard(tester, transportState(FakeAuthApi()));
    await completeToStep3(tester);

    // Farmer farm-details page first (village was filled by the helper)
    expect(find.text('खेत का विवरण'), findsOneWidget);
    expect(find.text('वाहन विवरण'), findsNothing);

    // Continue to the transport page
    await tester.tap(find.text('भाषा चुनें और आगे बढ़ें →'));
    await tester.pumpAndSettle();

    expect(find.text('वाहन विवरण'), findsOneWidget);
    expect(find.text('खेत का विवरण'), findsNothing);

    // Back returns to the farmer page
    await tester.tap(find.text('पीछे'));
    await tester.pumpAndSettle();
    expect(find.text('खेत का विवरण'), findsOneWidget);
  });

  testWidgets('finish assembles roleProfiles map', (tester) async {
    final authApi = FakeAuthApi();
    await pumpWizard(tester, transportState(authApi));
    await completeToStep3(tester);

    await tester.tap(find.text('भाषा चुनें और आगे बढ़ें →'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'RC नंबर'),
      'MH15AB1234',
    );
    await tester.tap(find.text('पंजीकरण पूरा करें'));
    await tester.pump();
    await tester.pump();

    final roleProfiles =
        authApi.lastRegisterBody?['roleProfiles'] as Map<String, dynamic>?;
    expect(roleProfiles?['transport']?['rcNumber'], 'MH15AB1234');
    expect(roleProfiles?['transport']?['vehicleType'], 'Tata Ace');

    // flush the 4s toast timer from showToast
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('missing required variant field blocks finish', (tester) async {
    final authApi = FakeAuthApi();
    await pumpWizard(tester, transportState(authApi));
    await completeToStep3(tester);

    await tester.tap(find.text('भाषा चुनें और आगे बढ़ें →'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('पंजीकरण पूरा करें'));
    await tester.pump();

    expect(find.text('RC नंबर आवश्यक है'), findsOneWidget);
    expect(authApi.lastRegisterBody, isNull);
  });

  testWidgets('transport-only registration skips farmer page and village',
      (tester) async {
    final authApi = FakeAuthApi();
    final state = TestAppState(
      linked: const [UserProfileType.transport],
      authApi: authApi,
    );
    // Mirror production: the profile-select screen commits the selection.
    state.selectMultipleProfilesDuringRegistration(
      primary: UserProfileType.transport,
      selectedProfiles: const [UserProfileType.transport],
    );
    await pumpWizard(tester, state);
    await completeToStep3(tester); // no village field rendered -> not filled

    // Straight to the transport page — no farm details, no village needed
    expect(find.text('वाहन विवरण'), findsOneWidget);
    expect(find.text('खेत का विवरण'), findsNothing);

    await tester.enterText(
      find.widgetWithText(TextField, 'RC नंबर'),
      'MH12XY9876',
    );
    await tester.tap(find.text('पंजीकरण पूरा करें'));
    await tester.pump();
    await tester.pump();

    expect(authApi.lastRegisterBody, isNotNull);
    expect(authApi.lastRegisterBody?['profiles'], ['transport']);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('equipment rental section renders and serializes', (tester) async {
    final authApi = FakeAuthApi();
    await pumpWizard(
      tester,
      TestAppState(
        linked: const [UserProfileType.farmer, UserProfileType.equipmentRental],
        authApi: authApi,
      ),
    );
    await completeToStep3(tester);

    await tester.tap(find.text('भाषा चुनें और आगे बढ़ें →'));
    await tester.pumpAndSettle();

    expect(find.text('यंत्र विवरण'), findsOneWidget);

    await tester.tap(find.text('पंजीकरण पूरा करें'));
    await tester.pump();
    await tester.pump();

    final roleProfiles =
        authApi.lastRegisterBody?['roleProfiles'] as Map<String, dynamic>?;
    expect(roleProfiles?['equipmentRental']?['machineType'], 'Tractor');
    expect(roleProfiles?['equipmentRental']?['machineCount'], 1);

    await tester.pump(const Duration(seconds: 5));
  });
}
