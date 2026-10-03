// Dairy console sheets: member, rate chart, payment batch, sale customer,
// sale order, stock item, stock adjustment.

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/livestock_mgmt_api.dart';
import '../../models/livestock_mgmt_models.dart';
import '../../state/app_state.dart';
import 'mgmt_widgets.dart';

void _errorSnack(BuildContext context, ApiException e) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(e.message.isNotEmpty ? e.message : e.code)),
  );
}

// ---------------------------------------------------------------------------
// Member create / edit
// ---------------------------------------------------------------------------

class MemberEditSheet extends StatefulWidget {
  final AppState state;
  final DairyMgmtApi api;
  final DairyMember? existing;
  final VoidCallback? onSaved;

  const MemberEditSheet({
    super.key,
    required this.state,
    required this.api,
    this.existing,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required DairyMgmtApi api,
    DairyMember? existing,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        MemberEditSheet(
          state: state,
          api: api,
          existing: existing,
          onSaved: onSaved,
        ),
      );

  @override
  State<MemberEditSheet> createState() => _MemberEditSheetState();
}

class _MemberEditSheetState extends State<MemberEditSheet> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _village = TextEditingController();
  final _memberCode = TextEditingController();
  final _farmerUid = TextEditingController();
  final _bankName = TextEditingController();
  final _bankAccount = TextEditingController();
  final _bankIfsc = TextEditingController();
  final _deduction = TextEditingController(text: '0');
  String _species = 'cow';
  String _status = 'active';
  bool _saving = false;

  AppState get s => widget.state;

