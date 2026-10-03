// Landlord bottom-sheet forms — new plot and rent payment.

import 'package:flutter/material.dart';
import '../../data/translations.dart';

String _t(String key, String lang) => AppTranslations.get(key, lang);

// Result of the "+ नया प्लॉट" sheet.
typedef PlotFormResult = ({
  String name,
  String village,
  String district,
  double areaAcres,
  String? gatNumber,
  String? soilType,
});

Future<PlotFormResult?> showPlotFormSheet(BuildContext context, {String lang = 'en'}) {
  final nameCtrl = TextEditingController();
  final villageCtrl = TextEditingController();
  final districtCtrl = TextEditingController();
  final areaCtrl = TextEditingController();
  final gatCtrl = TextEditingController();
  String? soilType;
  const soils = ['Black Cotton', 'Red', 'Sandy', 'Alluvial'];

  return showModalBottomSheet<PlotFormResult>(
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
              Text(_t('landlord.addPlotTitle', lang),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
              const SizedBox(height: 14),
              TextField(controller: nameCtrl, decoration: InputDecoration(labelText: _t('landlord.plotNameHint', lang), border: const OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(controller: villageCtrl, decoration: InputDecoration(labelText: _t('village', lang), border: const OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(controller: districtCtrl, decoration: InputDecoration(labelText: _t('district', lang), border: const OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(controller: areaCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: _t('landlord.areaAcresLabel', lang), border: const OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(controller: gatCtrl, decoration: InputDecoration(labelText: _t('landlord.gatNumberOptional', lang), border: const OutlineInputBorder())),
              const SizedBox(height: 12),
              Text("${_t('soilType', lang)}:", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                children: soils.map((s) {
                  final sel = soilType == s;
                  return ChoiceChip(
                    label: Text(s),
                    selected: sel,
                    selectedColor: const Color(0xFFEDE9FE),
                    onSelected: (_) => setSheetState(() => soilType = sel ? null : s),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  final area = double.tryParse(areaCtrl.text.trim()) ?? 0;
                  if (nameCtrl.text.trim().isEmpty ||
                      villageCtrl.text.trim().isEmpty ||
                      districtCtrl.text.trim().isEmpty ||
                      area <= 0) {
                    return;
                  }
                  Navigator.pop(ctx, (
                    name: nameCtrl.text.trim(),
                    village: villageCtrl.text.trim(),
                    district: districtCtrl.text.trim(),
                    areaAcres: area,
                    gatNumber: gatCtrl.text.trim().isEmpty ? null : gatCtrl.text.trim(),
                    soilType: soilType,
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

// Result of the "+ भुगतान दर्ज करें" sheet.
typedef PaymentFormResult = ({
  double amountRupees,
  String month,
  String method,
  String paidAt,
});

Future<PaymentFormResult?> showPaymentFormSheet(
  BuildContext context, {
  required double monthlyRentRupees,
  String lang = 'en',
}) {
  final amtCtrl =
      TextEditingController(text: monthlyRentRupees.toInt().toString());
  final now = DateTime.now();
  final months = List.generate(12, (i) {
    final d = DateTime(now.year, now.month - i, 1);
    return "${d.year}-${d.month.toString().padLeft(2, '0')}";
  });
  String month = months.first;
  String method = 'cash';
  final methods = {
    'cash': () => _t('landlord.methodCash', lang),
    'upi': () => 'UPI',
    'bank': () => _t('landlord.methodBank', lang),
  };

  return showModalBottomSheet<PaymentFormResult>(
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_t('landlord.recordRentPayment', lang),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: month,
              decoration: InputDecoration(labelText: _t('landlord.month', lang), border: const OutlineInputBorder()),
              items: months
                  .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                  .toList(),
              onChanged: (v) => setSheetState(() => month = v ?? month),
            ),
            const SizedBox(height: 10),
            TextField(controller: amtCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: _t('landlord.amountLabel', lang), border: const OutlineInputBorder())),
            const SizedBox(height: 12),
            Text("${_t('landlord.paymentMethod', lang)}:", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: methods.entries.map((e) {
                final sel = method == e.key;
                return ChoiceChip(
                  label: Text(e.value()),
                  selected: sel,
                  selectedColor: const Color(0xFFD1FAE5),
                  onSelected: (_) => setSheetState(() => method = e.key),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                final amount = double.tryParse(amtCtrl.text.trim()) ?? 0;
                if (amount <= 0) return;
                final paid =
                    "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
                Navigator.pop(ctx, (
                  amountRupees: amount,
                  month: month,
                  method: method,
                  paidAt: paid,
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
  );
}
