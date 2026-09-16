import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../components/onboarding/role_profile_form.dart';
import '../../core/phone_auth.dart';
import '../../models/user_profile_type.dart';
import '../../state/app_state.dart';
import 'register_form_data.dart';
import 'register_step3_details.dart';
import 'register_wizard_steps.dart';

class RegisterWizard extends StatefulWidget {
  const RegisterWizard({super.key, required this.state, this.phoneAuth});

  final AppState state;
  final PhoneAuth? phoneAuth;

  @override
  State<RegisterWizard> createState() => RegisterWizardState();
}

class RegisterWizardState extends State<RegisterWizard> {
  final data = RegisterFormData();
  late final PhoneAuth _phoneAuth = widget.phoneAuth ?? PhoneAuth();
  int step = 1;
  bool busy = false;
  Timer? _otpTimer;
  final Map<String, String?> roleErrors = {};

  List<String> get _profileKeys =>
      widget.state.linkedProfiles.map((t) => t.name).toList();

  @override
  void dispose() {
    _otpTimer?.cancel();
    data.dispose();
    super.dispose();
  }

  void _toast(String message) => widget.state.showToast(message);

  Future<void> sendOtp() async {
    if (data.name.text.trim().isEmpty) {
      _toast('कृपया किसान का पूरा नाम दर्ज करें');
      return;
    }
    if (data.phone.text.trim().length < 10) {
      _toast('कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें');
      return;
    }
    setState(() => busy = true);
    await _phoneAuth.sendOtp(
      phone: '+91${data.phone.text.trim()}',
      onCodeSent: (verificationId) {
        _otpTimer?.cancel();
        setState(() {
          busy = false;
          data.otpSent = true;
          data.verificationId = verificationId;
          data.otpCountdown = 30;
        });
        _otpTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
          if (!mounted) return timer.cancel();
          setState(() {
            if (data.otpCountdown > 0) {
              data.otpCountdown--;
            } else {
              timer.cancel();
            }
          });
        });
      },
      onFailed: (message) {
        setState(() {
          busy = false;
          data.submitError = message;
        });
      },
      onAutoVerified: (idToken) {
        _otpTimer?.cancel();
        setState(() {
          busy = false;
          data.idToken = idToken;
          step = 2;
        });
      },
    );
  }

  Future<void> verifyOtp() async {
    final verificationId = data.verificationId;
    if (verificationId == null || data.otp.text.trim().length < 4) {
      _toast('कृपया सही OTP दर्ज करें');
      return;
    }
    setState(() => busy = true);
    final idToken = await _phoneAuth.verifyOtp(
      verificationId: verificationId,
      otp: data.otp.text.trim(),
    );
    if (!mounted) return;
    if (idToken == null) {
      setState(() {
        busy = false;
        data.submitError = 'अमान्य OTP — पुनः प्रयास करें';
      });
      return;
    }
    _otpTimer?.cancel();
    setState(() {
      busy = false;
      data.submitError = null;
      data.idToken = idToken;
      step = 2;
    });
  }

  void continueFromMpin() {
    final mpin = data.mpin.text.trim();
    final confirm = data.mpinConfirm.text.trim();
    if (mpin.length != 4 || confirm.length != 4) {
      _toast('कृपया 4 अंकों का MPIN दर्ज करें');
      return;
    }
    if (mpin != confirm) {
      _toast('❌ दोनों MPIN मेल नहीं खा रहे हैं। कृपया दोबारा जांचें।');
      return;
    }
    setState(() => step = 3);
  }

  bool _validateRoleSections() {
    var valid = true;
    for (final key in _profileKeys) {
      if (key == UserProfileType.farmer.name) continue;
      final formData =
          data.roleProfiles.putIfAbsent(key, RoleProfileFormData.new);
      final error = formData.validate(key);
      roleErrors[key] = error;
      if (error != null) valid = false;
    }
    return valid;
  }

  Future<void> finish() async {
    if (data.village.text.trim().isEmpty) {
      _toast('कृपया गांव का नाम दर्ज करें');
      return;
    }
    if (!_validateRoleSections()) {
      setState(() {});
      return;
    }
    final idToken = data.idToken;
    if (idToken == null) {
      _toast('मोबाइल सत्यापन अधूरा है — कृपया OTP सत्यापित करें');
      return;
    }
    final roleProfiles = <String, Map<String, dynamic>>{};
    for (final key in _profileKeys) {
      if (key == UserProfileType.farmer.name) continue;
      final formData = data.roleProfiles[key];
      if (formData != null) roleProfiles[key] = formData.toJson(key);
    }
    setState(() => busy = true);
    try {
      await widget.state.completeRegistration(
        idToken: idToken,
        name: data.name.text.trim(),
        phone: '+91${data.phone.text.trim()}',
        village: data.village.text.trim(),
        tehsil: data.tehsil.text.trim(),
        district: data.district.text.trim(),
        state: data.stateName,
        landAreaAcres: data.landAcres,
        soilType: data.soilType,
        irrigationType: data.irrigationType,
        crops: data.crops,
        mpin: data.mpin.text.trim(),
        referralCode: data.referralCode.text.trim().isEmpty
            ? null
            : data.referralCode.text.trim(),
        roleProfiles: roleProfiles.isEmpty ? null : roleProfiles,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'INVALID_REFERRAL_CODE') {
        setState(() {
          busy = false;
          step = 1;
          data.referralError = 'अमान्य रेफरल कोड';
        });
      } else {
        setState(() {
          busy = false;
          data.submitError = e.message.isEmpty ? e.code : e.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        RegisterProgressBar(step: step),
        const SizedBox(height: 12),
        Expanded(
          child: SingleChildScrollView(
            child: switch (step) {
              1 => RegisterStep1Identity(
                  data: data,
                  busy: busy,
                  onSendOtp: sendOtp,
                  onVerifyOtp: verifyOtp,
                  onChanged: () => setState(() {}),
                ),
              2 => RegisterStep2Security(
                  data: data,
                  busy: busy,
                  onContinue: continueFromMpin,
                  onChanged: () => setState(() {}),
                ),
              _ => RegisterStep3Details(
                  data: data,
                  busy: busy,
                  profileKeys: _profileKeys,
                  roleErrors: roleErrors,
                  onFinish: finish,
                  onChanged: () => setState(() {}),
                ),
            },
          ),
        ),
      ],
    );
  }
}
