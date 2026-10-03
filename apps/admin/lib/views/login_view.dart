import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';
import '../core/auth.dart';

class LoginView extends StatefulWidget {
  const LoginView({super.key, required this.auth, required this.onLoggedIn});

  final AdminAuth auth;
  final VoidCallback onLoggedIn;

  @override
  State<LoginView> createState() => _LoginViewState();
}

class _LoginViewState extends State<LoginView> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final api = context.read<AdminApi>();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.auth.signIn(_email.text.trim(), _password.text);
      await api.login();
      widget.onLoggedIn();
    } on ApiException catch (e) {
      setState(() {
        _error = e.code == 'ADMIN_REQUIRED'
            ? 'यह खाता एडमिन नहीं है'
            : 'लॉगिन विफल (${e.code})';
      });
      await widget.auth.signOut();
    } catch (_) {
      setState(() => _error = 'ईमेल या पासवर्ड गलत है');
      await widget.auth.signOut();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.auth.configured) {
      return const Scaffold(
        body: Center(
          child: Text(
            'Firebase कॉन्फ़िग नहीं है — firebase_options.dart में flutterfire configure चलाएं',
          ),
        ),
      );
    }
    return Scaffold(
      body: Center(
        child: SizedBox(
          width: 360,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'किसान सेतु — एडमिन',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'ईमेल'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'पासवर्ड'),
                    onSubmitted: (_) => _submit(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('लॉगिन'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
