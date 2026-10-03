// Consultation completion sheet — vet notes + inline prescription builder,
// submitted with the appointment status transition to "completed".
// Contract: POST /livestock/appointments/{id}/status (livestock_vets.py).

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/vet_api.dart';
import '../../models/livestock_mgmt_models.dart';
import '../../state/app_state.dart';
import '../livestock/mgmt_widgets.dart';

class ConsultationSheet extends StatefulWidget {
  final AppState state;
  final VetApi api;
  final Appointment appointment;
  final VoidCallback? onSaved;

  const ConsultationSheet({
    super.key,
    required this.state,
    required this.api,
    required this.appointment,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required VetApi api,
    required Appointment appointment,
    VoidCallback? onSaved,
  }) =>
      MgmtSheetFrame.showSheet(
        context,
        ConsultationSheet(
          state: state,
          api: api,
          appointment: appointment,
          onSaved: onSaved,
        ),
      );

  @override
  State<ConsultationSheet> createState() => _ConsultationSheetState();
}

class _ConsultationSheetState extends State<ConsultationSheet> {
  final _vetNotes = TextEditingController();
  final _diagnosis = TextEditingController();
  final _advice = TextEditingController();
  final _withdrawal = TextEditingController(text: '0');
  String _followUpDate = '';
  final List<Medicine> _medicines = [];
  bool _saving = false;

  AppState get s => widget.state;

  @override
  void dispose() {
    _vetNotes.dispose();
    _diagnosis.dispose();
    _advice.dispose();
    _withdrawal.dispose();
    super.dispose();
  }

  Future<void> _addMedicine() async {
    final name = TextEditingController();
    final dosage = TextEditingController();
    final frequency = TextEditingController();
    final duration = TextEditingController(text: '3');
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(s.tr('livestock.vetRx.addMedicine')),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: InputDecoration(
                  labelText: s.tr('livestock.vetRx.medicineName'),
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
                      controller: dosage,
                      decoration: InputDecoration(
                        labelText: s.tr('livestock.vetRx.dosage'),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: frequency,
                      decoration: InputDecoration(
                        labelText: s.tr('livestock.vetRx.frequency'),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: duration,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: s.tr('livestock.vetRx.durationDays'),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(s.tr('livestock.mgmt.cancel')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00838F),
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
        _medicines.add(
          Medicine(
            name: name.text.trim(),
            dosage: dosage.text.trim(),
            frequency: frequency.text.trim(),
            durationDays: int.tryParse(duration.text.trim()) ?? 0,
            notes: '',
          ),
        );
      });
    }
    name.dispose();
    dosage.dispose();
    frequency.dispose();
    duration.dispose();
  }

  Future<void> _submit() async {
    final diagnosis = _diagnosis.text.trim();
    if (diagnosis.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.tr('livestock.mgmt.errFillRequired'))),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.api.updateAppointmentStatus(widget.appointment.id, {
        'status': 'completed',
        'vetNotes': _vetNotes.text.trim(),
        'prescription': {
          'diagnosis': diagnosis,
          'medicines': _medicines.map((m) => m.toJson()).toList(),
          'advice': _advice.text.trim(),
          'milkWithdrawalDays': int.tryParse(_withdrawal.text.trim()) ?? 0,
          'followUpDate': _followUpDate,
        },
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onSaved?.call();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message.isNotEmpty ? e.message : e.code)),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MgmtSheetFrame(
      state: s,
      icon: Icons.receipt_long_outlined,
      iconColor: const Color(0xFF00838F),
      title: s.tr('livestock.vetRx.title'),
      subtitle:
          '${widget.appointment.farmerName}  •  ${widget.appointment.slotDate} ${widget.appointment.slotTime}',
      footer: MgmtSaveButton(
        label: s.tr('livestock.vetRx.complete'),
        saving: _saving,
        color: const Color(0xFF00838F),
        onPressed: _submit,
      ),
      children: [
        MgmtField(
          controller: _vetNotes,
          label: s.tr('livestock.vetRx.vetNotes'),
          icon: Icons.notes_rounded,
          maxLines: 2,
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _diagnosis,
          label: s.tr('livestock.vetRx.diagnosis'),
          icon: Icons.medical_information_outlined,
        ),
        const SizedBox(height: 12),
        MgmtField(
          controller: _advice,
          label: s.tr('livestock.vetRx.advice'),
          maxLines: 2,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: MgmtField(
                controller: _withdrawal,
                label: s.tr('livestock.vetRx.milkWithdrawal'),
                keyboardType: TextInputType.number,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: MgmtDateField(
                label: s.tr('livestock.vetRx.followUp'),
                initialDate: DateTime.now().add(const Duration(days: 7)),
                onPicked: (v) => _followUpDate = v,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '${s.tr('livestock.vetRx.medicines')} (${_medicines.length})',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
            ),
            TextButton.icon(
              onPressed: _addMedicine,
              icon: const Icon(Icons.add, size: 16),
              label: Text(s.tr('livestock.vetRx.addMedicine')),
            ),
          ],
        ),
        if (_medicines.isEmpty)
          Text(
            s.tr('livestock.vetRx.medicinesEmpty'),
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
          )
        else
          ..._medicines.map(
            (m) => ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(m.name, style: const TextStyle(fontSize: 13)),
              subtitle: Text(
                '${m.dosage}  •  ${m.frequency}  •  ${m.durationDays}d',
                style: const TextStyle(fontSize: 11.5),
              ),
              trailing: IconButton(
                icon: const Icon(Icons.delete_outline, size: 18),
                onPressed: () => setState(() => _medicines.remove(m)),
              ),
            ),
          ),
      ],
    );
  }
}
