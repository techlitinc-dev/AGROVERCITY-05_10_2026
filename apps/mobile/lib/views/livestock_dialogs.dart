// Livestock & Dairy dialogs — manure order + vet booking (split from
// livestock_dairy_view.dart for the line cap; verbatim styling).

import 'package:flutter/material.dart';

import '../models/livestock_models.dart';
import '../state/app_state.dart';

class ManureOrderDialog extends StatefulWidget {
  final AppState state;
  final GaushalaItem gaushala;
  final void Function(String product, String quantity) onSubmit;

  const ManureOrderDialog({
    super.key,
    required this.state,
    required this.gaushala,
    required this.onSubmit,
  });

  @override
  State<ManureOrderDialog> createState() => _ManureOrderDialogState();
}

class _ManureOrderDialogState extends State<ManureOrderDialog> {
  String _product = "गोबर";
  final _quantityController = TextEditingController(text: "1 टन");

  @override
  void dispose() {
    _quantityController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final g = widget.gaushala;
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      title: Text('${widget.state.tr('livestock.manureRequestTitle')} (${g.name})', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${widget.state.tr('livestock.available')} ${g.facilities}', style: const TextStyle(fontSize: 12, color: Colors.black87, height: 1.3)),
          const SizedBox(height: 12),
          Text(widget.state.tr('livestock.selectManureType'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade300),
              borderRadius: BorderRadius.circular(12),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _product,
                isExpanded: true,
                items: const [
                  DropdownMenuItem(value: "गोबर", child: Text("गोबर (शेणखत)")),
                  DropdownMenuItem(value: "स्लरी", child: Text("स्लरी (गोकृपामृत)")),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _product = val);
                },
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(widget.state.tr('livestock.quantity'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          TextField(
            controller: _quantityController,
            decoration: InputDecoration(
              hintText: widget.state.tr('livestock.quantityHint'),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(widget.state.tr('cancel'))),
        ElevatedButton(
          onPressed: () {
            Navigator.pop(context);
            widget.onSubmit(_product, _quantityController.text.trim());
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF2E7D32),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: Text(widget.state.tr('livestock.confirmOrder'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
        ),
      ],
    );
  }
}

class VetBookingDialog extends StatefulWidget {
  final AppState state;
  final VetDoctor doctor;

  /// The signed-in farmer's registered animals (id → label). May be empty.
  final List<Animal> animals;
  final void Function(Map<String, dynamic> body) onSubmit;

  const VetBookingDialog({
    super.key,
    required this.state,
    required this.doctor,
    this.animals = const [],
    required this.onSubmit,
  });

  @override
  State<VetBookingDialog> createState() => _VetBookingDialogState();
}

class _VetBookingDialogState extends State<VetBookingDialog> {
  late String _visitType = 'clinic'; // 'clinic' | 'farm' | 'tele'
  String _animalId = '';
  String _slotDate = '';
  final _slotTime = TextEditingController(text: '10:00');
  final _symptoms = TextEditingController();
  final _address = TextEditingController();

  @override
  void dispose() {
    _slotTime.dispose();
    _symptoms.dispose();
    _address.dispose();
    super.dispose();
  }

  static String _today() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime(2035),
    );
    if (picked != null) {
      setState(() {
        _slotDate =
            '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      });
    }
  }

  void _submit() {
    Navigator.pop(context);
    widget.onSubmit({
      'visitType': _visitType,
      'slotDate': _slotDate.isEmpty ? _today() : _slotDate,
      'slotTime': _slotTime.text.trim(),
      if (_animalId.isNotEmpty) 'animalId': _animalId,
      'symptoms': _symptoms.text.trim(),
      if (_visitType == 'farm') 'address': _address.text.trim(),
    });
  }

  @override
  Widget build(BuildContext context) {
    final doc = widget.doctor;
    if (_slotDate.isEmpty) _slotDate = _today();
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: Colors.white,
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFE0F2FE),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.medical_services_rounded,
                color: Color(0xFF0284C7), size: 22),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${widget.state.tr('livestock.vetBookingTitle')}\n(${doc.name})',
              style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF112A1F)),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${widget.state.tr('livestock.expertise')} ${doc.specialization}',
              style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF0369A1),
                  fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            Text(widget.state.tr('livestock.selectBookingType'),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: Text(widget.state.tr('livestock.vets.visitType.clinic'),
                        style: const TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w700)),
                    selected: _visitType == 'clinic',
                    onSelected: (_) => setState(() => _visitType = 'clinic'),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: ChoiceChip(
                    label: Text(widget.state.tr('livestock.vets.visitType.farm'),
                        style: const TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w700)),
                    selected: _visitType == 'farm',
                    onSelected: (_) => setState(() => _visitType = 'farm'),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: ChoiceChip(
                    label: Text(widget.state.tr('livestock.vets.visitType.tele'),
                        style: const TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w700)),
                    selected: _visitType == 'tele',
                    onSelected: (_) => setState(() => _visitType = 'tele'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: _pickDate,
                    borderRadius: BorderRadius.circular(12),
                    child: InputDecorator(
                      decoration: InputDecoration(
                        labelText: widget.state.tr('livestock.mgmt.orderDate'),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                      ),
                      child: Text(_slotDate,
                          style: const TextStyle(fontSize: 13)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _slotTime,
                    decoration: InputDecoration(
                      labelText: widget.state.tr('livestock.vetHome.slotStart'),
                      hintText: widget.state.tr('livestock.slotHint'),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(widget.state.tr('livestock.animalType'),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(12),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _animalId.isEmpty ? null : _animalId,
                  isExpanded: true,
                  hint: const Text('—'),
                  items: [
                    ...widget.animals.map(
                      (a) => DropdownMenuItem(
                        value: a.id,
                        child: Text('${a.name} (${a.tagId})',
                            style: const TextStyle(fontSize: 12.5)),
                      ),
                    ),
                  ],
                  onChanged: (val) => setState(() => _animalId = val ?? ''),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _symptoms,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: widget.state.tr('livestock.vets.symptoms'),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
              ),
            ),
            if (_visitType == 'farm') ...[
              const SizedBox(height: 12),
              TextField(
                controller: _address,
                decoration: InputDecoration(
                  labelText: widget.state.tr('livestock.mgmt.address'),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                ),
              ),
            ],
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(10)),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(widget.state.tr('livestock.consultationFee'),
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700)),
                  Text(
                    '₹${doc.consultationFeeRupees} (${widget.state.tr('livestock.farmerDiscount')})',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF15803D)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(widget.state.tr('cancel'),
              style:
                  const TextStyle(color: Colors.grey, fontWeight: FontWeight.w700)),
        ),
        ElevatedButton(
          onPressed: _submit,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF0284C7),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
          ),
          child: Text(widget.state.tr('livestock.confirmAppointment'),
              style:
                  const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
        ),
      ],
    );
  }
}
