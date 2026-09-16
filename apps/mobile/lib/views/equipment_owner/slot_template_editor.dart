import 'package:flutter/material.dart';

class SlotTemplateRow {
  SlotTemplateRow({
    String slotName = '',
    String duration = '4 hours',
    String priceRupees = '',
    String recommendedTask = '',
  })  : slotNameCtrl = TextEditingController(text: slotName),
        durationCtrl = TextEditingController(text: duration),
        priceCtrl = TextEditingController(text: priceRupees),
        taskCtrl = TextEditingController(text: recommendedTask);

  final TextEditingController slotNameCtrl;
  final TextEditingController durationCtrl;
  final TextEditingController priceCtrl;
  final TextEditingController taskCtrl;

  Map<String, dynamic> toTemplate() => {
        'slotName': slotNameCtrl.text.trim(),
        'duration': durationCtrl.text.trim(),
        'priceRupees': int.tryParse(priceCtrl.text.trim()) ?? 0,
        'recommendedTask': taskCtrl.text.trim(),
      };

  void dispose() {
    slotNameCtrl.dispose();
    durationCtrl.dispose();
    priceCtrl.dispose();
    taskCtrl.dispose();
  }
}

// Generated slots apply to new days only — existing days keep their slots.
class SlotTemplateEditor extends StatelessWidget {
  const SlotTemplateEditor({
    super.key,
    required this.rows,
    required this.onAdd,
    required this.onRemove,
  });

  final List<SlotTemplateRow> rows;
  final VoidCallback onAdd;
  final void Function(int index) onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text("स्लॉट टेम्पलेट (Slot Template)", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
            Text("1–8 स्लॉट", style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey)),
          ],
        ),
        const SizedBox(height: 4),
        const Text(
          "नए स्लॉट अगले दिन से लागू होंगे",
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFD97706)),
        ),
        const SizedBox(height: 8),
        for (var i = 0; i < rows.length; i++) _buildRowCard(i, rows[i]),
        const SizedBox(height: 4),
        OutlinedButton.icon(
          onPressed: rows.length >= 8 ? null : onAdd,
          icon: const Icon(Icons.add_rounded, size: 16),
          label: const Text("स्लॉट जोड़ें", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        ),
      ],
    );
  }

  Widget _buildRowCard(int index, SlotTemplateRow row) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: row.slotNameCtrl,
                  decoration: const InputDecoration(
                    labelText: "समय (जैसे 6:00 AM – 10:00 AM)",
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
              IconButton(
                onPressed: rows.length <= 1 ? null : () => onRemove(index),
                icon: const Icon(Icons.remove_circle_outline_rounded, color: Color(0xFFDC2626)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: row.durationCtrl,
                  decoration: const InputDecoration(
                    labelText: "अवधि",
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: row.priceCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: "₹ कीमत",
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            controller: row.taskCtrl,
            decoration: const InputDecoration(
              labelText: "सुझाया कार्य (जैसे Ploughing, tilling (जुताई))",
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
        ],
      ),
    );
  }
}
