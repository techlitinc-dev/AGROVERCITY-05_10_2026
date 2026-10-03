// P&L widgets — add-expense dialog, KPI card, statement item.

import 'package:flutter/material.dart';

String pnlNumStr(num v) =>
    v == v.roundToDouble() ? v.toInt().toString() : v.toString();

// Shows the prototype's "नया खेत खर्च जोड़ें" dialog; resolves with
// (category, amount) or null when cancelled / invalid amount.
Future<(String, double)?> showPnlAddExpenseDialog(BuildContext context, [dynamic state]) {
  final titleController = TextEditingController();
  final amtController = TextEditingController();

  return showDialog<(String, double)>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Text("नया खेत खर्च जोड़ें", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(controller: titleController, decoration: const InputDecoration(labelText: "विवरण (उदा. 2 बोरी खाद)", border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: amtController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "राशि (₹)", border: OutlineInputBorder())),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("रद्द करें")),
        ElevatedButton(
          onPressed: () {
            final category = titleController.text.trim().isEmpty
                ? "Misc (इतर)"
                : titleController.text.trim();
            final amount = double.tryParse(amtController.text.trim()) ?? 0;
            if (amount <= 0) return;
            Navigator.pop(ctx, (category, amount));
          },
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332)),
          child: const Text("सहेजें", style: TextStyle(color: Colors.white)),
        ),
      ],
    ),
  );
}

class PnlKpiCard extends StatelessWidget {
  final String title;
  final String val;
  final Color color;
  final Color bg;

  const PnlKpiCard({
    super.key,
    required this.title,
    required this.val,
    required this.color,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontSize: 10.5, color: color, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(val, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: color)),
        ],
      ),
    );
  }
}

class PnlStatementItem extends StatelessWidget {
  final String title;
  final String val;
  final Color? color;

  const PnlStatementItem({super.key, required this.title, required this.val, this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 11, color: Colors.grey)),
        Text(val, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color ?? Colors.black87)),
      ],
    );
  }
}
