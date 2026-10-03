import 'package:flutter/material.dart';
import '../../api/cold_storage_api.dart';
import '../../models/cold_storage_models.dart';

Future<bool?> showApproveBookingDialog(
  BuildContext context,
  ColdStorageBookingRecord booking,
  ColdStorageApi api,
) {
  final noteCtrl = TextEditingController(text: 'आरक्षण स्वीकृत। उपज निर्धारित तिथि पर लाएं।');
  String selectedChamber = booking.allocatedChamberId ?? 'ch-101';
  bool submitting = false;

  return showDialog<bool>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('आरक्षण स्वीकृति (Approve Booking)',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'किसान: ${booking.farmerName} • ${booking.quantityQuintals} क्विंटल',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
            const SizedBox(height: 4),
            Text(
              'फसल: ${booking.cropName} • ${booking.months} माह भंडारण',
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: selectedChamber,
              decoration: InputDecoration(
                labelText: 'आवंटित कक्ष (Chamber / Wing)',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
              items: const [
                DropdownMenuItem(value: 'ch-101', child: Text('कक्ष A - शीतगृह (2-4°C)')),
                DropdownMenuItem(value: 'ch-102', child: Text('कक्ष B - नियंत्रित (10-14°C)')),
                DropdownMenuItem(value: 'ch-201', child: Text('गोदाम विंग 1 (हवादार)')),
              ],
              onChanged: (val) {
                if (val != null) setState(() => selectedChamber = val);
              },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: noteCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: 'संचालक टिप्पणी (Notes)',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('रद्द करें'),
          ),
          ElevatedButton(
            onPressed: submitting
                ? null
                : () async {
                    setState(() => submitting = true);
                    try {
                      await api.reviewBooking(
                        booking.id,
                        action: 'approve',
                        allocatedChamberId: selectedChamber,
                        notes: noteCtrl.text.trim(),
                      );
                      if (ctx.mounted) Navigator.pop(ctx, true);
                    } catch (_) {
                      if (ctx.mounted) {
                        setState(() => submitting = false);
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(content: Text('स्वीकृति विफल — पुनः प्रयास करें')),
                        );
                      }
                    }
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
            ),
            child: const Text('स्वीकृत करें'),
          ),
        ],
      ),
    ),
  );
}

Future<bool?> showRejectBookingDialog(
  BuildContext context,
  ColdStorageBookingRecord booking,
  ColdStorageApi api,
) {
  final reasonCtrl = TextEditingController(text: 'निर्धारित तिथि पर कक्ष पूर्णतः आरक्षित है।');
  bool submitting = false;

  return showDialog<bool>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('आरक्षण अस्वीकृति (Reject Booking)',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'किसान: ${booking.farmerName} • ${booking.cropName}',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: 'अस्वीकृति का कारण (Reason) *',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('रद्द करें'),
          ),
          ElevatedButton(
            onPressed: submitting
                ? null
                : () async {
                    if (reasonCtrl.text.trim().isEmpty) return;
                    setState(() => submitting = true);
                    try {
                      await api.reviewBooking(
                        booking.id,
                        action: 'reject',
                        rejectionReason: reasonCtrl.text.trim(),
                      );
                      if (ctx.mounted) Navigator.pop(ctx, true);
                    } catch (_) {
                      if (ctx.mounted) {
                        setState(() => submitting = false);
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(content: Text('अस्वीकृति विफल — पुनः प्रयास करें')),
                        );
                      }
                    }
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              foregroundColor: Colors.white,
            ),
            child: const Text('अस्वीकृत करें'),
          ),
        ],
      ),
    ),
  );
}

