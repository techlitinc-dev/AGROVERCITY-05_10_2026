import 'package:firebase_auth/firebase_auth.dart';

// Thin wrapper over FirebaseAuth phone OTP so views never touch Firebase
// directly and tests can fake the whole flow. When Firebase is not
// initialised (no google-services.json / firebase_options yet), every call
// degrades to onFailed with a user-facing message instead of crashing.
class PhoneAuth {
  PhoneAuth({this._auth});

  final FirebaseAuth? _auth;

  FirebaseAuth? get _instance {
    final injected = _auth;
    if (injected != null) return injected;
    try {
      return FirebaseAuth.instance;
    } catch (_) {
      return null;
    }
  }

  Future<void> sendOtp({
    required String phone,
    required void Function(String verificationId) onCodeSent,
    required void Function(String message) onFailed,
    void Function(String idToken)? onAutoVerified,
  }) async {
    final auth = _instance;
    if (auth == null) {
      onFailed('Firebase कॉन्फ़िगर नहीं है — OTP अभी उपलब्ध नहीं');
      return;
    }
    try {
      await auth.verifyPhoneNumber(
        phoneNumber: phone,
        verificationCompleted: (credential) async {
          try {
            final userCred = await auth.signInWithCredential(credential);
            final token = await userCred.user?.getIdToken();
            if (token != null) {
              onAutoVerified?.call(token);
            } else {
              onFailed('OTP सत्यापन विफल — पुनः प्रयास करें');
            }
          } catch (_) {
            onFailed('OTP सत्यापन विफल — पुनः प्रयास करें');
          }
        },
        verificationFailed: (e) =>
            onFailed(e.message ?? 'OTP भेजना विफल — पुनः प्रयास करें'),
        codeSent: (verificationId, _) => onCodeSent(verificationId),
        codeAutoRetrievalTimeout: (_) {},
      );
    } catch (_) {
      onFailed('OTP भेजना विफल — पुनः प्रयास करें');
    }
  }

  Future<String?> verifyOtp({
    required String verificationId,
    required String otp,
  }) async {
    final auth = _instance;
    if (auth == null) return null;
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: otp,
      );
      final userCred = await auth.signInWithCredential(credential);
      return await userCred.user?.getIdToken();
    } catch (_) {
      return null;
    }
  }
}
