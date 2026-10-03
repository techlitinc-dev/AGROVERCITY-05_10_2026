import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'api/admin_api.dart';
import 'core/auth.dart';
import 'firebase_options.dart';
import 'views/admin_shell.dart';
import 'views/login_view.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AdminAuth auth = UnconfiguredAdminAuth();
  if (firebaseOptionsConfigured) {
    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      auth = FirebaseAdminAuth(FirebaseAuth.instance);
    } catch (_) {
      auth = UnconfiguredAdminAuth();
    }
  }
  runApp(AdminApp(auth: auth));
}

class AdminApp extends StatefulWidget {
  const AdminApp({super.key, required this.auth});

  final AdminAuth auth;

  @override
  State<AdminApp> createState() => _AdminAppState();
}

class _AdminAppState extends State<AdminApp> {
  late final AdminApi _api = AdminApi(tokenProvider: widget.auth.idToken);
  bool _loggedIn = false;

  @override
  Widget build(BuildContext context) {
    return Provider<AdminApi>.value(
      value: _api,
      child: MaterialApp(
        title: 'किसान सेतु — एडमिन',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: Colors.green, useMaterial3: true),
        home: _loggedIn
            ? AdminShell(auth: widget.auth, onSignedOut: _signOut)
            : LoginView(
                auth: widget.auth,
                onLoggedIn: () => setState(() => _loggedIn = true),
              ),
      ),
    );
  }

  Future<void> _signOut() async {
    await widget.auth.signOut();
    setState(() => _loggedIn = false);
  }
}
