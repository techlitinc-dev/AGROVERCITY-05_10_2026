// Landlord bottom-sheet form — new lease.

import 'package:flutter/material.dart';
import '../../data/translations.dart';
import '../../models/land_models.dart';

String _t(String key, String lang) => AppTranslations.get(key, lang);

typedef LeaseFormResult = ({
  String plotId,
  String tenantName,
  String tenantPhone,
  double monthlyRentRupees,
  String startDate,
  String endDate,
});

String _fmtDate(DateTime d) =>
    "${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}";

Future<LeaseFormResult?> showLeaseFormSheet(
  BuildContext context, {
  required List<LandPlot> vacantPlots,
  String lang = 'en',
}) {
  final tenantCtrl = TextEditingController();
  final phoneCtrl = TextEditingController();
  final rentCtrl = TextEditingController();
  String? plotId = vacantPlots.isNotEmpty ? vacantPlots.first.id : null;
  DateTime? startDate;
  DateTime? endDate;
  String? phoneError;

  return showModalBottomSheet<LeaseFormResult>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => StatefulBuilder(
      builder: (context, setSheetState) => Padding(
        padding: EdgeInsets.fromLTRB(
            18, 18, 18, 18 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_t('landlord.newLeaseTitle', lang),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: plotId,
                decoration: InputDecoration(labelText: _t('landlord.selectVacantPlot', lang), border: const OutlineInputBorder()),
                items: vacantPlots
                    .map((p) => DropdownMenuItem(
                        value: p.id, child: Text("${p.name} • ${p.village}")))
                    .toList(),
                onChanged: (v) => setSheetState(() => plotId = v),
              ),
              const SizedBox(height: 10),
              TextField(controller: tenantCtrl, decoration: InputDecoration(labelText: _t('landlord.tenantName', lang), border: const OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(
                controller: phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: _t('landlord.tenantMobile', lang),
                  border: const OutlineInputBorder(),
                  errorText: phoneError,
                ),
                onChanged: (v) => setSheetState(() {
                  final digits = v.trim();
                  phoneError = digits.isNotEmpty && !RegExp(r'^\d{10}$').hasMatch(digits)
                      ? _t('landlord.enterTenDigitMobile', lang)
                      : null;
                }),
              ),
              const SizedBox(height: 10),
              TextField(controller: rentCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: _t('landlord.monthlyRentLabel', lang), border: const OutlineInputBorder())),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final d = await showDatePicker(
                          context: context,
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2035),
                          initialDate: DateTime.now(),
                        );
                        if (d != null) setSheetState(() => startDate = d);
                      },
                      icon: const Icon(Icons.calendar_today_rounded, size: 15),
                      label: Text(startDate == null ? _t('landlord.startDate', lang) : _fmtDate(startDate!)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final d = await showDatePicker(
                          context: context,
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2035),
                          initialDate: DateTime.now().add(const Duration(days: 365)),
                        );
                        if (d != null) setSheetState(() => endDate = d);
                      },
                      icon: const Icon(Icons.event_rounded, size: 15),
                      label: Text(endDate == null ? _t('landlord.endDate', lang) : _fmtDate(endDate!)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  final rent = double.tryParse(rentCtrl.text.trim()) ?? 0;
                  final phone = phoneCtrl.text.trim();
                  if (plotId == null ||
                      tenantCtrl.text.trim().isEmpty ||
                      !RegExp(r'^\d{10}$').hasMatch(phone) ||
                      rent <= 0 ||
                      startDate == null ||
                      endDate == null ||
                      !endDate!.isAfter(startDate!)) {
                    setSheetState(() {
                      if (!RegExp(r'^\d{10}$').hasMatch(phone)) {
                        phoneError = _t('landlord.enterTenDigitMobile', lang);
                      }
                    });
                    return;
                  }
                  Navigator.pop(ctx, (
                    plotId: plotId!,
                    tenantName: tenantCtrl.text.trim(),
                    tenantPhone: phone,
                    monthlyRentRupees: rent,
                    startDate: _fmtDate(startDate!),
                    endDate: _fmtDate(endDate!),
                  ));
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF8B5CF6),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 44),
                ),
                child: Text(_t('save', lang), style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
