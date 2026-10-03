import 'package:flutter/material.dart';

import '../../components/onboarding/field_widgets.dart';
import '../../components/onboarding/role_profile_form.dart';
import '../../models/user_profile_type.dart';
import '../../state/app_state.dart';
import 'register_form_data.dart';

// Register step 3 — "profile building wizard": one page per selected persona
// (farmer farm details first, then each non-farmer role form) with a
// sub-progress indicator, per-page validation and Back/Continue navigation.
class RegisterStep3Details extends StatefulWidget {
  const RegisterStep3Details({
    super.key,
    required this.data,
    this.state,
    required this.busy,
    required this.profileKeys,
    required this.roleErrors,
    required this.onFinish,
    required this.onBack,
    required this.onChanged,
  });

  final RegisterFormData data;
  final AppState? state;
  final bool busy;
  final List<String> profileKeys;
  final Map<String, String?> roleErrors;
  final VoidCallback onFinish;
  final VoidCallback onBack;
  final VoidCallback onChanged;

  @override
  State<RegisterStep3Details> createState() => _RegisterStep3DetailsState();
}

class _RegisterStep3DetailsState extends State<RegisterStep3Details> {
  int page = 0;

  bool get _hasFarmer =>
      widget.profileKeys.contains(UserProfileType.farmer.name);

  List<String> get _roleKeys => [
        for (final k in widget.profileKeys)
          if (k != UserProfileType.farmer.name) k,
      ];

  int get _totalPages => (_hasFarmer ? 1 : 0) + _roleKeys.length;

  bool get _isFarmerPage => _hasFarmer && page == 0;

  String get _currentRoleKey =>
      _roleKeys[page - (_hasFarmer ? 1 : 0)];

  void _next() {
    if (_isFarmerPage) {
      if (widget.data.village.text.trim().isEmpty) {
        widget.state?.showToast(
            widget.state?.tr('enterVillagePrompt') ?? 'गांव का नाम दर्ज करें');
        return;
      }
    } else {
      final key = _currentRoleKey;
      final formData =
          widget.data.roleProfiles.putIfAbsent(key, RoleProfileFormData.new);
      final error =
          formData.validate(key, widget.state?.language ?? 'hi');
      widget.roleErrors[key] = error;
      if (error != null) {
        setState(() {});
        return;
      }
    }
    if (page < _totalPages - 1) {
      setState(() => page++);
      widget.onChanged();
    } else {
      widget.onFinish();
    }
  }

  void _back() {
    if (page > 0) {
      setState(() => page--);
      widget.onChanged();
    } else {
      widget.onBack();
    }
  }

  String _pageTitle() {
    if (_isFarmerPage) {
      return widget.state?.tr('farmDetails') ?? 'खेत का विवरण';
    }
    final meta = UserProfileRegistry.meta(
        UserProfileType.values.firstWhere((t) => t.name == _currentRoleKey));
    final roleName = widget.state != null
        ? meta.label(widget.state!.language)
        : meta.labelHi;
    return '${widget.state?.tr('profileBuilding') ?? 'Profile Setup'} — $roleName';
  }

