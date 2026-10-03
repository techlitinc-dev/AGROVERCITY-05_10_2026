// Gaushala console sheets: profile setup/edit, cattle intake event, expense,
// 80G receipt dialog.

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
// Gaushala profile create / edit (shown when /livestock/gaushala/mine 404s)
// ---------------------------------------------------------------------------

class GaushalaProfileSheet extends StatefulWidget {
  final AppState state;
  final GaushalaMgmtApi api;
  final GaushalaProfile? existing;
  final VoidCallback? onSaved;

  const GaushalaProfileSheet({
    super.key,
    required this.state,
    required this.api,
    this.existing,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required GaushalaMgmtApi api,
    GaushalaProfile? existing,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        GaushalaProfileSheet(
          state: state,
          api: api,
          existing: existing,
          onSaved: onSaved,
        ),
      );

  @override
  State<GaushalaProfileSheet> createState() => _GaushalaProfileSheetState();
}

class _GaushalaProfileSheetState extends State<GaushalaProfileSheet> {
  final _name = TextEditingController();
  final _trustName = TextEditingController();
  final _address = TextEditingController();
  final _district = TextEditingController();
  final _phone = TextEditingController();
  final _capacity = TextEditingController(text: '0');
  final _bankName = TextEditingController();
  final _bankAccount = TextEditingController();
  final _bankIfsc = TextEditingController();
  late bool _g80 = false;
  late bool _fcra = false;
  late bool _awbi = false;
  bool _saving = false;

  AppState get s => widget.state;

