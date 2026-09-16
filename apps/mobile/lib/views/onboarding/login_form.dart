import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../components/auth/forgot_mpin_sheet.dart';
import '../../components/auth/mpin_pad.dart';
import '../../components/onboarding/field_widgets.dart';
import '../../core/phone_auth.dart';
import '../../state/app_state.dart';

class LoginForm extends StatefulWidget {
  const LoginForm({super.key, required this.state, this.phoneAuth});

  final AppState state;
  final PhoneAuth? phoneAuth;

  @override
  State<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  late final PhoneAuth _phoneAuth = widget.phoneAuth ?? PhoneAuth();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _mpinController = TextEditingController();

  String? _verificationId;
  bool _otpSent = false;
  int _otpCountdown = 0;
  Timer? _otpTimer;
  bool _mpinStep = false;
  bool _busy = false;
  String? _error;
  bool _wrongMpin = false;

  @override
  void dispose() {
    _otpTimer?.cancel();
    _phoneController.dispose();
    _otpController.dispose();
    _mpinController.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (_phoneController.text.trim().length < 10) {
      setState(() => _error = 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    await _phoneAuth.sendOtp(
      phone: '+91${_phoneController.text.trim()}',
      onCodeSent: (verificationId) {
        _otpTimer?.cancel();
        setState(() {
          _busy = false;
          _otpSent = true;
          _verificationId = verificationId;
          _otpCountdown = 30;
        });
        _otpTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
          if (!mounted) return timer.cancel();
          setState(() {
            if (_otpCountdown > 0) {
              _otpCountdown--;
            } else {
              timer.cancel();
            }
          });
        });
      },
      onFailed: (message) => setState(() {
        _busy = false;
        _error = message;
      }),
      onAutoVerified: (idToken) {
        _otpTimer?.cancel();
        _onIdToken(idToken);
      },
    );
  }

  Future<void> _verifyOtp() async {
    final verificationId = _verificationId;
    if (verificationId == null || _otpController.text.trim().length < 4) {
      setState(() => _error = 'कृपया सही OTP दर्ज करें');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final idToken = await _phoneAuth.verifyOtp(
      verificationId: verificationId,
      otp: _otpController.text.trim(),
    );
    if (!mounted) return;
    if (idToken == null) {
      setState(() {
        _busy = false;
        _error = 'अमान्य OTP — पुनः प्रयास करें';
      });
      return;
    }
    _otpTimer?.cancel();
    await _onIdToken(idToken);
  }

  Future<void> _onIdToken(String idToken) async {
    bool isNewUser;
    try {
      isNewUser = await widget.state.loginWithPhone(idToken);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message.isEmpty ? e.code : e.message;
      });
      return;
    }
    if (!mounted) return;
    if (isNewUser) {
      widget.state.setAuthMode('register');
    } else {
      setState(() {
        _busy = false;
        _mpinStep = true;
      });
    }
  }

  Future<void> _submitMpin() async {
    if (_mpinController.text.length != 4) return;
    setState(() {
      _busy = true;
      _wrongMpin = false;
    });
    final ok = await widget.state.loginWithMobileAndMpin(
      _phoneController.text.trim(),
      _mpinController.text,
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      _wrongMpin = !ok;
    });
  }

  void _openForgotMpin() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => ForgotMpinSheet(
        state: widget.state,
        phoneAuth: _phoneAuth,
        initialPhone: _phoneController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!_mpinStep) ...[
            LabeledTextField(
              controller: _phoneController,
              label: 'मोबाइल नंबर',
              keyboardType: TextInputType.phone,
              prefix: '+91 ',
            ),
            if (_otpSent) ...[
              const SizedBox(height: 10),
              LabeledTextField(
                controller: _otpController,
                label: 'OTP',
                keyboardType: TextInputType.number,
              ),
              if (_otpCountdown > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'पुनः भेजें ${_otpCountdown}s में',
                    style:
                        const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                ),
            ],
            if (_error != null) _ErrorText(_error!),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _busy ? null : (_otpSent ? _verifyOtp : _sendOtp),
              child: Text(_otpSent ? 'सत्यापित करें' : 'OTP भेजें'),
            ),
          ] else ...[
            const Text(
              'MPIN दर्ज करें',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            MpinPad(
              controller: _mpinController,
              errorText: _wrongMpin ? 'गलत MPIN' : null,
              onChanged: (_) => setState(() => _wrongMpin = false),
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _busy ? null : _submitMpin,
              child: const Text('लॉगिन करें'),
            ),
            TextButton(
              onPressed: _busy ? null : _openForgotMpin,
              child: const Text('MPIN भूल गए?'),
            ),
          ],
        ],
      ),
    );
  }
}

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Text(
        message,
        style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
      ),
    );
  }
}
