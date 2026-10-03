import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../components/auth/forgot_mpin_sheet.dart';
import '../../components/auth/mpin_pad.dart';
import '../../components/onboarding/field_widgets.dart';
import '../../core/phone_auth.dart';
import '../../state/app_state.dart';

// Login journey for returning users: phone number -> MPIN -> done.
// An OTP is only involved for a first-time registration (unknown number),
// an account that has no MPIN yet, or MPIN recovery via "Forgot MPIN".
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

  // 'phone' -> 'mpin' -> 'otp' -> 'setMpin'
  String _step = 'phone';
  String _otpGoal = 'register'; // 'register' | 'setMpin'
  String? _verificationId;
  int _otpCountdown = 0;
  Timer? _otpTimer;
  bool _busy = false;
  String? _error;
  String? _notice;
  bool _wrongMpin = false;

  String get _phone => _phoneController.text.trim();

  @override
  void dispose() {
    _otpTimer?.cancel();
    _phoneController.dispose();
    _otpController.dispose();
    _mpinController.dispose();
    super.dispose();
  }

  void _startCountdown() {
    _otpTimer?.cancel();
    _otpCountdown = 30;
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
  }

  void _showMpinStep() {
    setState(() {
      _step = 'mpin';
      _busy = false;
      _error = null;
      _notice = null;
      _wrongMpin = false;
      _mpinController.clear();
    });
  }

  void _beginOtp(String goal, String noticeKey) {
    setState(() {
      _otpGoal = goal;
      _notice = widget.state.tr(noticeKey);
      _step = 'otp';
      _error = null;
      _otpController.clear();
      _busy = true;
    });
    _phoneAuth.sendOtp(
      phone: '+91$_phone',
      onCodeSent: (verificationId) {
        if (!mounted) return;
        setState(() {
          _busy = false;
          _verificationId = verificationId;
        });
        _startCountdown();
      },
      onFailed: (message) {
        if (!mounted) return;
        setState(() {
          _busy = false;
          _error = message;
        });
      },
      onAutoVerified: (idToken) {
        _otpTimer?.cancel();
        _onIdToken(idToken);
      },
    );
  }

  Future<void> _verifyOtp() async {
    final verificationId = _verificationId;
    if (verificationId == null || _otpController.text.trim().length < 4) {
      setState(() => _error = widget.state.tr('invalidOtp'));
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
        _error = widget.state.tr('invalidOtpRetry');
        _otpController.clear();
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
      return;
    }
    setState(() {
      _busy = false;
      _error = null;
      _notice = null;
      _wrongMpin = false;
      if (_otpGoal == 'setMpin') {
        _step = 'setMpin';
        _mpinController.clear();
      } else {
        _showMpinStep();
      }
    });
  }

  Future<void> _submitPhoneMpin() async {
    if (_mpinController.text.length != 4 || _busy) return;
    setState(() {
      _busy = true;
      _wrongMpin = false;
      _error = null;
    });
    try {
      await widget.state.loginWithPhoneMpin(_phone, _mpinController.text);
      // On success AppState flips the app to the dashboard and this form
      // unmounts; nothing further to do here.
    } on ApiException catch (e) {
      if (!mounted) return;
      switch (e.code) {
        case 'WRONG_MPIN':
          // Clear the pad so the retry can't resubmit the stale digits —
          // the field is full (4/4) and maxLength would swallow new input.
          setState(() {
            _busy = false;
            _wrongMpin = true;
            _mpinController.clear();
          });
        case 'USER_NOT_FOUND':
          _beginOtp('register', 'loginNotRegistered');
        case 'MPIN_NOT_SET':
          _beginOtp('setMpin', 'loginMpinNotSet');
        default:
          setState(() {
            _busy = false;
            _error = e.message.isEmpty ? e.code : e.message;
          });
      }
    }
  }

  Future<void> _submitSetMpin() async {
    if (_mpinController.text.length != 4 || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.state.setMpinForCurrentSession(_mpinController.text);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message.isEmpty ? e.code : e.message;
        _mpinController.clear();
      });
    }
  }

  void _openForgotMpin() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => ForgotMpinSheet(
        state: widget.state,
        phoneAuth: _phoneAuth,
        initialPhone: _phone,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_step == 'phone') ...[
            LabeledTextField(
              controller: _phoneController,
              label: widget.state.tr('mobileNumber'),
              keyboardType: TextInputType.phone,
              prefix: '+91 ',
            ),
            if (_error != null) _ErrorText(_error!),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _busy
                  ? null
                  : () {
                      if (_phone.length < 10) {
                        setState(() => _error = widget.state.tr('invalidPhone'));
                        return;
                      }
                      _showMpinStep();
                    },
              child: Text(widget.state.tr('continue')),
            ),
          ] else if (_step == 'mpin') ...[
            Text(
              widget.state.tr('enterMpin'),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 4),
            Text(
              '+91 $_phone',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 12),
            MpinPad(
              controller: _mpinController,
              errorText: _wrongMpin ? widget.state.tr('wrongMpin') : null,
              onChanged: (_) => setState(() => _wrongMpin = false),
            ),
            if (_error != null) _ErrorText(_error!),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _busy ? null : _submitPhoneMpin,
              child: Text(widget.state.tr('login')),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton(
                  onPressed: _busy ? null : _openForgotMpin,
                  child: Text(widget.state.tr('forgotMpin')),
                ),
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _step = 'phone';
                            _error = null;
                            _wrongMpin = false;
                          }),
                  child: Text(widget.state.tr('changeNumber')),
                ),
              ],
            ),
          ] else if (_step == 'otp') ...[
            if (_notice != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  _notice!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                ),
              ),
            Text(
              '+91 $_phone',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 10),
            LabeledTextField(
              controller: _otpController,
              label: widget.state.tr('otp'),
              keyboardType: TextInputType.number,
            ),
            if (_otpCountdown > 0)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  '${widget.state.tr('resendIn')} $_otpCountdown s',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
              ),
            if (_error != null) _ErrorText(_error!),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _busy ? null : _verifyOtp,
              child: Text(widget.state.tr('verifyOtp')),
            ),
            TextButton(
              onPressed: _busy
                  ? null
                  : () => setState(() {
                        _step = 'phone';
                        _error = null;
                        _notice = null;
                      }),
              child: Text(widget.state.tr('changeNumber')),
            ),
          ] else ...[
            Text(
              widget.state.tr('setMpinTitle'),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            MpinPad(
              controller: _mpinController,
              onChanged: (_) {},
            ),
            if (_error != null) _ErrorText(_error!),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _busy ? null : _submitSetMpin,
              child: Text(widget.state.tr('setMpinAndLogin')),
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