Future<bool?> showGateInwardDialog(
  BuildContext context,
  ColdStorageBookingRecord booking,
  ColdStorageApi api,
) {
  final grossCtrl = TextEditingController(
      text: (booking.quantityQuintals * 102.5).toStringAsFixed(0));
  final tareCtrl = TextEditingController(
      text: (booking.quantityQuintals * 2.5).toStringAsFixed(0));
  final bagsCtrl = TextEditingController(
      text: (booking.bagsCount > 0 ? booking.bagsCount : (booking.quantityQuintals * 2).toInt()).toString());
  final moistureCtrl = TextEditingController(text: '11.5');
  String qcGrade = 'Grade A';
  bool submitting = false;

  return showDialog<bool>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('गेट आवक व e-NWR रसीद जारी करें',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'किसान: ${booking.farmerName} • उपज: ${booking.cropName}',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: grossCtrl,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'सकल भार (Gross kg)',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: tareCtrl,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'तारे भार (Tare kg)',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: bagsCtrl,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'बोरी संख्या (Bags)',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: moistureCtrl,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'नमी (Moisture %)',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: qcGrade,
                decoration: InputDecoration(
                  labelText: 'गुणवत्ता ग्रेड (QC Grade)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                items: const [
                  DropdownMenuItem(value: 'Grade A Premium', child: Text('Grade A Premium (उत्कृष्ट)')),
                  DropdownMenuItem(value: 'Grade A', child: Text('Grade A (मानक)')),
                  DropdownMenuItem(value: 'Grade B', child: Text('Grade B (मध्यम)')),
                  DropdownMenuItem(value: 'FAQ', child: Text('FAQ (सामान्य औसत)')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => qcGrade = val);
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('रद्द करें'),
          ),
          ElevatedButton(
            onPressed: submitting
                ? null
                : () async {
                    final gross = double.tryParse(grossCtrl.text.trim()) ?? 0.0;
                    final tare = double.tryParse(tareCtrl.text.trim()) ?? 0.0;
                    final netKg = gross - tare;
                    final netQ = netKg > 0 ? netKg / 100.0 : booking.quantityQuintals;
                    final bags = int.tryParse(bagsCtrl.text.trim()) ?? 1;
                    final moisture = double.tryParse(moistureCtrl.text.trim());

                    setState(() => submitting = true);
                    try {
                      final res = await api.gateInward(
                        booking.id,
                        grossWeightKg: gross,
                        tareWeightKg: tare,
                        netQuintals: netQ,
                        actualBags: bags,
                        moisturePercent: moisture,
                        qcGrade: qcGrade,
                      );
                      if (ctx.mounted) {
                        Navigator.pop(ctx, true);
                        final receiptNo = res['receipt']?['receiptNumber'] ?? 'NWR-ISSUED';
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('गेट आवक सफल! e-NWR रसीद संख्या: $receiptNo')),
                        );
                      }
                    } catch (_) {
                      if (ctx.mounted) {
                        setState(() => submitting = false);
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(content: Text('आवक प्रविष्टि विफल — पुनः प्रयास करें')),
                        );
                      }
                    }
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0F766E),
              foregroundColor: Colors.white,
            ),
            child: const Text('आवक दर्ज करें व e-NWR बनाएं'),
          ),
        ],
      ),
    ),
  );
}

Future<bool?> showGateReleaseDialog(
  BuildContext context,
  ColdStorageBookingRecord booking,
  ColdStorageApi api,
) {
  final currentStock = booking.remainingQuintals ?? booking.inwardNetQuintals ?? booking.quantityQuintals;
  final qtyCtrl = TextEditingController(text: currentStock.toString());
  final vehicleCtrl = TextEditingController(text: 'MH-15-EG-4488');
  final driverCtrl = TextEditingController(text: 'दत्तात्रेय शिंदे');
  final rentPaidCtrl = TextEditingController(text: booking.totalEstimatedRent.toStringAsFixed(0));
  bool submitting = false;

  return showDialog<bool>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('उपज निकासी व गेट पास जारी करें',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'किसान: ${booking.farmerName} • उपलब्ध साठा: $currentStock क्विंटल',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: qtyCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'निकासी मात्रा (Quintals) *',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: vehicleCtrl,
                decoration: InputDecoration(
                  labelText: 'वाहन क्रमांक (Vehicle No.)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: driverCtrl,
                decoration: InputDecoration(
                  labelText: 'चालक का नाम (Driver Name)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: rentPaidCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'जमा भाड़ा राशि (Rent Cleared ₹)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('रद्द करें'),
          ),
          ElevatedButton(
            onPressed: submitting
                ? null
                : () async {
                    final qty = double.tryParse(qtyCtrl.text.trim()) ?? 0.0;
                    if (qty <= 0 || qty > currentStock) return;
                    final paid = double.tryParse(rentPaidCtrl.text.trim()) ?? 0.0;

                    setState(() => submitting = true);
                    try {
                      final res = await api.gateRelease(
                        booking.id,
                        releaseQuintals: qty,
                        vehicleNumber: vehicleCtrl.text.trim(),
                        driverName: driverCtrl.text.trim(),
                        amountPaid: paid,
                      );
                      if (ctx.mounted) {
                        Navigator.pop(ctx, true);
                        final gp = res['gatePassNumber'] ?? 'GP-ISSUED';
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('निकासी संपन्न! गेट पास संख्या: $gp')),
                        );
                      }
                    } catch (_) {
                      if (ctx.mounted) {
                        setState(() => submitting = false);
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(content: Text('निकासी विफल — पुनः प्रयास करें')),
                        );
                      }
                    }
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
            ),
            child: const Text('गेट पास जारी करें'),
          ),
        ],
      ),
    ),
  );
}