  @override
  void initState() {
    super.initState();
    final m = widget.existing;
    if (m != null) {
      _name.text = m.name;
      _phone.text = m.phone;
      _village.text = m.village;
      _memberCode.text = m.memberCode;
      _farmerUid.text = m.farmerUid;
      _bankName.text = (m.bankDetails['bankName'] ?? '') as String;
      _bankAccount.text = (m.bankDetails['accountNumber'] ?? '') as String;
      _bankIfsc.text = (m.bankDetails['ifsc'] ?? '') as String;
      _deduction.text = m.deduction.toString();
      _species = m.defaultSpecies;
      _status = m.status;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _village.dispose();
    _memberCode.dispose();
    _farmerUid.dispose();
    _bankName.dispose();
    _bankAccount.dispose();
    _bankIfsc.dispose();
    _deduction.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.tr('livestock.mgmt.errFillRequired'))),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{
        'name': name,
        'phone': _phone.text.trim(),
        'village': _village.text.trim(),
        'farmerUid': _farmerUid.text.trim(),
        'memberCode': _memberCode.text.trim(),
        'bankDetails': {
          if (_bankName.text.trim().isNotEmpty) 'bankName': _bankName.text.trim(),
          if (_bankAccount.text.trim().isNotEmpty)
            'accountNumber': _bankAccount.text.trim(),
          if (_bankIfsc.text.trim().isNotEmpty) 'ifsc': _bankIfsc.text.trim(),
        },
        'defaultSpecies': _species,
        'deduction': double.tryParse(_deduction.text.trim()) ?? 0.0,
        'status': _status,
      };
      final existing = widget.existing;
      if (existing == null) {
        await widget.api.createMember(body);
      } else {
        await widget.api.updateMember(existing.id, body);
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
      icon: Icons.badge_outlined,
      iconColor: const Color(0xFF0288D1),
      title: s.tr(existing == null
          ? 'livestock.mgmt.memberNew'
          : 'livestock.mgmt.memberEdit'),
      subtitle: s.tr('livestock.mgmt.memberSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr(existing == null ? 'livestock.mgmt.save' : 'livestock.mgmt.saveChanges'),
        saving: _saving,
        color: const Color(0xFF0288D1),
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
                controller: _village,
                label: s.tr('livestock.mgmt.village'),
                icon: Icons.location_on_outlined,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _memberCode,
                label: s.tr('livestock.mgmt.memberCode'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _farmerUid,
                label: s.tr('livestock.mgmt.farmerUid'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _bankName,
                label: s.tr('livestock.mgmt.bankName'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _bankAccount,
                label: s.tr('livestock.mgmt.bankAccount'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _bankIfsc,
          label: s.tr('livestock.mgmt.bankIfsc'),
        ),
        const SizedBox(height: 14),
        Text(
          s.tr('livestock.mgmt.defaultSpecies'),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        MgmtChipSelect(
          options: [
            s.tr('livestock.mgmt.speciesCow'),
            s.tr('livestock.mgmt.speciesBuffalo'),
          ],
          selected: _species == 'cow'
              ? s.tr('livestock.mgmt.speciesCow')
              : s.tr('livestock.mgmt.speciesBuffalo'),
          onChanged: (v) => setState(() =>
              _species = v == s.tr('livestock.mgmt.speciesCow') ? 'cow' : 'buffalo'),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _deduction,
                label: s.tr('livestock.mgmt.deduction'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  s.tr('livestock.mgmt.status'),
                  style:
                      const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                MgmtChipSelect(
                  options: [
                    s.tr('livestock.mgmt.statusActive'),
                    s.tr('livestock.mgmt.statusInactive'),
                  ],
                  selected: _status == 'active'
                      ? s.tr('livestock.mgmt.statusActive')
                      : s.tr('livestock.mgmt.statusInactive'),
                  onChanged: (v) => setState(() => _status =
                      v == s.tr('livestock.mgmt.statusActive')
                          ? 'active'
                          : 'inactive'),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Rate chart create / edit
// ---------------------------------------------------------------------------

class RateChartSheet extends StatefulWidget {
  final AppState state;
  final DairyMgmtApi api;
  final RateChart? existing;
  final VoidCallback? onSaved;

  const RateChartSheet({
    super.key,
    required this.state,
    required this.api,
    this.existing,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required DairyMgmtApi api,
    RateChart? existing,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        RateChartSheet(
          state: state,
          api: api,
          existing: existing,
          onSaved: onSaved,
        ),
      );

  @override
  State<RateChartSheet> createState() => _RateChartSheetState();
}

class _RateChartSheetState extends State<RateChartSheet> {
  late String _species = widget.existing?.species ?? 'cow';
  late String _effectiveFrom =
      widget.existing?.effectiveFrom.isNotEmpty == true
          ? widget.existing!.effectiveFrom
          : _today();
  late bool _active = widget.existing?.active ?? false;

  final _baseRate = TextEditingController();
  final _fatBase = TextEditingController();
  final _snfBase = TextEditingController();
  final _fatStep = TextEditingController(text: '1.0');
  final _snfStep = TextEditingController(text: '1.0');
  final _minRate = TextEditingController(text: '0');
  final _minFat = TextEditingController(text: '0');
  final _minSnf = TextEditingController(text: '0');
  bool _saving = false;

  AppState get s => widget.state;

  static String _today() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  void initState() {
    super.initState();
    final c = widget.existing;
    if (c != null) {
      _baseRate.text = c.baseRate.toString();
      _fatBase.text = c.fatBase.toString();
      _snfBase.text = c.snfBase.toString();
      _fatStep.text = c.fatStep.toString();
      _snfStep.text = c.snfStep.toString();
      _minRate.text = c.minRate.toString();
      _minFat.text = c.minFat.toString();
      _minSnf.text = c.minSnf.toString();
    }
  }

  @override
  void dispose() {
    _baseRate.dispose();
    _fatBase.dispose();
    _snfBase.dispose();
    _fatStep.dispose();
    _snfStep.dispose();
    _minRate.dispose();
    _minFat.dispose();
    _minSnf.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final baseRate = double.tryParse(_baseRate.text.trim()) ?? 0;
    final fatBase = double.tryParse(_fatBase.text.trim()) ?? 0;
    final snfBase = double.tryParse(_snfBase.text.trim()) ?? 0;
    if (baseRate <= 0 || fatBase <= 0 || snfBase <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.tr('livestock.mgmt.errFillRequired'))),
      );
      return;
    }
    setState(() => _saving = true);
    double num(TextEditingController c) =>
        double.tryParse(c.text.trim()) ?? 0;
    try {
      final body = <String, dynamic>{
        'species': _species,
        'effectiveFrom': _effectiveFrom,
        'baseRate': baseRate,
        'fatBase': fatBase,
        'snfBase': snfBase,
        'fatStep': num(_fatStep),
        'snfStep': num(_snfStep),
        'minRate': num(_minRate),
        'minFat': num(_minFat),
        'minSnf': num(_minSnf),
        'active': _active,
      };
      final existing = widget.existing;
      if (existing == null) {
        await widget.api.createRateChart(body);
      } else {
        await widget.api.updateRateChart(existing.id, body);
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
      icon: Icons.currency_rupee_rounded,
      iconColor: const Color(0xFF2E7D32),
      title: s.tr(existing == null
          ? 'livestock.mgmt.rateChartNew'
          : 'livestock.mgmt.rateChartEdit'),
      subtitle: s.tr('livestock.mgmt.rateChartSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr(existing == null ? 'livestock.mgmt.save' : 'livestock.mgmt.saveChanges'),
        saving: _saving,
        color: const Color(0xFF2E7D32),
        onPressed: _submit,
      ),
      children: [
        MgmtChipSelect(
          options: [
            s.tr('livestock.mgmt.speciesCow'),
            s.tr('livestock.mgmt.speciesBuffalo'),
          ],
          selected: _species == 'cow'
              ? s.tr('livestock.mgmt.speciesCow')
              : s.tr('livestock.mgmt.speciesBuffalo'),
          onChanged: (v) => setState(() =>
              _species = v == s.tr('livestock.mgmt.speciesCow') ? 'cow' : 'buffalo'),
        ),
        const SizedBox(height: 12),
        MgmtDateField(
          label: s.tr('livestock.mgmt.effectiveFrom'),
          initialDate: DateTime.tryParse(_effectiveFrom) ?? DateTime.now(),
          onPicked: (v) => _effectiveFrom = v,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _baseRate,
                label: s.tr('livestock.mgmt.baseRate'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _minRate,
                label: s.tr('livestock.mgmt.minRate'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _fatBase,
                label: s.tr('livestock.mgmt.fatBase'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _snfBase,
                label: s.tr('livestock.mgmt.snfBase'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _fatStep,
                label: s.tr('livestock.mgmt.fatStep'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _snfStep,
                label: s.tr('livestock.mgmt.snfStep'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _minFat,
                label: s.tr('livestock.mgmt.minFat'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _minSnf,
                label: s.tr('livestock.mgmt.minSnf'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            s.tr('livestock.mgmt.setActive'),
            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
          ),
          subtitle: Text(
            s.tr('livestock.mgmt.setActiveHint'),
            style: const TextStyle(fontSize: 11.5),
          ),
          value: _active,
          onChanged: (v) => setState(() => _active = v),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Payment batch generate + mark paid
// ---------------------------------------------------------------------------

class BatchGenerateSheet extends StatefulWidget {
  final AppState state;
  final DairyMgmtApi api;
  final VoidCallback? onSaved;

  const BatchGenerateSheet({
    super.key,
    required this.state,
    required this.api,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required DairyMgmtApi api,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        BatchGenerateSheet(state: state, api: api, onSaved: onSaved),
      );

  @override
  State<BatchGenerateSheet> createState() => _BatchGenerateSheetState();
}

class _BatchGenerateSheetState extends State<BatchGenerateSheet> {
  String _periodFrom = '';
  String _periodTo = '';
  bool _saving = false;

  AppState get s => widget.state;

  static String _today() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  void initState() {
    super.initState();
    _periodFrom = _today();
    _periodTo = _today();
  }

  Future<void> _submit() async {
    if (_periodFrom.isEmpty || _periodTo.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.tr('livestock.mgmt.errFillRequired'))),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.api.generatePaymentBatch(
        periodFrom: _periodFrom,
        periodTo: _periodTo,
      );
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
      icon: Icons.payments_outlined,
      iconColor: const Color(0xFF1565C0),
      title: s.tr('livestock.mgmt.batchGenerate'),
      subtitle: s.tr('livestock.mgmt.batchSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr('livestock.mgmt.generate'),
        saving: _saving,
        color: const Color(0xFF1565C0),
        onPressed: _submit,
      ),
      children: [
        MgmtDateField(
          label: s.tr('livestock.mgmt.periodFrom'),
          initialDate: DateTime.now(),
          onPicked: (v) => _periodFrom = v,
        ),
        const SizedBox(height: 12),
        MgmtDateField(
          label: s.tr('livestock.mgmt.periodTo'),
          initialDate: DateTime.now(),
          onPicked: (v) => _periodTo = v,
        ),
      ],
    );
  }
}

class MarkPaidSheet extends StatefulWidget {
  final AppState state;
  final DairyMgmtApi api;
  final PaymentBatch batch;
  final VoidCallback? onSaved;

  const MarkPaidSheet({
    super.key,
    required this.state,
    required this.api,
    required this.batch,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required DairyMgmtApi api,
    required PaymentBatch batch,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        MarkPaidSheet(state: state, api: api, batch: batch, onSaved: onSaved),
      );

  @override
  State<MarkPaidSheet> createState() => _MarkPaidSheetState();
}

class _MarkPaidSheetState extends State<MarkPaidSheet> {
  final _payoutRef = TextEditingController();
  bool _saving = false;

  AppState get s => widget.state;

  @override
  void dispose() {
    _payoutRef.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await widget.api.markBatchPaid(
        widget.batch.id,
        payoutRef: _payoutRef.text.trim(),
      );
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
      icon: Icons.verified_outlined,
      iconColor: const Color(0xFF2E7D32),
      title: s.tr('livestock.mgmt.markPaid'),
      subtitle: s.tr('livestock.mgmt.markPaidSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr('livestock.mgmt.confirm'),
        saving: _saving,
        color: const Color(0xFF2E7D32),
        onPressed: _submit,
      ),
      children: [
        MgmtField(
          controller: _payoutRef,
          label: s.tr('livestock.mgmt.payoutRef'),
          icon: Icons.receipt_long_outlined,
        ),
        const SizedBox(height: 8),
        Text(
          s.tr('livestock.mgmt.payoutRefHint'),
          style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Milk sale customer create / edit
// ---------------------------------------------------------------------------

class SaleCustomerSheet extends StatefulWidget {
  final AppState state;
  final DairyMgmtApi api;
  final MilkSaleCustomer? existing;
  final VoidCallback? onSaved;

  const SaleCustomerSheet({
    super.key,
    required this.state,
    required this.api,
    this.existing,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required DairyMgmtApi api,
    MilkSaleCustomer? existing,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        SaleCustomerSheet(
          state: state,
          api: api,
          existing: existing,
          onSaved: onSaved,
        ),
      );

  @override
  State<SaleCustomerSheet> createState() => _SaleCustomerSheetState();
}

class _SaleCustomerSheetState extends State<SaleCustomerSheet> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _route = TextEditingController();
  final _am = TextEditingController(text: '0');
  final _pm = TextEditingController(text: '0');
  final _rate = TextEditingController();
  late String _type = widget.existing?.type ?? 'household';
  late final String _status = widget.existing?.status ?? 'active';
  bool _saving = false;

  AppState get s => widget.state;

  static const _types = ['household', 'shop', 'hotel'];

  @override
  void initState() {
    super.initState();
    final c = widget.existing;
    if (c != null) {
      _name.text = c.name;
      _phone.text = c.phone;
      _address.text = c.address;
      _route.text = c.route;
      _am.text = c.dailyLitersAM.toString();
      _pm.text = c.dailyLitersPM.toString();
      _rate.text = c.ratePerLiter.toString();
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _route.dispose();
    _am.dispose();
    _pm.dispose();
    _rate.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    final rate = double.tryParse(_rate.text.trim()) ?? 0;
    if (name.isEmpty || rate <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.tr('livestock.mgmt.errFillRequired'))),
      );
      return;
    }
    setState(() => _saving = true);
    double num(TextEditingController c) => double.tryParse(c.text.trim()) ?? 0;
    try {
      final body = <String, dynamic>{
        'name': name,
        'phone': _phone.text.trim(),
        'type': _type,
        'address': _address.text.trim(),
        'route': _route.text.trim(),
        'dailyLitersAM': num(_am),
        'dailyLitersPM': num(_pm),
        'ratePerLiter': rate,
        'status': _status,
      };
      final existing = widget.existing;
      if (existing == null) {
        await widget.api.createSaleCustomer(body);
      } else {
        await widget.api.updateSaleCustomer(existing.id, body);
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
      icon: Icons.storefront_outlined,
      iconColor: const Color(0xFFEF6C00),
      title: s.tr(existing == null
          ? 'livestock.mgmt.customerNew'
          : 'livestock.mgmt.customerEdit'),
      subtitle: s.tr('livestock.mgmt.customerSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr(existing == null ? 'livestock.mgmt.save' : 'livestock.mgmt.saveChanges'),
        saving: _saving,
        color: const Color(0xFFEF6C00),
        onPressed: _submit,
      ),
      children: [
        MgmtField(
          controller: _name,
          label: s.tr('livestock.mgmt.fullName'),
          icon: Icons.person_outline,
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _phone,
          label: s.tr('livestock.mgmt.phone'),
          keyboardType: TextInputType.phone,
          icon: Icons.phone_outlined,
        ),
        const SizedBox(height: 14),
        Text(
          s.tr('livestock.mgmt.customerType'),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        MgmtChipSelect(
          options: _types.map((t) => s.tr('livestock.mgmt.type.$t')).toList(),
          selected: s.tr('livestock.mgmt.type.$_type'),
          onChanged: (v) => setState(() {
            for (final t in _types) {
              if (v == s.tr('livestock.mgmt.type.$t')) _type = t;
            }
          }),
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _address,
          label: s.tr('livestock.mgmt.address'),
          icon: Icons.location_on_outlined,
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _route,
          label: s.tr('livestock.mgmt.route'),
          icon: Icons.alt_route_outlined,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _am,
                label: s.tr('livestock.mgmt.dailyLitersAM'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _pm,
                label: s.tr('livestock.mgmt.dailyLitersPM'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _rate,
          label: s.tr('livestock.mgmt.ratePerLiter'),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Milk sale order create
// ---------------------------------------------------------------------------

class SaleOrderSheet extends StatefulWidget {
  final AppState state;
  final DairyMgmtApi api;
  final List<MilkSaleCustomer> customers;
  final VoidCallback? onSaved;

  const SaleOrderSheet({
    super.key,
    required this.state,
    required this.api,
    required this.customers,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required DairyMgmtApi api,
    required List<MilkSaleCustomer> customers,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        SaleOrderSheet(
          state: state,
          api: api,
          customers: customers,
          onSaved: onSaved,
        ),
      );

  @override
  State<SaleOrderSheet> createState() => _SaleOrderSheetState();
}

class _SaleOrderSheetState extends State<SaleOrderSheet> {
  String? _customerId;
  late String _orderDate = _today();
  String _shift = 'am';
  final _liters = TextEditingController();
  final _amount = TextEditingController();
  final List<MilkSaleOrderItem> _items = [];
  bool _saving = false;

  AppState get s => widget.state;

  static String _today() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  void initState() {
    super.initState();
    final active =
        widget.customers.where((c) => c.status == 'active').toList();
    _customerId = active.isNotEmpty ? active.first.id : null;
  }

  @override
  void dispose() {
    _liters.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _addItem() async {
    final name = TextEditingController();
    final qty = TextEditingController(text: '1');
    final price = TextEditingController();
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(s.tr('livestock.mgmt.addItem')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: name,
              decoration: InputDecoration(
                labelText: s.tr('livestock.mgmt.itemName'),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: qty,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: s.tr('livestock.mgmt.qty'),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: price,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: s.tr('livestock.mgmt.unitPrice'),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(s.tr('livestock.mgmt.cancel')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF6C00),
            ),
            child: Text(
              s.tr('livestock.mgmt.save'),
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
    if (saved == true && name.text.trim().isNotEmpty) {
      setState(() {
        _items.add(
          MilkSaleOrderItem(
            productId: '',
            name: name.text.trim(),
            qty: double.tryParse(qty.text.trim()) ?? 1,
            unitPrice: double.tryParse(price.text.trim()) ?? 0,
          ),
        );
      });
    }
    name.dispose();
    qty.dispose();
    price.dispose();
  }

  Future<void> _submit() async {
    if (_customerId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.tr('livestock.mgmt.errFillRequired'))),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{
        'customerId': _customerId,
        'orderDate': _orderDate,
        'shift': _shift,
        'liters': double.tryParse(_liters.text.trim()) ?? 0,
        'items': _items.map((i) => i.toJson()).toList(),
        if (_amount.text.trim().isNotEmpty)
          'amount': double.tryParse(_amount.text.trim()),
      };
      await widget.api.createSaleOrder(body);
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
    final active =
        widget.customers.where((c) => c.status == 'active').toList();
    return MgmtSheetFrame(
      state: s,
      icon: Icons.local_shipping_outlined,
      iconColor: const Color(0xFFEF6C00),
      title: s.tr('livestock.mgmt.orderNew'),
      subtitle: s.tr('livestock.mgmt.orderSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr('livestock.mgmt.save'),
        saving: _saving,
        color: const Color(0xFFEF6C00),
        onPressed: _submit,
      ),
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(12),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _customerId,
              isExpanded: true,
              hint: Text(s.tr('livestock.mgmt.customer')),
              items: active
                  .map(
                    (c) => DropdownMenuItem(
                      value: c.id,
                      child: Text(
                        '${c.name} (₹${c.ratePerLiter}/L)',
                        style: const TextStyle(fontSize: 13.5),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _customerId = v),
            ),
          ),
        ),
        const SizedBox(height: 12),
        MgmtDateField(
          label: s.tr('livestock.mgmt.orderDate'),
          initialDate: DateTime.now(),
          onPicked: (v) => _orderDate = v,
        ),
        const SizedBox(height: 12),
        MgmtChipSelect(
          options: [
            s.tr('livestock.mgmt.shiftAM'),
            s.tr('livestock.mgmt.shiftPM'),
          ],
          selected:
              _shift == 'am' ? s.tr('livestock.mgmt.shiftAM') : s.tr('livestock.mgmt.shiftPM'),
          onChanged: (v) => setState(
              () => _shift = v == s.tr('livestock.mgmt.shiftAM') ? 'am' : 'pm'),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _liters,
                label: s.tr('livestock.mgmt.liters'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _amount,
                label: s.tr('livestock.mgmt.amountOptional'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '${s.tr('livestock.mgmt.items')} (${_items.length})',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
            ),
            TextButton.icon(
              onPressed: _addItem,
              icon: const Icon(Icons.add, size: 16),
              label: Text(s.tr('livestock.mgmt.addItem')),
            ),
          ],
        ),
        if (_items.isEmpty)
          Text(
            s.tr('livestock.mgmt.itemsEmptyHint'),
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
          )
        else
          ..._items.map(
            (i) => ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(i.name, style: const TextStyle(fontSize: 13)),
              subtitle: Text(
                '${i.qty} × ₹${i.unitPrice}',
                style: const TextStyle(fontSize: 11.5),
              ),
              trailing: IconButton(
                icon: const Icon(Icons.delete_outline, size: 18),
                onPressed: () => setState(() => _items.remove(i)),
              ),
            ),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Stock item create + adjust
// ---------------------------------------------------------------------------

class StockItemSheet extends StatefulWidget {
  final AppState state;
  final DairyMgmtApi api;
  final VoidCallback? onSaved;

  const StockItemSheet({
    super.key,
    required this.state,
    required this.api,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required DairyMgmtApi api,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        StockItemSheet(state: state, api: api, onSaved: onSaved),
      );

  @override
  State<StockItemSheet> createState() => _StockItemSheetState();
}

class _StockItemSheetState extends State<StockItemSheet> {
  final _name = TextEditingController();
  final _unit = TextEditingController(text: 'liter');
  final _qty = TextEditingController(text: '0');
  final _price = TextEditingController(text: '0');
  final _expiry = TextEditingController();
  String _category = 'milk';
  bool _saving = false;

  AppState get s => widget.state;

  static const _categories = ['milk', 'curd', 'ghee', 'paneer', 'other'];

  @override
  void dispose() {
    _name.dispose();
    _unit.dispose();
    _qty.dispose();
    _price.dispose();
    _expiry.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.tr('livestock.mgmt.errFillRequired'))),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.api.createStockItem({
        'name': _name.text.trim(),
        'category': _category,
        'unit': _unit.text.trim(),
        'stockQty': double.tryParse(_qty.text.trim()) ?? 0,
        'unitPrice': double.tryParse(_price.text.trim()) ?? 0,
        'expiryDate': _expiry.text.trim(),
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
      icon: Icons.inventory_2_outlined,
      iconColor: const Color(0xFF6A1B9A),
      title: s.tr('livestock.mgmt.stockItemNew'),
      subtitle: s.tr('livestock.mgmt.stockItemSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr('livestock.mgmt.save'),
        saving: _saving,
        color: const Color(0xFF6A1B9A),
        onPressed: _submit,
      ),
      children: [
        MgmtField(
          controller: _name,
          label: s.tr('livestock.mgmt.itemName'),
          icon: Icons.label_outline,
        ),
        const SizedBox(height: 14),
        Text(
          s.tr('livestock.mgmt.category'),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        MgmtChipSelect(
          options:
              _categories.map((c) => s.tr('livestock.mgmt.cat.$c')).toList(),
          selected: s.tr('livestock.mgmt.cat.$_category'),
          onChanged: (v) => setState(() {
            for (final c in _categories) {
              if (v == s.tr('livestock.mgmt.cat.$c')) _category = c;
            }
          }),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _unit,
                label: s.tr('livestock.mgmt.unit'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _qty,
                label: s.tr('livestock.mgmt.stockQty'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _price,
                label: s.tr('livestock.mgmt.unitPrice'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _expiry,
                label: s.tr('livestock.mgmt.expiryDate'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class StockAdjustSheet extends StatefulWidget {
  final AppState state;
  final DairyMgmtApi api;
  final StockItem item;
  final VoidCallback? onSaved;

  const StockAdjustSheet({
    super.key,
    required this.state,
    required this.api,
    required this.item,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required DairyMgmtApi api,
    required StockItem item,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        StockAdjustSheet(state: state, api: api, item: item, onSaved: onSaved),
      );

  @override
  State<StockAdjustSheet> createState() => _StockAdjustSheetState();
}

class _StockAdjustSheetState extends State<StockAdjustSheet> {
  final _delta = TextEditingController();
  final _reason = TextEditingController();
  bool _saving = false;

  AppState get s => widget.state;

  @override
  void dispose() {
    _delta.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final delta = double.tryParse(_delta.text.trim());
    if (delta == null || _reason.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.tr('livestock.mgmt.errFillRequired'))),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.api.adjustStock(
        widget.item.id,
        delta: delta,
        reason: _reason.text.trim(),
      );
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
      icon: Icons.tune_rounded,
      iconColor: const Color(0xFF6A1B9A),
      title: '${s.tr('livestock.mgmt.stockAdjust')} — ${widget.item.name}',
      subtitle: s.tr('livestock.mgmt.stockAdjustSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr('livestock.mgmt.save'),
        saving: _saving,
        color: const Color(0xFF6A1B9A),
        onPressed: _submit,
      ),
      children: [
        MgmtField(
          controller: _delta,
          label: s.tr('livestock.mgmt.delta'),
          keyboardType: const TextInputType.numberWithOptions(
            decimal: true,
            signed: true,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          s.tr('livestock.mgmt.deltaHint'),
          style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _reason,
          label: s.tr('livestock.mgmt.reason'),
          icon: Icons.notes_rounded,
        ),
      ],
    );
  }
}
