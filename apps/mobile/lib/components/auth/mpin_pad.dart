import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../data/translations.dart';
import '../../state/app_state.dart';

class MpinPad extends StatelessWidget {
  const MpinPad({
    super.key,
    required this.controller,
    this.label,
    this.state,
    this.errorText,
    this.onChanged,
  });

  final TextEditingController controller;
  final String? label;
  final AppState? state;
  final String? errorText;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      obscureText: true,
      maxLength: 4,
      textAlign: TextAlign.center,
      style: const TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w800,
        letterSpacing: 12,
      ),
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: label ??
            AppTranslations.get(
                'common.fourDigitMpin', state?.language ?? 'hi'),
        counterText: '',
        errorText: errorText,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}
