import 'package:firebase_auth/firebase_auth.dart';

abstract class AdminAuth {
  bool get configured;
  Future<void> signIn(String email, String password);
  Future<String?> idToken();
  Future<void> signOut();
}

class FirebaseAdminAuth extends AdminAuth {
  FirebaseAdminAuth(this._auth);

  final FirebaseAuth _auth;

  @override
  bool get configured => true;

  @override
  Future<void> signIn(String email, String password) =>
      _auth.signInWithEmailAndPassword(email: email, password: password);

  @override
  Future<String?> idToken() => _auth.currentUser!.getIdToken();

  @override
  Future<void> signOut() => _auth.signOut();
}

class UnconfiguredAdminAuth extends AdminAuth {
  @override
  bool get configured => false;

  @override
  Future<void> signIn(String email, String password) =>
      throw StateError('Firebase not configured');

  @override
  Future<String?> idToken() async => null;

  @override
  Future<void> signOut() async {}
}
