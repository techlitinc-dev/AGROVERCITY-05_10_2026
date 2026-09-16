// Module C: Farm CEO Dashboard & P&L Flutter View

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../data/demo_data.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';

class ProfitLossView extends StatefulWidget {
  final AppState state;
  const ProfitLossView({super.key, required this.state});

  @override
  State<ProfitLossView> createState() => _ProfitLossViewState();
}

class _ProfitLossViewState extends State<ProfitLossView> {
  CropPandL _selectedCrop = dummyCropPandL[0];

  // Break-even calculator
  double _calcTotalCost = 65000;
  double _calcYield = 80;

  void _showAddExpenseDialog() {
    final titleController = TextEditingController();
    final amtController = TextEditingController();

    showDialog(
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
              Navigator.pop(ctx);
              widget.state.showToast("खर्च ₹${amtController.text} फार्म P&L में जोड़ा गया!");
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332)),
            child: const Text("सहेजें", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalRev = dummyCropPandL.fold(0, (sum, c) => sum + c.grossRevenue);
    final totalExp = dummyCropPandL.fold(0, (sum, c) => sum + c.totalExpenses);
    final netProfit = totalRev - totalExp;
    final breakEvenRate = (_calcTotalCost / (_calcYield == 0 ? 1 : _calcYield)).toInt();

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("फार्म CEO डैशबोर्ड व P&L", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text("खेती का लाभ-हानि खाता • कैश फ्लो • ब्रेक-ईवन", style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              ElevatedButton.icon(
                onPressed: _showAddExpenseDialog,
                icon: const Icon(Icons.add_rounded, size: 16),
                label: const Text("खर्च जोड़ें", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // 3 Big KPI Cards
          Row(
            children: [
              Expanded(child: _kpiCard("सकल आय (Gross)", "₹${(totalRev / 1000).toInt()}k", const Color(0xFF166534), const Color(0xFFD8F3DC))),
              const SizedBox(width: 8),
              Expanded(child: _kpiCard("उत्पादन लागत", "₹${(totalExp / 1000).toInt()}k", const Color(0xFF991B1B), const Color(0xFFFEE2E2))),
              const SizedBox(width: 8),
              Expanded(child: _kpiCard("शुद्ध लाभ (Net)", "₹${(netProfit / 1000).toInt()}k", const Color(0xFF854D0E), const Color(0xFFFEF9C3))),
            ],
          ),
          const SizedBox(height: 16),

          // Crop Selector Pills
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: dummyCropPandL.map((c) {
                final sel = _selectedCrop.id == c.id;
                return GestureDetector(
                  onTap: () => setState(() => _selectedCrop = c),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: sel ? const Color(0xFF1B4332) : Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: sel ? const Color(0xFF1B4332) : Colors.grey.shade300),
                    ),
                    child: Text(c.name.split(' - ')[0], style: TextStyle(fontSize: 12, fontWeight: sel ? FontWeight.w800 : FontWeight.w600, color: sel ? Colors.white : Colors.black87)),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 14),

          // Crop Statement Card
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("${_selectedCrop.name} (${_selectedCrop.area})", style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _item("उपज", "${_selectedCrop.yieldQuintals}q"),
                    _item("बिक्री भाव", "₹${_selectedCrop.marketAvgRate}/q"),
                    _item("शुद्ध लाभ", "₹${_selectedCrop.netProfit}", color: const Color(0xFF16A34A)),
                  ],
                ),
                const SizedBox(height: 12),
                const Text("लागत मदवार विवरण (Expenses Breakdown):", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                ..._selectedCrop.expensesBreakdown.map((exp) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(exp['category'] as String, style: const TextStyle(fontSize: 11.5, color: Colors.black87)),
                        Text("₹${exp['amount']}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Pre-Sowing Break-Even Tool
          GlassCard(
            backgroundColor: const Color(0xFFFFFBEB),
            border: Border.all(color: const Color(0xFFFDE68A)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("बुवाई पूर्व ब्रेक-ईवन कैलकुलेटर", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF78350F))),
                const Text("लागत निकालने हेतु आवश्यक न्यूनतम भाव", style: TextStyle(fontSize: 11.5, color: Color(0xFF92400E))),
                const SizedBox(height: 10),
                Text("कुल उत्पादन लागत: ₹${_calcTotalCost.toInt()}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                Slider(min: 20000, max: 120000, value: _calcTotalCost, onChanged: (v) => setState(() => _calcTotalCost = v), activeColor: const Color(0xFFD97706)),
                Text("अपेक्षित पैदावार: ${_calcYield.toInt()} क्विंटल", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                Slider(min: 20, max: 180, value: _calcYield, onChanged: (v) => setState(() => _calcYield = v), activeColor: const Color(0xFFD97706)),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text("सुरक्षित न्यूनतम भाव:", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                      Text("₹$breakEvenRate / क्विंटल", style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFFD97706))),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _kpiCard(String title, String val, Color c, Color bg) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontSize: 10.5, color: c, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(val, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: c)),
        ],
      ),
    );
  }

  Widget _item(String title, String val, {Color? color}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 11, color: Colors.grey)),
        Text(val, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color ?? Colors.black87)),
      ],
    );
  }
}
