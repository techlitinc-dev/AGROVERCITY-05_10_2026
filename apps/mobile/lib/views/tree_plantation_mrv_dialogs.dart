import 'package:flutter/material.dart';

import '../models/tree_models.dart';
import '../state/app_state.dart';

class RegisterPlantationDialog extends StatefulWidget {
  final AppState state;
  final Function({
    required String parcelName,
    required String treeSpecies,
    required String vernacularSpecies,
    required int treeCount,
    required String plantingDate,
    required String landType,
    required double latitude,
    required double longitude,
    required double initialHeightCm,
    required String irrigationType,
  }) onSubmit;

  const RegisterPlantationDialog({
    super.key,
    required this.state,
    required this.onSubmit,
  });

  @override
  State<RegisterPlantationDialog> createState() => _RegisterPlantationDialogState();
}

class _RegisterPlantationDialogState extends State<RegisterPlantationDialog> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _parcelCtrl = TextEditingController(text: "पश्चिम बांध (West Bund)");
  final TextEditingController _countCtrl = TextEditingController(text: "100");
  final TextEditingController _heightCtrl = TextEditingController(text: "35");
  final TextEditingController _dateCtrl = TextEditingController(text: DateTime.now().toIso8601String().substring(0, 10));

  String _species = "सागवान (Teak)";
  String _landType = "bund";
  String _irrigation = "drip";
  final double _lat = 19.9975;
  final double _lng = 73.7898;

  final List<String> _speciesList = [
    "सागवान (Teak)",
    "बांबू (Bamboo)",
    "मलाबार कडूनिंब (Melia Dubia)",
    "कडुलिंब (Neem)",
    "करंज (Pongamia)",
    "चंदन (Sandalwood)",
    "सुबाभूळ (Subabul)",
  ];

  @override
  void dispose() {
    _parcelCtrl.dispose();
    _countCtrl.dispose();
    _heightCtrl.dispose();
    _dateCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("नवीन लागवड नोंदणी", style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                  IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close, size: 20)),
                ],
              ),
              const Text("जिओ-टॅग झाडांचा पासपोर्ट व कार्बन ट्रॅकर", style: TextStyle(fontSize: 11, color: Colors.grey)),
              const SizedBox(height: 14),

              TextFormField(
                controller: _parcelCtrl,
                decoration: const InputDecoration(
                  labelText: "शेत तुकडा / बांधाचे नाव",
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.location_on_outlined),
                ),
                validator: (v) => v == null || v.isEmpty ? "नाव आवश्यक" : null,
              ),
              const SizedBox(height: 12),

              DropdownButtonFormField<String>(
                value: _species,
                decoration: const InputDecoration(labelText: "वृक्ष प्रजाती", border: OutlineInputBorder()),
                items: _speciesList.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 13)))).toList(),
                onChanged: (v) {
                  if (v != null) setState(() => _species = v);
                },
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _countCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: "झाडे संख्या", border: OutlineInputBorder()),
                      validator: (v) => int.tryParse(v ?? '') == null ? "संख्या टाका" : null,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _heightCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: "उंची (cm)", border: OutlineInputBorder()),
                      validator: (v) => double.tryParse(v ?? '') == null ? "उंची टाका" : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _landType,
                      decoration: const InputDecoration(labelText: "लागवड प्रकार", border: OutlineInputBorder()),
                      items: const [
                        DropdownMenuItem(value: "bund", child: Text("बांध (Bund)", style: TextStyle(fontSize: 12))),
                        DropdownMenuItem(value: "block", child: Text("ब्लॉक (Block)", style: TextStyle(fontSize: 12))),
                        DropdownMenuItem(value: "agroforestry", child: Text("आंतरपीक (Agro)", style: TextStyle(fontSize: 12))),
                      ],
                      onChanged: (v) => setState(() => _landType = v ?? "bund"),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _irrigation,
                      decoration: const InputDecoration(labelText: "पाणी पद्धत", border: OutlineInputBorder()),
                      items: const [
                        DropdownMenuItem(value: "drip", child: Text("ठिबक (Drip)", style: TextStyle(fontSize: 12))),
                        DropdownMenuItem(value: "rainfed", child: Text("कोरडवाहू", style: TextStyle(fontSize: 12))),
                        DropdownMenuItem(value: "flood", child: Text("पाटपाणी", style: TextStyle(fontSize: 12))),
                      ],
                      onChanged: (v) => setState(() => _irrigation = v ?? "drip"),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(10)),
                child: Row(
                  children: [
                    const Icon(Icons.my_location, color: Color(0xFF1B5E20), size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "GPS स्थान: ${_lat.toStringAsFixed(4)}, ${_lng.toStringAsFixed(4)} (जिओ-टॅग प्रमाणित)",
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF1B5E20)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1B5E20),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () {
                    if (_formKey.currentState?.validate() ?? false) {
                      Navigator.pop(context);
                      widget.onSubmit(
                        parcelName: _parcelCtrl.text.trim(),
                        treeSpecies: _species,
                        vernacularSpecies: _species.split(' ').first,
                        treeCount: int.parse(_countCtrl.text.trim()),
                        plantingDate: _dateCtrl.text.trim(),
                        landType: _landType,
                        latitude: _lat,
                        longitude: _lng,
                        initialHeightCm: double.parse(_heightCtrl.text.trim()),
                        irrigationType: _irrigation,
                      );
                    }
                  },
                  child: const Text("लागवड नोंदवा (Register)", style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AddGrowthLogDialog extends StatefulWidget {
  final TreePlantation plantation;
  final Function({
    required double heightCm,
    required double girthCm,
    required int survivalCount,
    required String healthStatus,
    required String notes,
  }) onSubmit;

  const AddGrowthLogDialog({
    super.key,
    required this.plantation,
    required this.onSubmit,
  });

  @override
  State<AddGrowthLogDialog> createState() => _AddGrowthLogDialogState();
}

class _AddGrowthLogDialogState extends State<AddGrowthLogDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _heightCtrl =
      TextEditingController(text: (widget.plantation.currentAvgHeightCm + 15).toStringAsFixed(0));
  final TextEditingController _girthCtrl = TextEditingController(text: "12");
  late final TextEditingController _survivalCtrl =
      TextEditingController(text: "${widget.plantation.treeCount}");
  final TextEditingController _notesCtrl = TextEditingController(text: "ठिबक सिंचनाने नवीन फुटवे उत्तम आले आहेत.");

  String _healthStatus = "healthy";

  @override
  void dispose() {
    _heightCtrl.dispose();
    _girthCtrl.dispose();
    _survivalCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("वाढ व आरोग्य नोंदवा", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                  IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close, size: 20)),
                ],
              ),
              Text(
                "${widget.plantation.parcelName} (${widget.plantation.vernacularSpecies})",
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF1B5E20), fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 14),

              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _heightCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: "उंची (cm)", border: OutlineInputBorder()),
                      validator: (v) => double.tryParse(v ?? '') == null ? "उंची टाका" : null,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _girthCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: "घेर/रुंदी (cm)", border: OutlineInputBorder()),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _survivalCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: "जिवंत झाडे সংখ্যা (एकूण: ${widget.plantation.treeCount})",
                  border: const OutlineInputBorder(),
                ),
                validator: (v) => int.tryParse(v ?? '') == null ? "संख्या टाका" : null,
              ),
              const SizedBox(height: 12),

              DropdownButtonFormField<String>(
                value: _healthStatus,
                decoration: const InputDecoration(labelText: "झाडांचे आरोग्य", border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: "healthy", child: Text("🟢 उत्तम व निरोगी (Healthy)", style: TextStyle(fontSize: 13))),
                  DropdownMenuItem(value: "average", child: Text("🟡 मध्यम वाढ (Average)", style: TextStyle(fontSize: 13))),
                  DropdownMenuItem(value: "pest_attack", child: Text("🔴 कीड/रोग प्रादुर्भाव", style: TextStyle(fontSize: 13))),
                  DropdownMenuItem(value: "drought_stressed", child: Text("🟠 पाण्याचा ताण (Drought)", style: TextStyle(fontSize: 13))),
                ],
                onChanged: (v) => setState(() => _healthStatus = v ?? "healthy"),
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _notesCtrl,
                decoration: const InputDecoration(labelText: "नोंदी व खत व्यवस्थापन", border: OutlineInputBorder()),
                maxLines: 2,
              ),
              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1B5E20),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () {
                    if (_formKey.currentState?.validate() ?? false) {
                      Navigator.pop(context);
                      widget.onSubmit(
                        heightCm: double.parse(_heightCtrl.text.trim()),
                        girthCm: double.tryParse(_girthCtrl.text.trim()) ?? 0.0,
                        survivalCount: int.parse(_survivalCtrl.text.trim()),
                        healthStatus: _healthStatus,
                        notes: _notesCtrl.text.trim(),
                      );
                    }
                  },
                  child: const Text("नोंद जतन करा (Save Audit)", style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class PlantationDetailSheet extends StatelessWidget {
  final TreePlantation plantation;
  final AppState state;
  final VoidCallback onAddLog;

  const PlantationDetailSheet({
    super.key,
    required this.plantation,
    required this.state,
    required this.onAddLog,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.8,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 12),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(plantation.parcelName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                  Text("${plantation.vernacularSpecies} • ${plantation.treeCount} झाडे", style: const TextStyle(fontSize: 12, color: Color(0xFF1B5E20), fontWeight: FontWeight.w700)),
                ],
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B5E20),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () {
                  Navigator.pop(context);
                  onAddLog();
                },
                icon: const Icon(Icons.add, size: 16),
                label: const Text("नवीन नोंद", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(),
          const SizedBox(height: 8),

          const Text("वाढ व आरोग्य इतिहास (MRV Growth Audit Logs)", style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF112A1F))),
          const SizedBox(height: 10),

          Expanded(
            child: plantation.logs.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.history_edu, size: 48, color: Colors.grey.shade300),
                        const SizedBox(height: 8),
                        const Text("अद्याप कोणतीही वाढ नोंद झालेली नाही", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  )
                : ListView.builder(
                    itemCount: plantation.logs.length,
                    itemBuilder: (ctx, i) {
                      final log = plantation.logs[i];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text("ऑडिट तारीख: ${log.auditDate}", style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF1B5E20))),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(color: Colors.green.shade100, borderRadius: BorderRadius.circular(6)),
                                  child: Text(
                                    log.healthStatus == "healthy" ? "निरोगी" : log.healthStatus,
                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF1B5E20)),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Text("उंची: ${log.heightCm} cm", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                                const SizedBox(width: 14),
                                Text("जिवंत: ${log.survivalCount}/${plantation.treeCount}", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                                if (log.girthCm > 0) ...[
                                  const SizedBox(width: 14),
                                  Text("घेर: ${log.girthCm} cm", style: const TextStyle(fontSize: 11.5)),
                                ],
                              ],
                            ),
                            if (log.notes.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text("नोंद: ${log.notes}", style: TextStyle(fontSize: 11, color: Colors.grey.shade700, fontStyle: FontStyle.italic)),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
