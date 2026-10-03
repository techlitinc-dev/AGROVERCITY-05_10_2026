// Landlord bottom-sheet form — new land listing (L2).

import 'package:flutter/material.dart';
import '../../data/translations.dart';
import '../../models/land_models.dart';

String _t(String key, String lang) => AppTranslations.get(key, lang);

typedef ListingFormResult = ({
  String village,
  String district,
  double areaAcres,
  double expectedRentRupees,
  String? soilType,
  String? plotId,
});

Future<ListingFormResult?> showListingFormSheet(
  BuildContext context, {
  required List<LandPlot> plots,
  String lang = 'en',
}) {
  final villageCtrl = TextEditingController();
  final districtCtrl = TextEditingController();
  final areaCtrl = TextEditingController();
  final rentCtrl = TextEditingController();
  String? plotId;
  String? soilType;
  const soils = ['Black Cotton', 'Red', 'Sandy', 'Alluvial'];

  return showModalBottomSheet<ListingFormResult>(
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
              Text(_t('landlord.newListingTitle', lang),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
              const SizedBox(height: 14),
              TextField(controller: villageCtrl, decoration: InputDecoration(labelText: _t('village', lang), border: const OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(controller: districtCtrl, decoration: InputDecoration(labelText: _t('district', lang), border: const OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(controller: areaCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: _t('landlord.areaAcresLabel', lang), border: const OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(controller: rentCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: _t('landlord.expectedRentLabel', lang), border: const OutlineInputBorder())),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: plotId,
                decoration: InputDecoration(labelText: _t('landlord.linkPlotOptional', lang), border: const OutlineInputBorder()),
                items: plots
                    .map((p) => DropdownMenuItem(
                        value: p.id, child: Text("${p.name} • ${p.village}")))
                    .toList(),
                onChanged: (v) => setSheetState(() => plotId = v),
              ),
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
                  final rent = double.tryParse(rentCtrl.text.trim()) ?? 0;
                  if (villageCtrl.text.trim().isEmpty ||
                      districtCtrl.text.trim().isEmpty ||
                      area <= 0 ||
                      rent <= 0) {
                    return;
                  }
                  Navigator.pop(ctx, (
                    village: villageCtrl.text.trim(),
                    district: districtCtrl.text.trim(),
                    areaAcres: area,
                    expectedRentRupees: rent,
                    soilType: soilType,
                    plotId: plotId,
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
