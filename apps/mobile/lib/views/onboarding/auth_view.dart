// Kisan Setu — Auth Suite: Phone OTP Login (Firebase) + 3-Step Register Wizard

import 'package:flutter/material.dart';
import '../../core/phone_auth.dart';
import '../../state/app_state.dart';
import 'login_form.dart';
import 'register_wizard.dart';
import 'onboarding_progress.dart';

class AuthView extends StatefulWidget {
  final AppState state;
  final String initialMode; // 'login' | 'register'
  final PhoneAuth? phoneAuth;

  const AuthView({
    super.key,
    required this.state,
    this.initialMode = 'login',
    this.phoneAuth,
  });

  @override
  State<AuthView> createState() => _AuthViewState();
}

class _AuthViewState extends State<AuthView> {
  late String _authMode;

  @override
  void initState() {
    super.initState();
    _authMode = widget.initialMode;
  }

  @override
  void didUpdateWidget(AuthView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialMode != widget.initialMode) {
      _authMode = widget.initialMode;
    }
  }

  void _switchMode(String mode) {
    setState(() => _authMode = mode);
    widget.state.setAuthMode(mode);
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(0xFF2E7D32);
    return ListenableBuilder(
      listenable: widget.state,
      builder: (context, _) {
        return Scaffold(
          backgroundColor: const Color(0xFFF5F7FA),
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.asset(
                          'assets/app_icon.png',
                          width: 40,
                          height: 40,
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) => const Icon(
                            Icons.eco_rounded,
                            color: primary,
                            size: 40,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.state.tr('appName'),
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF1B5E20),
                              letterSpacing: 1.2,
                            ),
                          ),
                          Text(
                            widget.state.tr('digitalAgriPlatform'),
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF90A4AE),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Overall journey progress (Step 3 of 4: Account & Details)
                  OnboardingFlowProgress(state: widget.state, currentStep: 3),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        _Segment(
                          label: widget.state.tr('login'),
                          selected: _authMode == 'login',
                          onTap: () => _switchMode('login'),
                        ),
                        _Segment(
                          label: widget.state.tr('register'),
                          selected: _authMode == 'register',
                          onTap: () => _switchMode('register'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: KeyedSubtree(
                    key: ValueKey(_authMode),
                    child: _authMode == 'login'
                        ? LoginForm(
                            state: widget.state,
                            phoneAuth: widget.phoneAuth,
                          )
                        : RegisterWizard(
                            state: widget.state,
                            phoneAuth: widget.phoneAuth,
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  },
);
}
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF43A047) : Colors.transparent,
            borderRadius: BorderRadius.circular(11),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: selected ? Colors.white : const Color(0xFF2E7D32),
            ),
          ),
        ),
      ),
    );
  }
}
