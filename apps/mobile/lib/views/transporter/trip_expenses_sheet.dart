import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../api/api_exception.dart';
import '../../api/transport_api.dart';
import '../../state/app_state.dart';

class TripExpensesSheet extends StatefulWidget {
  final AppState state;
  final String bookingId;
  final double grossFare;
  final TransportApi api;

  const TripExpensesSheet({
    super.key,
    required this.state,
    required this.bookingId,
    required this.grossFare,
    required this.api,
  });

  @override
  State<TripExpensesSheet> createState() => _TripExpensesSheetState();
}

class _TripExpensesSheetState extends State<TripExpensesSheet> {
  bool _loading = true;
  bool _adding = false;
  Map<String, dynamic> _summary = {};
  List<Map<String, dynamic>> _expenses = [];

  final _amountCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String _category = 'diesel';

  static const _categoryLabels = {
    'diesel': 'डीजल (Fuel)',
    'toll': 'टोल टैक्स (Toll Plaza)',
    'driver_bata': 'चालक दैनिक भत्ता (Bata)',
    'loading_labor': 'हमाली / पल्लेदारी (Labor)',
    'mandi_cess': 'मंडी प्रवेश फीस (Mandi Cess)',
    'maintenance': 'टायर / पंचर / मरम्मत',
    'other': 'अन्य विविध खर्च',
  };

  @override
  void initState() {
    super.initState();
    _loadExpenses();
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadExpenses() async {
    try {
      final res = await widget.api.getTripExpenses(widget.bookingId);
      if (!mounted) return;
      setState(() {
        _summary = res;
        _expenses =
            ((res['expenses'] as List?)?.cast<Map<String, dynamic>>()) ?? [];
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _addExpense() async {
    final amount = double.tryParse(_amountCtrl.text.trim());
    if (amount == null || amount <= 0) {
      widget.state.showToast("कृपया उचित खर्च राशि दर्ज करें");
      return;
    }

    setState(() => _adding = true);
    try {
      await widget.api.addTripExpense(
        widget.bookingId,
        category: _category,
        amount: amount,
        notes: _notesCtrl.text.trim(),
      );
      _amountCtrl.clear();
      _notesCtrl.clear();
      widget.state.showToast("खर्च दर्ज हुआ ✅");
      _loadExpenses();
    } on ApiException catch (e) {
      widget.state.showToast(e.message.isNotEmpty ? e.message : e.code);
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF0284C7);
    final gross = (widget.grossFare > 0)
        ? widget.grossFare
        : ((_summary['grossFare'] as num?)?.toDouble() ?? 1200.0);
    final totalExpenses =
        (_summary['totalExpenses'] as num?)?.toDouble() ?? 0.0;
    final commission = (_summary['platformCommission'] as num?)?.toDouble() ??
        (gross * 0.05);
    final netProfit =
        (_summary['netProfit'] as num?)?.toDouble() ?? (gross - totalExpenses - commission);

    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                "ट्रिप खर्च व शुद्ध मुनाफा (Profit Ledger)",
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Profit Summary Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: netProfit >= 0
                    ? [const Color(0xFF16A34A), const Color(0xFF15803D)]
                    : [const Color(0xFFDC2626), const Color(0xFFB91C1C)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "शुद्ध ट्रिप मुनाफा (Net Profit):",
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700),
                    ),
                    Text(
                      "₹${NumberFormat.decimalPattern('en_IN').format(netProfit.round())}",
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      "कुल भाड़ा: ₹${NumberFormat.decimalPattern('en_IN').format(gross.round())}",
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.9),
                          fontSize: 11),
                    ),
                    Text(
                      "कुल खर्च: ₹${NumberFormat.decimalPattern('en_IN').format(totalExpenses.round())}",
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.9),
                          fontSize: 11),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Add Expense Form
          Row(
            children: [
              Expanded(
                flex: 3,
                child: DropdownButtonFormField<String>(
                  initialValue: _category,
                  decoration: const InputDecoration(
                    labelText: "खर्च प्रकार",
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                  ),
                  items: _categoryLabels.entries
                      .map((e) => DropdownMenuItem(
                            value: e.key,
                            child: Text(e.value,
                                style: const TextStyle(fontSize: 12)),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _category = v ?? _category),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _amountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: "रुपये (₹)",
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _notesCtrl,
                  decoration: const InputDecoration(
                    labelText: "विवरण / पंप नाम (वैकल्पिक)",
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _adding ? null : _addExpense,
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(_adding ? "..." : "+ जोड़ें",
                    style: const TextStyle(fontWeight: FontWeight.w900)),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Expense List
          const Text(
            "दर्ज खर्च विवरण (Logged Expenses):",
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w900,
                color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 6),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_expenses.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Center(
                child: Text("इस ट्रिप में अभी कोई खर्च दर्ज नहीं है",
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ),
            )
          else
            ..._expenses.map((exp) {
              final cat = "${exp['category']}";
              final label = _categoryLabels[cat] ?? cat;
              final amt = (exp['amount'] as num?) ?? 0;
              return Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label,
                            style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF1E293B))),
                        if (exp['notes'] != null &&
                            "${exp['notes']}".isNotEmpty)
                          Text("${exp['notes']}",
                              style: TextStyle(
                                  fontSize: 11, color: Colors.grey.shade600)),
                      ],
                    ),
                    Text(
                      "₹${NumberFormat.decimalPattern('en_IN').format(amt)}",
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFDC2626)),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
