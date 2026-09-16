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

  testWidgets('transport section renders for transport profile',
      (tester) async {
    await pumpWizard(tester, transportState(FakeAuthApi()));
    await completeToStep3(tester);

    expect(find.text('खेत का विवरण'), findsOneWidget);
    expect(find.text('वाहन विवरण'), findsOneWidget);
  });

  testWidgets('finish assembles roleProfiles map', (tester) async {
    final authApi = FakeAuthApi();
    await pumpWizard(tester, transportState(authApi));
    await completeToStep3(tester);

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

    await tester.tap(find.text('पंजीकरण पूरा करें'));
    await tester.pump();

    expect(find.text('RC नंबर आवश्यक है'), findsOneWidget);
    expect(authApi.lastRegisterBody, isNull);
  });
}
