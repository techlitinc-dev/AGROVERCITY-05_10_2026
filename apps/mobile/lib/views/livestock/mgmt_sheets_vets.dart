// Vet network sheets: managed-vet onboard/edit, vaccination campaign create.

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/vet_api.dart';
import '../../models/livestock_mgmt_models.dart';
import '../../state/app_state.dart';
import 'mgmt_widgets.dart';

void _errorSnack(BuildContext context, ApiException e) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(e.message.isNotEmpty ? e.message : e.code)),
  );
}

// ---------------------------------------------------------------------------
// Managed vet onboard / edit (dairyManager directory)
// ---------------------------------------------------------------------------

class VetOnboardSheet extends StatefulWidget {
  final AppState state;
  final VetApi api;
  final ManagedVet? existing;
  final VoidCallback? onSaved;

  const VetOnboardSheet({
    super.key,
    required this.state,
    required this.api,
    this.existing,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required VetApi api,
    ManagedVet? existing,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        VetOnboardSheet(
          state: state,
          api: api,
          existing: existing,
          onSaved: onSaved,
        ),
      );

  @override
  State<VetOnboardSheet> createState() => _VetOnboardSheetState();
}

class _VetOnboardSheetState extends State<VetOnboardSheet> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _regNo = TextEditingController();
  final _qualification = TextEditingController();
  final _specializations = TextEditingController();
  final _clinicAddress = TextEditingController();
  final _districts = TextEditingController();
  final _feeClinic = TextEditingController(text: '0');
  final _feeFarm = TextEditingController(text: '0');
  final _feeTele = TextEditingController(text: '0');
  final _languages = TextEditingController();
  final List<String> _visitTypes = ['clinic'];
  late bool _emergency = false;
  late bool _farmVisit = true;
  bool _saving = false;

  AppState get s => widget.state;

  static const _allVisitTypes = ['clinic', 'farm', 'tele'];

