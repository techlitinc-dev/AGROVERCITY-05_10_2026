import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/views/onboarding/register_wizard.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

Future<void> pumpWizard(WidgetTester tester, TestAppState state) async {
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: RegisterWizard(state: state, phoneAuth: FakePhoneAuth()),
        ),
      ),
    ),
  );
  await tester.pump();
}

Future<void> completeToStep3(WidgetTester tester) async {
  await tester.enterText(
    find.widgetWithText(TextField, 'पूरा नाम'),
    'Ram Singh',
  );
  await tester.enterText(
    find.widgetWithText(TextField, 'मोबाइल नंबर'),
    '9823456789',
  );
  await tester.tap(find.text('OTP भेजें'));
  await tester.pump();
  await tester.enterText(find.widgetWithText(TextField, 'OTP'), '123456');
  await tester.tap(find.text('सत्यापित करें'));
  await tester.pump();
  await tester.pump();
  await tester.enterText(
    find.widgetWithText(TextField, '4-अंकीय MPIN'),
    '1234',
  );
  await tester.enterText(
    find.widgetWithText(TextField, 'MPIN दोबारा दर्ज करें'),
    '1234',
  );
  await tester.tap(find.text('आगे बढ़ें'));
  await tester.pump();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('invalid referral code shows inline error and stays on step 1',
      (tester) async {
    final authApi = FakeAuthApi()
      ..registerError = const ApiException(
        code: 'INVALID_REFERRAL_CODE',
        statusCode: 400,
      );
    await pumpWizard(tester, TestAppState(authApi: authApi));

    await tester.enterText(
      find.widgetWithText(TextField, 'रेफरल कोड (वैकल्पिक)'),
      'bad_code',
    );
    await completeToStep3(tester);
    await tester.tap(find.text('पंजीकरण पूरा करें'));
    await tester.pump();
    await tester.pump();

    expect(find.text('अमान्य रेफरल कोड'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'पूरा नाम'), findsOneWidget);
    expect(find.text('पंजीकरण पूरा करें'), findsNothing);
  });

  testWidgets('valid referral code is passed to register', (tester) async {
    final authApi = FakeAuthApi();
    await pumpWizard(tester, TestAppState(authApi: authApi));

    await tester.enterText(
      find.widgetWithText(TextField, 'रेफरल कोड (वैकल्पिक)'),
      'ref_ab12cd34',
    );
    await completeToStep3(tester);
    await tester.tap(find.text('पंजीकरण पूरा करें'));
    await tester.pump();
    await tester.pump();

    expect(authApi.lastRegisterBody?['referralCode'], 'ref_ab12cd34');

    // flush the 4s toast timer from showToast
    await tester.pump(const Duration(seconds: 5));
  });
}
