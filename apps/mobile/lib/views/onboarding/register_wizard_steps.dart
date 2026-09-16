import 'package:flutter/material.dart';

import '../../components/auth/mpin_pad.dart';
import '../../components/onboarding/field_widgets.dart';
import 'register_form_data.dart';

class RegisterProgressBar extends StatelessWidget {
  const RegisterProgressBar({super.key, required this.step});

  final int step;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 1; i <= 3; i++)
          Expanded(
            child: Container(
              height: 5,
              margin: EdgeInsets.only(right: i < 3 ? 6 : 0),
              decoration: BoxDecoration(
                color: i <= step
                    ? const Color(0xFF43A047)
                    : const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
      ],
    );
  }
}

class RegisterStep1Identity extends StatelessWidget {
  const RegisterStep1Identity({
    super.key,
    required this.data,
    required this.busy,
    required this.onSendOtp,
    required this.onVerifyOtp,
    required this.onChanged,
  });

  final RegisterFormData data;
  final bool busy;
  final VoidCallback onSendOtp;
  final VoidCallback onVerifyOtp;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'पहचान और संपर्क',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 12),
        LabeledTextField(controller: data.name, label: 'पूरा नाम'),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: data.stateName,
          decoration: InputDecoration(
            labelText: 'राज्य',
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          items: [
            for (final s in RegisterFormData.states)
              DropdownMenuItem(value: s, child: Text(s)),
          ],
          onChanged: (v) {
            data.stateName = v ?? data.stateName;
            onChanged();
          },
        ),
        const SizedBox(height: 10),
        LabeledTextField(
          controller: data.phone,
          label: 'मोबाइल नंबर',
          keyboardType: TextInputType.phone,
          prefix: '+91 ',
        ),
        if (data.otpSent) ...[
          const SizedBox(height: 10),
          LabeledTextField(
            controller: data.otp,
            label: 'OTP',
            keyboardType: TextInputType.number,
          ),
          if (data.otpCountdown > 0)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'पुनः भेजें ${data.otpCountdown}s में',
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
            ),
        ],
        const SizedBox(height: 10),
        LabeledTextField(
          controller: data.referralCode,
          label: 'रेफरल कोड (वैकल्पिक)',
          errorText: data.referralError,
        ),
        if (data.submitError != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              data.submitError!,
              style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
            ),
          ),
        const SizedBox(height: 14),
        FilledButton(
          onPressed: busy ? null : (data.otpSent ? onVerifyOtp : onSendOtp),
          child: Text(data.otpSent ? 'सत्यापित करें' : 'OTP भेजें'),
        ),
      ],
    );
  }
}

class RegisterStep2Security extends StatelessWidget {
  const RegisterStep2Security({
    super.key,
    required this.data,
    required this.busy,
    required this.onContinue,
    required this.onChanged,
  });

  final RegisterFormData data;
  final bool busy;
  final VoidCallback onContinue;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final mpin = data.mpin.text;
    final confirm = data.mpinConfirm.text;
    final showMatch = mpin.length == 4 && confirm.length == 4;
    final matched = showMatch && mpin == confirm;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'सुरक्षा — MPIN सेट करें',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 12),
        MpinPad(
          controller: data.mpin,
          label: '4-अंकीय MPIN',
          onChanged: (_) => onChanged(),
        ),
        const SizedBox(height: 10),
        MpinPad(
          controller: data.mpinConfirm,
          label: 'MPIN दोबारा दर्ज करें',
          onChanged: (_) => onChanged(),
        ),
        if (showMatch)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              matched ? '✅ MPIN मेल खा गया' : '❌ MPIN मेल नहीं खा रहा',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: matched
                    ? const Color(0xFF2E7D32)
                    : const Color(0xFFDC2626),
              ),
            ),
          ),
        const SizedBox(height: 14),
        FilledButton(
          onPressed: busy ? null : onContinue,
          child: const Text('आगे बढ़ें'),
        ),
      ],
    );
  }
}