  @override
  void initState() {
    super.initState();
    final v = widget.existing;
    if (v != null) {
      _name.text = v.name;
      _phone.text = v.phone;
      _regNo.text = v.vetCouncilRegNo;
      _qualification.text = v.qualification;
      _specializations.text = v.specializations.join(', ');
      _clinicAddress.text = v.clinicAddress;
      _districts.text = v.serviceDistricts.join(', ');
      _feeClinic.text = v.feeClinic.toString();
      _feeFarm.text = v.feeFarm.toString();
      _feeTele.text = v.feeTele.toString();
      _languages.text = v.languages.join(', ');
      _visitTypes
        ..clear()
        ..addAll(v.visitTypes.isEmpty ? ['clinic'] : v.visitTypes);
      _emergency = v.emergencyAvailable;
      _farmVisit = v.availableForFarmVisit;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _regNo.dispose();
    _qualification.dispose();
    _specializations.dispose();
    _clinicAddress.dispose();
    _districts.dispose();
    _feeClinic.dispose();
    _feeFarm.dispose();
    _feeTele.dispose();
    _languages.dispose();
    super.dispose();
  }

  List<String> _csv(String raw) => raw
      .split(',')
      .map((e) => e.trim())
      .where((e) => e.isNotEmpty)
      .toList();

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty || _phone.text.trim().length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.tr('livestock.mgmt.errFillRequired'))),
      );
      return;
    }
    setState(() => _saving = true);
    int num(TextEditingController c) => int.tryParse(c.text.trim()) ?? 0;
    try {
      final body = <String, dynamic>{
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'qualification': _qualification.text.trim(),
        'specializations': _csv(_specializations.text),
        'clinicAddress': _clinicAddress.text.trim(),
        'experienceYears': 0,
        'feeClinic': num(_feeClinic),
        'feeFarm': num(_feeFarm),
        'feeTele': num(_feeTele),
        'visitTypes': _visitTypes,
        'serviceDistricts': _csv(_districts.text),
        'languages': _csv(_languages.text),
        'vetCouncilRegNo': _regNo.text.trim(),
        'emergencyAvailable': _emergency,
        'availableForFarmVisit': _farmVisit,
      };
      final existing = widget.existing;
      if (existing == null) {
        await widget.api.createManagedVet(body);
      } else {
        await widget.api.updateManagedVet(existing.id, body);
      }
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onSaved?.call();
    } on ApiException catch (e) {
      if (mounted) _errorSnack(context, e);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final existing = widget.existing;
    return MgmtSheetFrame(
      state: s,
      icon: Icons.medical_services_rounded,
      iconColor: const Color(0xFF0284C7),
      title: s.tr(existing == null
          ? 'livestock.vets.onboardNew'
          : 'livestock.vets.onboardEdit'),
      subtitle: s.tr('livestock.vets.onboardSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr(existing == null ? 'livestock.mgmt.save' : 'livestock.mgmt.saveChanges'),
        saving: _saving,
        color: const Color(0xFF0284C7),
        onPressed: _submit,
      ),
      children: [
        MgmtField(
          controller: _name,
          label: s.tr('livestock.mgmt.fullName'),
          icon: Icons.person_outline,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _phone,
                label: s.tr('livestock.mgmt.phone'),
                keyboardType: TextInputType.phone,
                icon: Icons.phone_outlined,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _regNo,
                label: s.tr('livestock.vets.regNo'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _qualification,
          label: s.tr('livestock.vets.qualification'),
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _specializations,
          label: s.tr('livestock.vets.specializations'),
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _clinicAddress,
          label: s.tr('livestock.vets.clinicAddress'),
          icon: Icons.location_on_outlined,
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _districts,
          label: s.tr('livestock.vets.serviceDistricts'),
        ),
        const SizedBox(height: 14),
        Text(
          s.tr('livestock.vets.fees'),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _feeClinic,
                label: s.tr('livestock.vets.feeClinic'),
                keyboardType: TextInputType.number,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _feeFarm,
                label: s.tr('livestock.vets.feeFarm'),
                keyboardType: TextInputType.number,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _feeTele,
                label: s.tr('livestock.vets.feeTele'),
                keyboardType: TextInputType.number,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Text(
          s.tr('livestock.vets.visitTypes'),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _allVisitTypes
              .map(
                (t) => FilterChip(
                  label: Text(
                    s.tr('livestock.vets.visitType.$t'),
                    style: const TextStyle(fontSize: 12.5),
                  ),
                  selected: _visitTypes.contains(t),
                  onSelected: (sel) => setState(() {
                    if (sel) {
                      _visitTypes.add(t);
                    } else {
                      _visitTypes.remove(t);
                    }
                  }),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _languages,
          label: s.tr('livestock.vets.languages'),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          dense: true,
          title: Text(s.tr('livestock.vets.emergency')),
          value: _emergency,
          onChanged: (v) => setState(() => _emergency = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          dense: true,
          title: Text(s.tr('livestock.vets.farmVisitToggle')),
          value: _farmVisit,
          onChanged: (v) => setState(() => _farmVisit = v),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Vaccination campaign create
// ---------------------------------------------------------------------------

class CampaignCreateSheet extends StatefulWidget {
  final AppState state;
  final VetApi api;
  final VoidCallback? onSaved;

  const CampaignCreateSheet({
    super.key,
    required this.state,
    required this.api,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required VetApi api,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        CampaignCreateSheet(state: state, api: api, onSaved: onSaved),
      );

  @override
  State<CampaignCreateSheet> createState() => _CampaignCreateSheetState();
}

class _CampaignCreateSheetState extends State<CampaignCreateSheet> {
  final _title = TextEditingController();
  final _vaccine = TextEditingController();
  final _disease = TextEditingController();
  final _districts = TextEditingController();
  late String _fromDate = _today();
  late String _toDate = _today();
  String _status = 'upcoming';
  bool _saving = false;

  AppState get s => widget.state;

  static String _today() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _title.dispose();
    _vaccine.dispose();
    _disease.dispose();
    _districts.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_title.text.trim().isEmpty || _vaccine.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.tr('livestock.mgmt.errFillRequired'))),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.api.createCampaign({
        'title': _title.text.trim(),
        'vaccine': _vaccine.text.trim(),
        'disease': _disease.text.trim(),
        'fromDate': _fromDate,
        'toDate': _toDate,
        'targetDistricts': _districts.text
            .split(',')
            .map((e) => e.trim())
            .where((e) => e.isNotEmpty)
            .toList(),
        'status': _status,
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onSaved?.call();
    } on ApiException catch (e) {
      if (mounted) _errorSnack(context, e);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MgmtSheetFrame(
      state: s,
      icon: Icons.vaccines_rounded,
      iconColor: const Color(0xFF00838F),
      title: s.tr('livestock.vets.campaignNew'),
      subtitle: s.tr('livestock.vets.campaignSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr('livestock.mgmt.save'),
        saving: _saving,
        color: const Color(0xFF00838F),
        onPressed: _submit,
      ),
      children: [
        MgmtField(
          controller: _title,
          label: s.tr('livestock.vets.campaignTitle'),
          icon: Icons.campaign_outlined,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _vaccine,
                label: s.tr('livestock.vets.campaignVaccine'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _disease,
                label: s.tr('livestock.vets.campaignDisease'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        MgmtDateField(
          label: s.tr('livestock.vets.campaignFrom'),
          initialDate: DateTime.now(),
          onPicked: (v) => _fromDate = v,
        ),
        const SizedBox(height: 12),
        MgmtDateField(
          label: s.tr('livestock.vets.campaignTo'),
          initialDate: DateTime.now(),
          onPicked: (v) => _toDate = v,
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _districts,
          label: s.tr('livestock.vets.campaignDistricts'),
        ),
        const SizedBox(height: 14),
        Text(
          s.tr('livestock.mgmt.status'),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        MgmtChipSelect(
          options: [
            s.tr('livestock.vets.campaignStatus.upcoming'),
            s.tr('livestock.vets.campaignStatus.active'),
            s.tr('livestock.vets.campaignStatus.closed'),
          ],
          selected: s.tr('livestock.vets.campaignStatus.$_status'),
          onChanged: (v) => setState(() {
            for (final st in ['upcoming', 'active', 'closed']) {
              if (v == s.tr('livestock.vets.campaignStatus.$st')) _status = st;
            }
          }),
        ),
      ],
    );
  }
}
