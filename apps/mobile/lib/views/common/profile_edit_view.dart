import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../components/onboarding/field_widgets.dart';
import '../../state/app_state.dart';
import '../onboarding/register_form_data.dart';

class ProfileEditView extends StatefulWidget {
  const ProfileEditView({super.key, required this.state});

  final AppState state;

  @override
  State<ProfileEditView> createState() => _ProfileEditViewState();
}

class _ProfileEditViewState extends State<ProfileEditView> {
  late final Map<String, dynamic> _user =
      widget.state.currentUser ?? <String, dynamic>{};
  late final _name = TextEditingController(text: _user['name'] as String?);
  late final _village =
      TextEditingController(text: _user['village'] as String?);
  late final _tehsil = TextEditingController(text: _user['tehsil'] as String?);
  late String _soilType = (_user['soilType'] as String?).orDefault(
    RegisterFormData.soilTypes.first,
  );
  late String _irrigationType = (_user['irrigationType'] as String?).orDefault(
    RegisterFormData.irrigationTypes.first,
  );
  late double _landAcres =
      (_user['landAreaAcres'] as num?)?.toDouble() ?? 3.5;
  late List<String> _crops =
      List<String>.from(_user['activeCrops'] as List? ?? const []);
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _village.dispose();
    _tehsil.dispose();
    super.dispose();
  }

  Map<String, dynamic> _changedFields() {
    final changed = <String, dynamic>{};
    void compare(String key, dynamic value, dynamic original) {
      if (value != original) changed[key] = value;
    }

    compare('name', _name.text.trim(), _user['name'] ?? '');
    compare('village', _village.text.trim(), _user['village'] ?? '');
    compare('tehsil', _tehsil.text.trim(), _user['tehsil'] ?? '');
    compare('soilType', _soilType, _user['soilType']);
    compare('irrigationType', _irrigationType, _user['irrigationType']);
    compare('landAreaAcres', _landAcres,
        (_user['landAreaAcres'] as num?)?.toDouble());
    final originalCrops = List<String>.from(_user['activeCrops'] as List? ?? []);
    if (_crops.join('|') != originalCrops.join('|')) {
      changed['activeCrops'] = _crops;
    }
    return changed;
  }

  Future<void> _save() async {
    final changed = _changedFields();
    if (changed.isEmpty) {
      widget.state.navigateBack();
      return;
    }
    setState(() => _busy = true);
    try {
      await widget.state.updateCurrentUser(changed);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        widget.state.showToast(e.message.isEmpty ? e.code : e.message);
      }
      return;
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('प्रोफ़ाइल अपडेट हुई')),
    );
    widget.state.navigateBack();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 12, 20, 0),
              child: Row(
                children: [
                  IconButton(
                    onPressed: widget.state.navigateBack,
                    icon: const Icon(Icons.arrow_back_rounded),
                  ),
                  const Text(
                    'प्रोफ़ाइल संपादित करें',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    LabeledTextField(controller: _name, label: 'पूरा नाम'),
                    const SizedBox(height: 10),
                    LabeledTextField(controller: _village, label: 'गांव'),
                    const SizedBox(height: 10),
                    LabeledTextField(controller: _tehsil, label: 'तहसील'),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: Slider(
                            value: _landAcres,
                            min: 0.5,
                            max: 25,
                            divisions: 49,
                            label:
                                '${_landAcres.toStringAsFixed(1)} एकड़',
                            onChanged: (v) => setState(() => _landAcres = v),
                          ),
                        ),
                        Text(
                          '${_landAcres.toStringAsFixed(1)} एकड़',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text('मिट्टी का प्रकार',
                        style: TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 13)),
                    const SizedBox(height: 6),
                    ChipSelector(
                      options: RegisterFormData.soilTypes,
                      selected: _soilType,
                      onSelected: (v) => setState(() => _soilType = v),
                    ),
                    const SizedBox(height: 10),
                    const Text('सिंचाई का प्रकार',
                        style: TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 13)),
                    const SizedBox(height: 6),
                    ChipSelector(
                      options: RegisterFormData.irrigationTypes,
                      selected: _irrigationType,
                      onSelected: (v) =>
                          setState(() => _irrigationType = v),
                    ),
                    const SizedBox(height: 10),
                    const Text('फसलें',
                        style: TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 13)),
                    const SizedBox(height: 6),
                    CropSelectorField(
                      options: RegisterFormData.cropOptions,
                      selected: _crops,
                      onChanged: (v) => setState(() => _crops = v),
                    ),
                    const SizedBox(height: 18),
                    FilledButton(
                      onPressed: _busy ? null : _save,
                      child: const Text('सहेजें'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

extension on String? {
  String orDefault(String fallback) {
    final v = this;
    return (v == null || v.isEmpty) ? fallback : v;
  }
}