  @override
  void initState() {
    super.initState();
    final g = widget.existing;
    if (g != null) {
      _name.text = g.name;
      _trustName.text = g.trustName;
      _address.text = g.address;
      _district.text = g.district;
      _phone.text = g.phone;
      _capacity.text = g.capacity.toString();
      _bankName.text = (g.bankDetails['bankName'] ?? '') as String;
      _bankAccount.text = (g.bankDetails['accountNumber'] ?? '') as String;
      _bankIfsc.text = (g.bankDetails['ifsc'] ?? '') as String;
      _g80 = g.certifications['80G'] == true;
      _fcra = g.certifications['FCRA'] == true;
      _awbi = g.certifications['AWBI'] == true;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _trustName.dispose();
    _address.dispose();
    _district.dispose();
    _phone.dispose();
    _capacity.dispose();
    _bankName.dispose();
    _bankAccount.dispose();
    _bankIfsc.dispose();
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
      final body = <String, dynamic>{
        'name': _name.text.trim(),
        'trustName': _trustName.text.trim(),
        'address': _address.text.trim(),
        'district': _district.text.trim(),
        'phone': _phone.text.trim(),
        'capacity': int.tryParse(_capacity.text.trim()) ?? 0,
        'certifications': {
          if (_g80) '80G': true,
          if (_fcra) 'FCRA': true,
          if (_awbi) 'AWBI': true,
        },
        'bankDetails': {
          if (_bankName.text.trim().isNotEmpty) 'bankName': _bankName.text.trim(),
          if (_bankAccount.text.trim().isNotEmpty)
            'accountNumber': _bankAccount.text.trim(),
          if (_bankIfsc.text.trim().isNotEmpty) 'ifsc': _bankIfsc.text.trim(),
        },
      };
      final existing = widget.existing;
      if (existing == null) {
        await widget.api.createProfile(body);
      } else {
        await widget.api.updateProfile(body);
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
      icon: Icons.temple_hindu_rounded,
      iconColor: const Color(0xFFEF6C00),
      title: s.tr(existing == null
          ? 'livestock.gaushala.profileSetup'
          : 'livestock.gaushala.profileEdit'),
      subtitle: s.tr('livestock.gaushala.profileSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr(existing == null ? 'livestock.mgmt.save' : 'livestock.mgmt.saveChanges'),
        saving: _saving,
        color: const Color(0xFFEF6C00),
        onPressed: _submit,
      ),
      children: [
        MgmtField(
          controller: _name,
          label: s.tr('livestock.gaushala.name'),
          icon: Icons.temple_hindu_outlined,
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _trustName,
          label: s.tr('livestock.gaushala.trustName'),
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _address,
          label: s.tr('livestock.mgmt.address'),
          icon: Icons.location_on_outlined,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _district,
                label: s.tr('livestock.gaushala.district'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _phone,
                label: s.tr('livestock.mgmt.phone'),
                keyboardType: TextInputType.phone,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _capacity,
          label: s.tr('livestock.gaushala.capacity'),
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 14),
        Text(
          s.tr('livestock.gaushala.certifications'),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          dense: true,
          title: Text(s.tr('livestock.gaushala.cert80G')),
          value: _g80,
          onChanged: (v) => setState(() => _g80 = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          dense: true,
          title: Text(s.tr('livestock.gaushala.certFCRA')),
          value: _fcra,
          onChanged: (v) => setState(() => _fcra = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          dense: true,
          title: Text(s.tr('livestock.gaushala.certAWBI')),
          value: _awbi,
          onChanged: (v) => setState(() => _awbi = v),
        ),
        const SizedBox(height: 6),
        Text(
          s.tr('livestock.gaushala.bankDetails'),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        MgmtField(
          controller: _bankName,
          label: s.tr('livestock.mgmt.bankName'),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _bankAccount,
                label: s.tr('livestock.mgmt.bankAccount'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtField(
                controller: _bankIfsc,
                label: s.tr('livestock.mgmt.bankIfsc'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Cattle intake / status event
// ---------------------------------------------------------------------------

class CattleEventSheet extends StatefulWidget {
  final AppState state;
  final GaushalaMgmtApi api;
  final GaushalaCattle cattle;
  final VoidCallback? onSaved;

  const CattleEventSheet({
    super.key,
    required this.state,
    required this.api,
    required this.cattle,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required GaushalaMgmtApi api,
    required GaushalaCattle cattle,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        CattleEventSheet(
          state: state,
          api: api,
          cattle: cattle,
          onSaved: onSaved,
        ),
      );

  @override
  State<CattleEventSheet> createState() => _CattleEventSheetState();
}

class _CattleEventSheetState extends State<CattleEventSheet> {
  static const _types = ['intake', 'adopted-out', 'deceased', 'transferred'];
  String _type = 'intake';
  final _note = TextEditingController();
  late String _date = _today();
  bool _saving = false;

  AppState get s => widget.state;

  static String _today() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await widget.api.addCattleEvent(widget.cattle.id, {
        'type': _type,
        'note': _note.text.trim(),
        'date': _date,
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
      icon: Icons.pets_rounded,
      iconColor: const Color(0xFF2E7D32),
      title: '${s.tr('livestock.gaushala.cattleEvent')} — ${widget.cattle.name}',
      subtitle: s.tr('livestock.gaushala.cattleEventSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr('livestock.mgmt.save'),
        saving: _saving,
        color: const Color(0xFF2E7D32),
        onPressed: _submit,
      ),
      children: [
        MgmtChipSelect(
          options:
              _types.map((t) => s.tr('livestock.gaushala.event.$t')).toList(),
          selected: s.tr('livestock.gaushala.event.$_type'),
          onChanged: (v) => setState(() {
            for (final t in _types) {
              if (v == s.tr('livestock.gaushala.event.$t')) _type = t;
            }
          }),
        ),
        const SizedBox(height: 12),
        MgmtDateField(
          label: s.tr('livestock.gaushala.eventDate'),
          initialDate: DateTime.now(),
          onPicked: (v) => _date = v,
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _note,
          label: s.tr('livestock.gaushala.eventNote'),
          icon: Icons.notes_rounded,
          maxLines: 2,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Expense create / edit
// ---------------------------------------------------------------------------

class ExpenseSheet extends StatefulWidget {
  final AppState state;
  final GaushalaMgmtApi api;
  final GaushalaExpense? existing;
  final VoidCallback? onSaved;

  const ExpenseSheet({
    super.key,
    required this.state,
    required this.api,
    this.existing,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required GaushalaMgmtApi api,
    GaushalaExpense? existing,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        ExpenseSheet(
          state: state,
          api: api,
          existing: existing,
          onSaved: onSaved,
        ),
      );

  @override
  State<ExpenseSheet> createState() => _ExpenseSheetState();
}

class _ExpenseSheetState extends State<ExpenseSheet> {
  static const _categories = [
    'fodder',
    'medical',
    'staff',
    'utilities',
    'transport',
    'other',
  ];
  String _category = 'fodder';
  final _amount = TextEditingController();
  final _note = TextEditingController();
  late String _date = _today();
  bool _saving = false;

  AppState get s => widget.state;

  static String _today() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _category = e.category;
      _amount.text = e.amount.toString();
      _note.text = e.note;
      _date = e.expenseDate.isNotEmpty ? e.expenseDate : _today();
    }
  }

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amount.text.trim()) ?? 0;
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.tr('livestock.mgmt.errFillRequired'))),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{
        'category': _category,
        'amount': amount,
        'note': _note.text.trim(),
        'expenseDate': _date,
      };
      final existing = widget.existing;
      if (existing == null) {
        await widget.api.createExpense(body);
      } else {
        await widget.api.updateExpense(existing.id, body);
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
      icon: Icons.receipt_long_outlined,
      iconColor: const Color(0xFFC62828),
      title: s.tr(existing == null
          ? 'livestock.gaushala.expenseNew'
          : 'livestock.gaushala.expenseEdit'),
      subtitle: s.tr('livestock.gaushala.expenseSubtitle'),
      footer: MgmtSaveButton(
        label: s.tr(existing == null ? 'livestock.mgmt.save' : 'livestock.mgmt.saveChanges'),
        saving: _saving,
        color: const Color(0xFFC62828),
        onPressed: _submit,
      ),
      children: [
        Text(
          s.tr('livestock.mgmt.category'),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        MgmtChipSelect(
          options: _categories
              .map((c) => s.tr('livestock.gaushala.expCat.$c'))
              .toList(),
          selected: s.tr('livestock.gaushala.expCat.$_category'),
          onChanged: (v) => setState(() {
            for (final c in _categories) {
              if (v == s.tr('livestock.gaushala.expCat.$c')) _category = c;
            }
          }),
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _amount,
          label: s.tr('livestock.gaushala.expenseAmount'),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          icon: Icons.currency_rupee_rounded,
        ),
        const SizedBox(height: 12),
        MgmtDateField(
          label: s.tr('livestock.gaushala.expenseDate'),
          initialDate: DateTime.tryParse(_date) ?? DateTime.now(),
          onPicked: (v) => _date = v,
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _note,
          label: s.tr('livestock.gaushala.expenseNote'),
          icon: Icons.notes_rounded,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// 80G receipt dialog (auto-created on approve/acknowledge)
// ---------------------------------------------------------------------------

class ReceiptDialog extends StatelessWidget {
  final AppState state;
  final Receipt receipt;

  const ReceiptDialog({super.key, required this.state, required this.receipt});

  static void show(BuildContext context,
      {required AppState state, required Receipt receipt}) {
    showDialog(
      context: context,
      builder: (ctx) => ReceiptDialog(state: state, receipt: receipt),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = state;
    Widget row(String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 130,
                child: Text(
                  label,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                ),
              ),
              Expanded(
                child: Text(
                  value,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        );
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFE8F5E9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.verified_rounded,
              color: Color(0xFF2E7D32),
              size: 22,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              s.tr('livestock.gaushala.receiptTitle'),
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          row(s.tr('livestock.gaushala.receiptCert'), receipt.certificateNumber),
          row(s.tr('livestock.gaushala.receiptPerson'), receipt.personName),
          row('${s.tr('livestock.gaushala.receiptAmount')} (₹)',
              '${receipt.amount}'),
          row(
            s.tr('livestock.gaushala.receipt80G'),
            receipt.eightyGEligible
                ? s.tr('livestock.gaushala.receipt80GYes')
                : s.tr('livestock.gaushala.receipt80GNo'),
          ),
          row(s.tr('livestock.gaushala.receiptGaushala'), receipt.gaushalaName),
          row(s.tr('livestock.gaushala.receiptIssuedAt'), receipt.issuedAt),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(s.tr('livestock.mgmt.confirm')),
        ),
      ],
    );
  }
}
