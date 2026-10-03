// Overall onboarding journey progress: Language → Profiles → Register → Farm.
// Rendered at the top of every onboarding screen so the user always knows
// where they are in the flow.

import 'package:flutter/material.dart';
import '../../state/app_state.dart';

class OnboardingFlowProgress extends StatelessWidget {
  const OnboardingFlowProgress({
    super.key,
    required this.state,
    required this.currentStep,
  });

  final AppState state;
  final int currentStep; // 1 = language, 2 = profiles, 3 = register, 4 = farm map

  static const List<String> _stepLabelKeys = [
    'flowStepLanguage',
    'flowStepProfiles',
    'flowStepRegister',
    'flowStepFarm',
  ];

  @override
  Widget build(BuildContext context) {
    final labelKey = _stepLabelKeys[currentStep.clamp(1, 4) - 1];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (var i = 1; i <= 4; i++)
              Expanded(
                child: Container(
                  height: 6,
                  margin: EdgeInsets.only(right: i < 4 ? 6 : 0),
                  decoration: BoxDecoration(
                    color: i <= currentStep
                        ? const Color(0xFF43A047)
                        : const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          '${state.tr('stepShort')} $currentStep / 4 • ${state.tr(labelKey)}',
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
            color: Color(0xFF64748B),
          ),
        ),
      ],
    );
  }
}