  @override
  Widget build(BuildContext context) {
    final isLast = page == _totalPages - 1;
    final total = _totalPages;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (total > 1) _buildPageIndicator(total),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: KeyedSubtree(
            key: ValueKey<String>('register_page_$page'),
            child: _isFarmerPage ? _buildFarmerPage() : _buildRolePage(),
          ),
        ),
        if (widget.data.submitError != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(
              widget.data.submitError!,
              style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
            ),
          ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: widget.busy ? null : _back,
                icon: const Icon(Icons.arrow_back_rounded, size: 16),
                label: Text(widget.state?.tr('back') ?? 'पीछे'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: widget.busy ? null : _next,
                child: Text(
                  isLast
                      ? (widget.state?.tr('completeRegistration') ??
                          'पंजीकरण पूरा करें')
                      : (widget.state?.tr('continueBtn') ?? 'Continue →'),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPageIndicator(int total) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              for (var i = 0; i < total; i++)
                Expanded(
                  child: Container(
                    height: 4,
                    margin: EdgeInsets.only(right: i < total - 1 ? 5 : 0),
                    decoration: BoxDecoration(
                      color: i <= page
                          ? const Color(0xFF2E7D32)
                          : const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${_pageTitle()}  •  ${page + 1}/$total',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              color: Color(0xFF2E7D32),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFarmerPage() {
    final acresLabel = widget.state?.tr('acresUnit') ?? 'एकड़';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          widget.state?.tr('farmDetails') ?? 'खेत का विवरण',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 12),
        LabeledTextField(
          controller: widget.data.village,
          label: widget.state?.tr('village') ?? 'गांव',
        ),
        const SizedBox(height: 10),
        LabeledTextField(
          controller: widget.data.tehsil,
          label: widget.state?.tr('tehsil') ?? 'तहसील',
        ),
        const SizedBox(height: 10),
        LabeledTextField(
          controller: widget.data.district,
          label: widget.state?.tr('district') ?? 'जिला',
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: Slider(
                value: widget.data.landAcres,
                min: 0.5,
                max: 25,
                divisions: 49,
                label: '${widget.data.landAcres.toStringAsFixed(1)} $acresLabel',
                onChanged: (v) {
                  widget.data.landAcres = v;
                  widget.onChanged();
                },
              ),
            ),
            Text(
              '${widget.data.landAcres.toStringAsFixed(1)} $acresLabel',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          widget.state?.tr('soilType') ?? 'मिट्टी का प्रकार',
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
        ),
        const SizedBox(height: 6),
        ChipSelector(
          options: RegisterFormData.soilTypes,
          selected: widget.data.soilType,
          onSelected: (v) {
            widget.data.soilType = v;
            widget.onChanged();
          },
        ),
        const SizedBox(height: 10),
        Text(
          widget.state?.tr('irrigationType') ?? 'सिंचाई का प्रकार',
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
        ),
        const SizedBox(height: 6),
        ChipSelector(
          options: RegisterFormData.irrigationTypes,
          selected: widget.data.irrigationType,
          onSelected: (v) {
            widget.data.irrigationType = v;
            widget.onChanged();
          },
        ),
        const SizedBox(height: 10),
        Text(
          widget.state?.tr('crops') ?? 'फसलें',
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
        ),
        const SizedBox(height: 6),
        CropSelectorField(
          options: RegisterFormData.cropOptions,
          selected: widget.data.crops,
          onChanged: (v) {
            widget.data.crops = v;
            widget.onChanged();
          },
          addLabel: widget.state?.tr('onboarding.addCrop') ?? 'अन्य फसल जोड़ें',
          addHint: widget.state?.tr('onboarding.cropNameHint') ?? 'फसल का नाम लिखें',
        ),
      ],
    );
  }

  Widget _buildRolePage() {
    final key = _currentRoleKey;
    final type = UserProfileType.values.firstWhere((t) => t.name == key);
    final meta = UserProfileRegistry.meta(type);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: meta.primaryColor.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: meta.primaryColor.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: meta.primaryColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(meta.icon, color: Colors.white, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${meta.label(widget.state?.language ?? 'hi')} (${meta.labelEn}) — '
                  '${widget.state?.tr('profileBuilding') ?? 'Profile Setup'}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: meta.primaryColor,
                  ),
                ),
              ),
            ],
          ),
        ),
        RoleProfileForm(
          profileType: key,
          data: widget.data.roleProfiles.putIfAbsent(
            key,
            RoleProfileFormData.new,
          ),
          errorText: widget.roleErrors[key],
          onChanged: widget.onChanged,
          state: widget.state,
        ),
      ],
    );
  }
}
