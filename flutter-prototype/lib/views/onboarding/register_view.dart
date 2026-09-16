// Step 3: Farmer Registration & Authentication Suite (Delegates to Unified AuthView)

import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import 'auth_view.dart';

export 'auth_view.dart';

class RegisterView extends StatelessWidget {
  final AppState state;
  final String initialMode;

  const RegisterView({
    super.key,
    required this.state,
    this.initialMode = 'register',
  });

  @override
  Widget build(BuildContext context) {
    return AuthView(
      state: state,
      initialMode: initialMode,
    );
  }
}
