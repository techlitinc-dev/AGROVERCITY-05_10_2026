import 'package:flutter/material.dart';

import '../../components/onboarding/field_widgets.dart';
import '../../components/onboarding/role_profile_form.dart';
import '../../models/user_profile_type.dart';
import 'register_form_data.dart';

class RegisterStep3Details extends StatelessWidget {
  const RegisterStep3Details({
    super.key,
    required this.data,
    required this.busy,
    required this.profileKeys,
    required this.roleErrors,
    required this.onFinish,
    required this.onChanged,
  });

  final RegisterFormData data;
  final bool busy;
  final List<String> profileKeys;
  final Map<String, String?> roleErrors;
  final VoidCallback onFinish;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final isFarmer = profileKeys.contains(UserProfileType.farmer.name);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (isFarmer) ...[
          const Text(
            'खेत का विवरण',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          LabeledTextField(controller: data.village, label: 'गांव'),
          const SizedBox(height: 10),
          LabeledTextField(controller: data.tehsil, label: 'तहसील'),
          const SizedBox(height: 10),
          LabeledTextField(controller: data.district, label: 'जिला'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Slider(
                  value: data.landAcres,
                  min: 0.5,
                  max: 25,
                  divisions: 49,
                  label: '${data.landAcres.toStringAsFixed(1)} एकड़',
                  onChanged: (v) {
                    data.landAcres = v;
                    onChanged();
                  },
                ),
              ),
              Text(
                '${data.landAcres.toStringAsFixed(1)} एकड़',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text('मिट्टी का प्रकार',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          const SizedBox(height: 6),
          ChipSelector(
            options: RegisterFormData.soilTypes,
            selected: data.soilType,
            onSelected: (v) {
              data.soilType = v;
              onChanged();
            },
          ),
          const SizedBox(height: 10),
          const Text('सिंचाई का प्रकार',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          const SizedBox(height: 6),
          ChipSelector(
            options: RegisterFormData.irrigationTypes,
            selected: data.irrigationType,
            onSelected: (v) {
              data.irrigationType = v;
              onChanged();
            },
          ),
          const SizedBox(height: 10),
          const Text('फसलें',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          const SizedBox(height: 6),
          CropSelectorField(
            options: RegisterFormData.cropOptions,
            selected: data.crops,
            onChanged: (v) {
              data.crops = v;
              onChanged();
            },
          ),
          const SizedBox(height: 14),
        ],
        for (final key in profileKeys)
          if (key != UserProfileType.farmer.name)
            RoleProfileForm(
              profileType: key,
              data: data.roleProfiles.putIfAbsent(
                key,
                RoleProfileFormData.new,
              ),
              errorText: roleErrors[key],
              onChanged: onChanged,
            ),
        if (data.submitError != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(
              data.submitError!,
              style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
            ),
          ),
        FilledButton(
          onPressed: busy ? null : onFinish,
          child: const Text('पंजीकरण पूरा करें'),
        ),
      ],
    );
  }
}