void showWarehouseReceiptDialog(
  BuildContext context,
  WarehouseReceiptRecord receipt,
) {
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(
        children: [
          const Icon(Icons.verified_rounded, color: Color(0xFF0F766E), size: 28),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'इलेक्ट्रॉनिक वेयरहाउस रसीद (e-NWR)',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF86EFAC)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('रसीद संख्या: ${receipt.receiptNumber}',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF166534))),
                  const SizedBox(height: 2),
                  Text('WDRA पंजीकरण: ${receipt.wdraRegNo ?? "WDRA/MH/2026/044"}',
                      style: const TextStyle(fontSize: 11, color: Colors.grey)),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _infoRow('जमाकर्ता (Farmer)', receipt.depositorName),
            _infoRow('शीतगृह / गोदाम', receipt.facilityName),
            _infoRow('फसल व किस्म', receipt.variety != null ? '${receipt.cropName} (${receipt.variety})' : receipt.cropName),
            _infoRow('शुद्ध साठा भार', '${receipt.netQuintals} क्विंटल (${receipt.bagsCount} बोरी)'),
            _infoRow('गुणवत्ता ग्रेड', receipt.qcGrade),
            if (receipt.moisturePercent != null)
              _infoRow('नमी प्रतिशत', '${receipt.moisturePercent}%'),
            _infoRow('आवंटित कक्ष / लॉट', '${receipt.chamberName} • ${receipt.lotNumber}'),
            _infoRow('अनुमानित मूल्य', '₹${receipt.valuationRupees.toStringAsFixed(0)}'),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFBFDBFE)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.shield_outlined, size: 16, color: Color(0xFF1D4ED8)),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'यह e-NWR किसान ऋण (Pledge Finance) हेतु 100% मान्य है।',
                      style: TextStyle(fontSize: 11, color: Color(0xFF1E40AF), fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('बंद करें'),
        ),
      ],
    ),
  );
}

Widget _infoRow(String label, String value) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 120,
          child: Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ),
        Expanded(
          child: Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
        ),
      ],
    ),
  );
}

Future<bool?> showCreateFacilityDialog(
  BuildContext context,
  ColdStorageApi api,
) {
  final nameCtrl = TextEditingController();
  final capacityCtrl = TextEditingController(text: '100');
  final rateCtrl = TextEditingController(text: '15');
  final addressCtrl = TextEditingController(text: 'MIDC / APMC Market Yard');
  final districtCtrl = TextEditingController(text: 'Nashik');
  final managerCtrl = TextEditingController();
  final phoneCtrl = TextEditingController();
  final wdraCtrl = TextEditingController();
  String facilityType = 'cold_storage';
  bool wdraRegistered = true;
  bool submitting = false;

  return showDialog<bool>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('नया गोदाम / स्टोरेज जोड़ें',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: InputDecoration(
                  labelText: 'गोदाम / शीतगृह का नाम *',
                  hintText: 'उदा. नाशिक किसान मेगा गोदाम',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: facilityType,
                decoration: InputDecoration(
                  labelText: 'सुविधा का प्रकार *',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                items: const [
                  DropdownMenuItem(value: 'cold_storage', child: Text('शीतगृह (Cold Storage)')),
                  DropdownMenuItem(value: 'dry_godown', child: Text('सूखा गोदाम (Dry Godown)')),
                  DropdownMenuItem(value: 'silo', child: Text('अनाज साइलो (Grain Silo)')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => facilityType = val);
                },
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: capacityCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: 'कुल क्षमता (MT) *',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: rateCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: 'मासिक दर (₹/Q) *',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: districtCtrl,
                      decoration: InputDecoration(
                        labelText: 'जिला (District)',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: addressCtrl,
                      decoration: InputDecoration(
                        labelText: 'पता / मंडी क्षेत्र',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: managerCtrl,
                      decoration: InputDecoration(
                        labelText: 'प्रबंधक का नाम',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: phoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: 'संपर्क फोन',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('WDRA पंजीकृत गोदाम', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                subtitle: const Text('e-NWR रसीद व बैंक लोन हेतु अधिकृत', style: TextStyle(fontSize: 11, color: Colors.grey)),
                value: wdraRegistered,
                activeColor: const Color(0xFF0284C7),
                onChanged: (val) => setState(() => wdraRegistered = val),
              ),
              if (wdraRegistered)
                TextField(
                  controller: wdraCtrl,
                  decoration: InputDecoration(
                    labelText: 'WDRA पंजीकरण क्रमांक (वैकल्पिक)',
                    hintText: 'उदा. WDRA/MH/NSK/2026/044',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('रद्द करें'),
          ),
          ElevatedButton(
            onPressed: submitting
                ? null
                : () async {
                    final name = nameCtrl.text.trim();
                    final cap = double.tryParse(capacityCtrl.text.trim()) ?? 0.0;
                    final rate = double.tryParse(rateCtrl.text.trim()) ?? 0.0;
                    if (name.isEmpty || cap <= 0) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('कृपया मान्य नाम और क्षमता (MT) दर्ज करें')),
                      );
                      return;
                    }

                    setState(() => submitting = true);
                    try {
                      await api.createFacility({
                        'name': name,
                        'facilityType': facilityType,
                        'capacityMT': cap,
                        'ratePerQuintalMonth': rate > 0 ? rate : 15.0,
                        'district': districtCtrl.text.trim().isNotEmpty ? districtCtrl.text.trim() : 'Nashik',
                        'address': addressCtrl.text.trim().isNotEmpty ? addressCtrl.text.trim() : null,
                        'managerName': managerCtrl.text.trim().isNotEmpty ? managerCtrl.text.trim() : null,
                        'contactPhone': phoneCtrl.text.trim().isNotEmpty ? phoneCtrl.text.trim() : null,
                        'wdraRegistered': wdraRegistered,
                        if (wdraRegistered && wdraCtrl.text.trim().isNotEmpty)
                          'wdraRegNo': wdraCtrl.text.trim(),
                        'tempRange': facilityType == 'cold_storage' ? '2-8°C' : 'Ambient',
                      });
                      if (ctx.mounted) Navigator.pop(ctx, true);
                    } catch (_) {
                      if (ctx.mounted) {
                        setState(() => submitting = false);
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(content: Text('गोदाम पंजीकरण विफल — पुनः प्रयास करें')),
                        );
                      }
                    }
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
            ),
            child: const Text('गोदाम जोड़ें'),
          ),
        ],
      ),
    ),
  );
}

