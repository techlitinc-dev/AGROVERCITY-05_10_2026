import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/core/phone_auth.dart';
import 'package:kisan_setu/views/onboarding/login_form.dart';

import 'helpers.dart';

class _FakePhoneAuth extends PhoneAuth {
  String? sentToPhone;
  String? verifiedOtp;

  @override
  Future<void> sendOtp({
    required String phone,
    required void Function(String verificationId) onCodeSent,
    required void Function(String message) onFailed,
    void Function(String idToken)? onAutoVerified,
  }) async {
    sentToPhone = phone;
    onCodeSent('vid-1');
  }

  @override
  Future<String?> verifyOtp({
    required String verificationId,
    required String otp,
  }) async {
    verifiedOtp = otp;
    return 'id-token-1';
  }
}

class _LoginState extends TestAppState {
  _LoginState({this.loginErrorCode, this.newUserFromOtp = false});

  /// Thrown once on the first [loginWithPhoneMpin] call, then consumed —
  /// mirrors reality where the retry after OTP succeeds.
  final String? loginErrorCode;
  final bool newUserFromOtp;
  bool _errorConsumed = false;
  String? loggedInPhone;
  String? loggedInMpin;
  String? sessionMpin;
  String? switchedAuthMode;

  @override
  Future<void> loginWithPhoneMpin(String phone, String mpin) async {
    loggedInPhone = phone;
    loggedInMpin = mpin;
    final code = loginErrorCode;
    if (code != null && !_errorConsumed) {
      _errorConsumed = true;
      throw ApiException(code: code);
    }
  }

  @override
  Future<bool> loginWithPhone(String idToken) async => newUserFromOtp;

  @override
  Future<void> setMpinForCurrentSession(String mpin) async {
    sessionMpin = mpin;
  }

  @override
  void setAuthMode(String mode) => switchedAuthMode = mode;
}

Future<void> _enterPhoneAndContinue(WidgetTester tester, String phone) async {
  await tester.enterText(find.byType(TextField).first, phone);
  await tester.tap(find.byType(FilledButton).first);
  await tester.pump(const Duration(milliseconds: 300));
}

Future<void> _enterMpinAndSubmit(WidgetTester tester, String mpin) async {
  await tester.enterText(find.byType(TextField).first, mpin);
  await tester.tap(find.byType(FilledButton).first);
  await tester.pump(const Duration(milliseconds: 300));
}

Future<void> _drainOtpCountdown(WidgetTester tester) async {
  for (var i = 0; i < 32; i++) {
    await tester.pump(const Duration(seconds: 1));
  }
}

void main() {
  testWidgets('phone + MPIN logs a returning user in without OTP',
      (tester) async {
    final state = _LoginState();
    await pumpScreen(tester, Scaffold(body: LoginForm(state: state)));

    await _enterPhoneAndContinue(tester, '9876543210');
    expect(find.textContaining('MPIN'), findsWidgets);

    await _enterMpinAndSubmit(tester, '1234');
    expect(state.loggedInPhone, '9876543210');
    expect(state.loggedInMpin, '1234');
  });

  testWidgets('wrong MPIN shows pad error and a retry submits the new digits',
      (tester) async {
    final state = _LoginState(loginErrorCode: 'WRONG_MPIN');
    await pumpScreen(tester, Scaffold(body: LoginForm(state: state)));

    await _enterPhoneAndContinue(tester, '9876543210');
    await _enterMpinAndSubmit(tester, '9999');

    expect(state.loggedInMpin, '9999');
    expect(find.text('गलत MPIN'), findsOneWidget);

    // The pad was cleared after the failure: re-entering 4 fresh digits
    // submits exactly those, not the stale wrong MPIN.
    await _enterMpinAndSubmit(tester, '1234');
    expect(state.loggedInMpin, '1234');
    expect(find.text('गलत MPIN'), findsNothing);
  });

  testWidgets('unknown number routes to OTP registration', (tester) async {
    final state = _LoginState(
      loginErrorCode: 'USER_NOT_FOUND',
      newUserFromOtp: true,
    );
    final phoneAuth = _FakePhoneAuth();
    await pumpScreen(tester, Scaffold(body: LoginForm(state: state, phoneAuth: phoneAuth)));

    await _enterPhoneAndContinue(tester, '9876543210');
    await _enterMpinAndSubmit(tester, '1234');
    await tester.pump(const Duration(milliseconds: 300));

    // OTP step with the registration notice and the prefilled phone.
    expect(phoneAuth.sentToPhone, '+919876543210');
    expect(find.textContaining('पंजीकृत नहीं'), findsOneWidget);
    expect(find.textContaining('OTP'), findsWidgets);

    // Verify the OTP -> brand-new user -> register wizard.
    await tester.enterText(find.byType(TextField).first, '456123');
    await tester.tap(find.byType(FilledButton).first);
    await tester.pump(const Duration(milliseconds: 300));
    expect(phoneAuth.verifiedOtp, '456123');
    expect(state.switchedAuthMode, 'register');

    await _drainOtpCountdown(tester);
  });

  testWidgets('account without MPIN verifies OTP then sets MPIN and logs in',
      (tester) async {
    final state = _LoginState(
      loginErrorCode: 'MPIN_NOT_SET',
      newUserFromOtp: false,
    );
    final phoneAuth = _FakePhoneAuth();
    await pumpScreen(tester, Scaffold(body: LoginForm(state: state, phoneAuth: phoneAuth)));

    await _enterPhoneAndContinue(tester, '9876543210');
    await _enterMpinAndSubmit(tester, '1234');
    await tester.pump(const Duration(milliseconds: 300));

    expect(phoneAuth.sentToPhone, '+919876543210');

    await tester.enterText(find.byType(TextField).first, '456123');
    await tester.tap(find.byType(FilledButton).first);
    await tester.pump(const Duration(milliseconds: 300));

    // Existing user without MPIN lands on the set-MPIN step.
    expect(find.text('नया MPIN सेट करें'), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, '7777');
    await tester.tap(find.byType(FilledButton).first);
    await tester.pump(const Duration(milliseconds: 300));
    expect(state.sessionMpin, '7777');

    await _drainOtpCountdown(tester);
  });

  testWidgets('existing user coming via OTP returns to the MPIN step',
      (tester) async {
    final state = _LoginState(
      loginErrorCode: 'USER_NOT_FOUND',
      newUserFromOtp: false,
    );
    final phoneAuth = _FakePhoneAuth();
    await pumpScreen(tester, Scaffold(body: LoginForm(state: state, phoneAuth: phoneAuth)));

    await _enterPhoneAndContinue(tester, '9876543210');
    await _enterMpinAndSubmit(tester, '1234');
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.textContaining('पंजीकृत नहीं'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, '456123');
    await tester.tap(find.byType(FilledButton).first);
    await tester.pump(const Duration(milliseconds: 300));

    // Back on the MPIN pad; a correct MPIN now logs straight in.
    expect(find.text('MPIN दर्ज करें'), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, '4321');
    await tester.tap(find.byType(FilledButton).first);
    await tester.pump(const Duration(milliseconds: 300));
    expect(state.loggedInMpin, '4321');

    await _drainOtpCountdown(tester);
  });
}
