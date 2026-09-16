import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../core/phone_auth.dart';
import '../../state/app_state.dart';
import '../onboarding/field_widgets.dart';
import 'mpin_pad.dart';

class ForgotMpinSheet extends StatefulWidget {
  const ForgotMpinSheet({
    super.key,
    required this.state,
    this.phoneAuth,
    this.initialPhone = '',
  });

  final AppState state;
  final PhoneAuth? phoneAuth;
  final String initialPhone;

  @override
  State<ForgotMpinSheet> createState() => _ForgotMpinSheetState();
}

class _ForgotMpinSheetState extends State<ForgotMpinSheet> {
  late final PhoneAuth _phoneAuth = widget.phoneAuth ?? PhoneAuth();
  late final _phoneController =
      TextEditingController(text: widget.initialPhone);
  final _otpController = TextEditingController();
  final _mpinController = TextEditingController();
  final _mpinConfirmController = TextEditingController();

  String? _verificationId;
  bool _otpSent = false;
  bool _otpVerified = false;
  String? _idToken;
  bool _busy = false;
  String? _error;
  Timer? _otpTimer;
  int _otpCountdown = 0;

  @override
  void dispose() {
    _otpTimer?.cancel();
    _phoneController.dispose();
    _otpController.dispose();
    _mpinController.dispose();
    _mpinConfirmController.dispose();
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
        setState(() {
          _busy = false;
          _otpVerified = true;
          _idToken = idToken;
        });
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
    setState(() {
      _busy = false;
      _otpVerified = true;
      _idToken = idToken;
    });
  }

  Future<void> _submitNewMpin() async {
    final idToken = _idToken;
    final mpin = _mpinController.text.trim();
    final confirm = _mpinConfirmController.text.trim();
    if (mpin.length != 4 || mpin != confirm || idToken == null) {
      setState(() => _error = 'दोनों MPIN मेल नहीं खा रहे हैं');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.state.resetMpinWithOtp(idToken: idToken, newMpin: mpin);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message.isEmpty ? e.code : e.message;
      });
      return;
    }
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final mpin = _mpinController.text;
    final confirm = _mpinConfirmController.text;
    final showMatch = mpin.length == 4 && confirm.length == 4;
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'MPIN रीसेट करें',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 14),
            if (!_otpVerified) ...[
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
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ),
              ],
              const SizedBox(height: 14),
              FilledButton(
                onPressed: _busy ? null : (_otpSent ? _verifyOtp : _sendOtp),
                child: Text(_otpSent ? 'सत्यापित करें' : 'OTP भेजें'),
              ),
            ] else ...[
              MpinPad(
                controller: _mpinController,
                label: 'नया 4-अंकीय MPIN',
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 10),
              MpinPad(
                controller: _mpinConfirmController,
                label: 'नया MPIN दोबारा दर्ज करें',
                onChanged: (_) => setState(() {}),
              ),
              if (showMatch)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    mpin == confirm
                        ? '✅ MPIN मेल खा गया'
                        : '❌ MPIN मेल नहीं खा रहा',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: mpin == confirm
                          ? const Color(0xFF2E7D32)
                          : const Color(0xFFDC2626),
                    ),
                  ),
                ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: _busy ? null : _submitNewMpin,
                child: const Text('MPIN बदलें'),
              ),
            ],
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
                ),
              ),
            TextButton(
              onPressed: _busy ? null : () => Navigator.of(context).pop(),
              child: const Text('रद्द करें'),
            ),
          ],
        ),
      ),
    );
  }
}