Future<bool?> showAddChamberDialog(
  BuildContext context,
  String facilityId,
  ColdStorageApi api,
) {
  final nameCtrl = TextEditingController();
  final capacityCtrl = TextEditingController(text: '30');
  final tempCtrl = TextEditingController(text: '2-8°C');
  String chamberType = 'cold_storage';
  bool submitting = false;

  return showDialog<bool>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('नया कक्ष / ब्लॉक जोड़ें',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: InputDecoration(
                  labelText: 'कक्ष / ब्लॉक का नाम *',
                  hintText: 'उदा. कक्ष C (सेब व अंगूर)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: chamberType,
                decoration: InputDecoration(
                  labelText: 'कक्ष का प्रकार *',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                items: const [
                  DropdownMenuItem(value: 'cold_storage', child: Text('शीत कक्ष (Cold Chamber)')),
                  DropdownMenuItem(value: 'dry_godown', child: Text('सूखा गोदाम ब्लॉक (Dry Wing)')),
                  DropdownMenuItem(value: 'silo', child: Text('अनाज साइलो (Grain Silo)')),
                ],
                onChanged: (val) {
                  if (val != null) {
                    setState(() {
                      chamberType = val;
                      if (val == 'dry_godown' || val == 'silo') {
                        tempCtrl.text = 'Ambient';
                      } else {
                        tempCtrl.text = '2-8°C';
                      }
                    });
                  }
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: capacityCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: 'कक्ष क्षमता (MT) *',
                  hintText: 'उदा. 30',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: tempCtrl,
                decoration: InputDecoration(
                  labelText: 'तापमान सीमा (Temperature)',
                  hintText: 'उदा. 2-8°C या Ambient',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('रद्द करें'),
          ),
          ElevatedButton(
            onPressed: submitting
                ? null
                : () async {
                    final name = nameCtrl.text.trim();
                    final cap = double.tryParse(capacityCtrl.text.trim()) ?? 0.0;
                    if (name.isEmpty || cap <= 0) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('कृपया मान्य कक्ष नाम और क्षमता (MT) दर्ज करें')),
                      );
                      return;
                    }

                    setState(() => submitting = true);
                    try {
                      await api.addChamber(facilityId, {
                        'name': name,
                        'chamberType': chamberType,
                        'capacityMT': cap,
                        'tempRange': tempCtrl.text.trim().isNotEmpty ? tempCtrl.text.trim() : '2-8°C',
                        'status': 'active',
                      });
                      if (ctx.mounted) Navigator.pop(ctx, true);
                    } catch (_) {
                      if (ctx.mounted) {
                        setState(() => submitting = false);
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(content: Text('कक्ष जोड़ना विफल — पुनः प्रयास करें')),
                        );
                      }
                    }
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
            ),
            child: const Text('कक्ष जोड़ें'),
          ),
        ],
      ),
    ),
  );
}
