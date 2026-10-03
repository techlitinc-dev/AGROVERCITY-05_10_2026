// Module C: Farm CEO Dashboard & P&L Flutter View (API-wired)

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../api/api_exception.dart';
import '../api/pnl_api.dart';
import '../state/app_state.dart';
import '../models/crop_pnl.dart';
import '../components/common/glass_card.dart';
import 'profit_loss_widgets.dart';

class ProfitLossView extends StatefulWidget {
  final AppState state;
  final PnlApi? pnlApi;
  const ProfitLossView({super.key, required this.state, this.pnlApi});

  @override
  State<ProfitLossView> createState() => _ProfitLossViewState();
}

class _ProfitLossViewState extends State<ProfitLossView> {
  late final PnlApi _api = widget.pnlApi ?? PnlApi();

  Map<String, dynamic> _summary = const {
    'grossIncome': 0,
    'productionCost': 0,
    'netProfit': 0,
  };
  List<CropPandL> _crops = [];
  CropPandL? _selectedCrop;
  bool _loading = true;
  bool _error = false;

  // Break-even calculator
  double _calcTotalCost = 65000;
  double _calcYield = 80;
  double _breakEvenRate = 812; // local estimate until the API answers

  static final _inr = NumberFormat('#,##,##0', 'en_IN');

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final summary = await _api.getSummary();
      final crops = await _api.getCrops();
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _crops = crops;
        if (crops.isNotEmpty) {
          final sel = _selectedCrop;
          _selectedCrop = sel == null
              ? crops.first
              : crops.firstWhere((c) => c.id == sel.id, orElse: () => crops.first);
        }
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _calcBreakEven() async {
    try {
      final rate = await _api.breakEven(_calcTotalCost, _calcYield);
      if (!mounted) return;
      setState(() => _breakEvenRate = rate);
    } catch (_) {
      if (!mounted) return;
      setState(() => _breakEvenRate =
          _calcTotalCost / (_calcYield == 0 ? 1 : _calcYield));
    }
  }

  Future<void> _showAddExpenseDialog() async {
    final selected = _selectedCrop;
    if (selected == null) return;
    final result = await showPnlAddExpenseDialog(context);
    if (result == null || !mounted) return;
    final (category, amount) = result;
    try {
      final updated = await _api.addExpense(selected.id, category, amount);
      if (!mounted) return;
      setState(() {
        _crops = _crops.map((c) => c.id == updated.id ? updated : c).toList();
        _selectedCrop = updated;
      });
      _snack(widget.state.tr('profitLoss.expenseAdded').replaceAll('{amount}', pnlNumStr(amount)));
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 60),
          child: CircularProgressIndicator(color: Color(0xFF43A047)),
        ),
      );
    }

    if (_error) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 60),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                widget.state.tr('profitLoss.loadFailed'),
                style: const TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              ElevatedButton(
                onPressed: _load,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B4332),
                  foregroundColor: Colors.white,
                ),
                child: Text(widget.state.tr('retry')),
              ),
            ],
          ),
        ),
      );
    }

    final totalRev = (_summary['grossIncome'] as num?)?.toDouble() ?? 0;
    final totalExp = (_summary['productionCost'] as num?)?.toDouble() ?? 0;
    final netProfit = (_summary['netProfit'] as num?)?.toDouble() ?? 0;
    final selected = _selectedCrop;

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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.state.tr('profitLoss.headerTitle'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text(widget.state.tr('profitLoss.headerSubtitle'), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              ElevatedButton.icon(
                onPressed: _showAddExpenseDialog,
                icon: const Icon(Icons.add_rounded, size: 16),
                label: Text(widget.state.tr('profitLoss.addExpense'), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // 3 Big KPI Cards
          Row(
            children: [
              Expanded(child: PnlKpiCard(title: widget.state.tr('profitLoss.grossIncome'), val: "₹${(totalRev / 1000).toInt()}k", color: const Color(0xFF166534), bg: const Color(0xFFD8F3DC))),
              const SizedBox(width: 8),
              Expanded(child: PnlKpiCard(title: widget.state.tr('profitLoss.productionCost'), val: "₹${(totalExp / 1000).toInt()}k", color: const Color(0xFF991B1B), bg: const Color(0xFFFEE2E2))),
              const SizedBox(width: 8),
              Expanded(child: PnlKpiCard(title: widget.state.tr('profitLoss.netProfit'), val: "₹${(netProfit / 1000).toInt()}k", color: const Color(0xFF854D0E), bg: const Color(0xFFFEF9C3))),
            ],
          ),
          const SizedBox(height: 16),

          // Crop Selector Pills
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _crops.map((c) {
                final sel = _selectedCrop?.id == c.id;
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
          if (selected != null)
            GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("${selected.name} (${pnlNumStr(selected.area)} ${widget.state.tr('acresUnit')})", style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      PnlStatementItem(title: widget.state.tr('profitLoss.yield'), val: "${pnlNumStr(selected.yieldQuintals)}q"),
                      PnlStatementItem(title: widget.state.tr('profitLoss.saleRate'), val: "₹${pnlNumStr(selected.marketAvgRate)}/q"),
                      PnlStatementItem(title: widget.state.tr('profitLoss.netProfit'), val: "₹${pnlNumStr(selected.netProfit)}", color: const Color(0xFF16A34A)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text("${widget.state.tr('profitLoss.expensesBreakdown')}:", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  ...selected.expensesBreakdown.map((exp) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(exp['category'] as String, style: const TextStyle(fontSize: 11.5, color: Colors.black87)),
                          Text("₹${pnlNumStr(exp['amount'] as num? ?? 0)}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
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
                Slider(
                  min: 20000,
                  max: 120000,
                  value: _calcTotalCost,
                  activeColor: const Color(0xFFD97706),
                  onChanged: (v) => setState(() {
                    _calcTotalCost = v;
                    _breakEvenRate = v / (_calcYield == 0 ? 1 : _calcYield);
                  }),
                  onChangeEnd: (_) => _calcBreakEven(),
                ),
                Text("अपेक्षित पैदावार: ${_calcYield.toInt()} क्विंटल", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                Slider(
                  min: 20,
                  max: 180,
                  value: _calcYield,
                  activeColor: const Color(0xFFD97706),
                  onChanged: (v) => setState(() {
                    _calcYield = v;
                    _breakEvenRate = _calcTotalCost / (v == 0 ? 1 : v);
                  }),
                  onChangeEnd: (_) => _calcBreakEven(),
                ),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text("सुरक्षित न्यूनतम भाव:", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                      Text("₹${_inr.format(_breakEvenRate.toInt())} / क्विंटल", style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFFD97706))),
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
}
