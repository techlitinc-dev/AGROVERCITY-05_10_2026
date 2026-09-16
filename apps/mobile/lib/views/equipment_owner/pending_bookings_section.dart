import 'package:flutter/material.dart';

// Pops with the reason text (min 3 chars), or null when cancelled.
class RejectEquipmentDialog extends StatefulWidget {
  const RejectEquipmentDialog({super.key});

  static const quickReasons = ['मशीन खराब', 'ऑपरेटर उपलब्ध नहीं', 'तारीख सूट नहीं'];

  @override
  State<RejectEquipmentDialog> createState() => _RejectEquipmentDialogState();
}

class _RejectEquipmentDialogState extends State<RejectEquipmentDialog> {
  final _reasonCtrl = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Text("अस्वीकार का कारण", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 6,
            children: RejectEquipmentDialog.quickReasons
                .map(
                  (r) => ActionChip(
                    label: Text(r, style: const TextStyle(fontSize: 11.5)),
                    onPressed: () => setState(() {
                      _reasonCtrl.text = r;
                      _error = null;
                    }),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _reasonCtrl,
            onChanged: (_) => setState(() => _error = null),
            decoration: InputDecoration(
              labelText: "कारण लिखें",
              border: const OutlineInputBorder(),
              errorText: _error,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text("रद्द करें")),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
          onPressed: () {
            final text = _reasonCtrl.text.trim();
            if (text.length < 3) {
              setState(() => _error = "कम से कम 3 अक्षर लिखें");
              return;
            }
            Navigator.pop(context, text);
          },
          child: const Text("अस्वीकारें"),
        ),
      ],
    );
  }
}

class PendingBookingsSection extends StatelessWidget {
  const PendingBookingsSection({
    super.key,
    required this.bookings,
    required this.onApprove,
    required this.onReject,
  });

  final List<Map<String, dynamic>> bookings;
  final void Function(Map<String, dynamic> booking) onApprove;
  final void Function(Map<String, dynamic> booking, String reason) onReject;

  Future<void> _openRejectDialog(BuildContext context, Map<String, dynamic> booking) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => const RejectEquipmentDialog(),
    );
    if (reason == null) return;
    onReject(booking, reason);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text("लंबित बुकिंग", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
            Text("${bookings.length} नई", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFD97706))),
          ],
        ),
        const SizedBox(height: 8),
        if (bookings.isEmpty)
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Text("कोई लंबित बुकिंग नहीं", style: TextStyle(fontSize: 12, color: Colors.grey)),
          )
        else
          ...bookings.map((b) => _buildRow(context, b)),
      ],
    );
  }

  Widget _buildRow(BuildContext context, Map<String, dynamic> b) {
    final price = (b['priceRupees'] as num?) ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.amber.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  "${b['farmerName']}",
                  style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                ),
              ),
              Text("₹${price.toInt()}", style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFFD97706))),
            ],
          ),
          Text(
            "${b['equipmentName'] ?? ''} • ${b['date'] ?? ''} • ${b['slotName'] ?? ''}",
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () => onApprove(b),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 48),
                  ),
                  child: const Text("स्वीकारें", style: TextStyle(fontWeight: FontWeight.w900)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _openRejectDialog(context, b),
                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
                  child: const Text("अस्वीकारें", style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFDC2626))),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
