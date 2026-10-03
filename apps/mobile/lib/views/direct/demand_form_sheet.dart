import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/demands_api.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';

class DemandFormSheet extends StatefulWidget {
  final AppState state;
  final DemandsApi api;
  final Demand? existing;

  const DemandFormSheet({
    super.key,
    required this.state,
    required this.api,
    this.existing,
  });

  static Future<bool> show(
    BuildContext context, {
    required AppState state,
    required DemandsApi api,
    Demand? existing,
  }) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: SizedBox(
          height: MediaQuery.of(ctx).size.height * 0.9,
          child: DemandFormSheet(state: state, api: api, existing: existing),
        ),
      ),
    );
    return ok == true;
  }

  @override
  State<DemandFormSheet> createState() => _DemandFormSheetState();
}

class _DemandFormSheetState extends State<DemandFormSheet> {
  final _cropCtrl = TextEditingController();
  final _varietyCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _packagingCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String _unit = 'quintal';
  String _grade = 'A';
  String _frequency = 'oneTime';
  late DateTime _neededBy = DateTime.now().add(const Duration(days: 7));
  String? _error;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final d = widget.existing;
    if (d != null) {
      _cropCtrl.text = d.crop;
      _varietyCtrl.text = d.variety;
      _qtyCtrl.text = d.quantity == d.quantity.roundToDouble()
          ? d.quantity.toStringAsFixed(0)
          : d.quantity.toStringAsFixed(2);
      _priceCtrl.text = "${d.maxPrice}";
      _packagingCtrl.text = d.packaging;
      _locationCtrl.text = d.deliveryLocation;
      _notesCtrl.text = d.notes;
      _unit = d.unit;
      _grade = d.qualityGrade;
      _frequency = d.frequency;
      final parsed = DateTime.tryParse(d.neededBy);
      if (parsed != null) _neededBy = parsed;
    }
  }

  @override
  void dispose() {
    _cropCtrl.dispose();
    _varietyCtrl.dispose();
    _qtyCtrl.dispose();
    _priceCtrl.dispose();
    _packagingCtrl.dispose();
    _locationCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  String get _dateStr =>
      "${_neededBy.year}-${_neededBy.month.toString().padLeft(2, '0')}-${_neededBy.day.toString().padLeft(2, '0')}";

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _neededBy,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (d != null) setState(() => _neededBy = d);
  }

  Map<String, dynamic> _payload() => {
        'crop': _cropCtrl.text.trim(),
        'variety': _varietyCtrl.text.trim(),
        'quantity': double.tryParse(_qtyCtrl.text.trim()) ?? 0,
        'unit': _unit,
        'qualityGrade': _grade,
        'maxPrice': int.tryParse(_priceCtrl.text.trim()) ?? 0,
        'packaging': _packagingCtrl.text.trim(),
        'deliveryLocation': _locationCtrl.text.trim(),
        'neededBy': _dateStr,
        'frequency': _frequency,
        'notes': _notesCtrl.text.trim(),
      };

  Future<void> _submit() async {
    final tr = widget.state.tr;
    if (_cropCtrl.text.trim().isEmpty) {
      setState(() => _error = tr('direct.cropLabel'));
      return;
    }
    if ((double.tryParse(_qtyCtrl.text.trim()) ?? 0) <= 0) {
      setState(() => _error = tr('direct.errQuantityRequired'));
      return;
    }
    if ((int.tryParse(_priceCtrl.text.trim()) ?? 0) <= 0) {
      setState(() => _error = tr('direct.errMaxPriceRequired'));
      return;
    }
    if (_locationCtrl.text.trim().isEmpty) {
      setState(() => _error = tr('direct.deliveryLocationLabel'));
      return;
    }
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      final existing = widget.existing;
      if (existing != null) {
        await widget.api.updateDemand(existing.id, _payload());
        widget.state.showToast(tr('direct.demandUpdatedMsg'));
      } else {
        await widget.api.createDemand(_payload());
        widget.state.showToast(tr('direct.demandCreatedMsg'));
      }
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.state.tr;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
      children: [
        Text(
          widget.existing == null ? tr('direct.newDemand') : tr('direct.editDemand'),
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 12),
        _field(tr('direct.cropLabel'), tr('direct.cropHint'), _cropCtrl),
        Row(
          children: [
            Expanded(child: _field(tr('direct.quantityLabel'), tr('direct.quantityHint'), _qtyCtrl, type: TextInputType.number)),
            const SizedBox(width: 10),
            Expanded(child: _field(tr('direct.maxPriceLabel'), tr('direct.maxPriceHint'), _priceCtrl, type: TextInputType.number)),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              Text(tr('direct.unitLabel'),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              const SizedBox(width: 12),
              for (final u in const ['kg', 'quintal', 'tonne'])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(u),
                    selected: _unit == u,
                    onSelected: (_) => setState(() => _unit = u),
                    selectedColor: const Color(0xFF4F46E5),
                    labelStyle: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w900,
                        color: _unit == u ? Colors.white : Colors.black87),
                  ),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              Text(tr('direct.gradeLabel'),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              const SizedBox(width: 12),
              for (final g in const ['A', 'B', 'C'])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(g),
                    selected: _grade == g,
                    onSelected: (_) => setState(() => _grade = g),
                    selectedColor: const Color(0xFF0D9488),
                    labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: _grade == g ? Colors.white : Colors.black87),
                  ),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(tr('direct.frequencyLabel'),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              for (final f in const ['oneTime', 'weekly', 'monthly'])
                ChoiceChip(
                  label: Text(tr('direct.frequency_$f')),
                  selected: _frequency == f,
                  onSelected: (_) => setState(() => _frequency = f),
                  selectedColor: const Color(0xFF4F46E5),
                  labelStyle: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w900,
                      color: _frequency == f ? Colors.white : Colors.black87),
                ),
            ],
          ),
        ),
        _field(tr('direct.packagingLabel'), tr('direct.packagingHint'), _packagingCtrl),
        _field(tr('direct.deliveryLocationLabel'), tr('direct.deliveryLocationHint'), _locationCtrl),
        Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tr('direct.neededByLabel'),
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
                    Text(_dateStr, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              TextButton.icon(
                onPressed: _pickDate,
                icon: const Icon(Icons.calendar_month_rounded, size: 16),
                label: Text(tr('direct.selectDateBtn')),
              ),
            ],
          ),
        ),
        _field(tr('direct.notesLabel'), tr('direct.notesHint'), _notesCtrl),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(_error!,
                style: const TextStyle(fontSize: 11.5, color: Color(0xFFDC2626), fontWeight: FontWeight.w700)),
          ),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF4F46E5),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: _submitting ? null : _submit,
            child: Text(
              widget.existing == null ? tr('direct.newDemand') : tr('direct.editDemand'),
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ),
      ],
    );
  }

  Widget _field(String label, String hint, TextEditingController? ctrl,
      {TextInputType type = TextInputType.text}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
          if (ctrl != null) ...[
            const SizedBox(height: 4),
            TextField(
              controller: ctrl,
              keyboardType: type,
              decoration: InputDecoration.collapsed(hintText: hint),
            ),
          ],
        ],
      ),
    );
  }
}
