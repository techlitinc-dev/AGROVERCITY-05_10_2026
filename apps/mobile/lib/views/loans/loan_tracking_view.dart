// Farmer "My Loans" tracking list — status filter chips + pull-to-refresh.

import 'package:flutter/material.dart';

import '../../api/loans_api.dart';
import '../../models/loan_application.dart';
import '../../state/app_state.dart';
import 'loan_widgets.dart';

class LoanTrackingView extends StatefulWidget {
  final AppState state;
  final LoansApi? loansApi;
  const LoanTrackingView({super.key, required this.state, this.loansApi});

  @override
  State<LoanTrackingView> createState() => _LoanTrackingViewState();
}

class _LoanTrackingViewState extends State<LoanTrackingView> {
  late final LoansApi _api = widget.loansApi ?? LoansApi();

  List<LoanApplication> _loans = [];
  bool _loading = true;
  bool _error = false;
  String _filter = 'all';

  static const _filters = ['all', 'active', 'approved', 'rejected', 'closed'];

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
      final res = await _api.listMine();
      if (!mounted) return;
      setState(() {
        _loans = ((res['data'] as List?) ?? const <dynamic>[])
            .map((e) =>
                LoanApplication.fromJson((e as Map).cast<String, dynamic>()))
            .toList();
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

  bool _matches(LoanApplication loan) => switch (_filter) {
        'active' => loan.status == LoanStatus.submitted ||
            loan.status == LoanStatus.underReview ||
            loan.status == LoanStatus.infoRequested,
        'approved' => loan.status == LoanStatus.approved ||
            loan.status == LoanStatus.disbursed,
        'rejected' => loan.status == LoanStatus.rejected,
        'closed' => loan.status == LoanStatus.cancelled,
        _ => true,
      };

  String _filterLabel(String f) => switch (f) {
        'active' => widget.state.tr('loans.active'),
        'approved' => widget.state.tr('loans.approved'),
        'rejected' => widget.state.tr('loans.statusRejected'),
        'closed' => widget.state.tr('loans.filterClosed'),
        _ => widget.state.tr('loans.filterAll'),
      };

  List<LoanApplication> get _visible =>
      _loans.where(_matches).toList(growable: false);

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    return RefreshIndicator(
      onRefresh: _load,
      color: const Color(0xFF43A047),
      child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF43A047)))
            : _error
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      const SizedBox(height: 160),
                      Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(state.tr('bank.loadFailed'),
                                style: const TextStyle(
                                    color: Colors.grey,
                                    fontWeight: FontWeight.w700)),
                            const SizedBox(height: 10),
                            ElevatedButton(
                                onPressed: _load,
                                child: Text(state.tr('retry'))),
                          ],
                        ),
                      ),
                    ],
                  )
                : _loans.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          const SizedBox(height: 140),
                          Icon(Icons.savings_outlined,
                              size: 56, color: Colors.grey.shade400),
                          const SizedBox(height: 12),
                          Center(
                            child: Text(state.tr('loans.empty'),
                                style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.grey)),
                          ),
                          const SizedBox(height: 4),
                          Center(
                            child: Text(state.tr('loans.emptySub'),
                                style: TextStyle(
                                    fontSize: 12, color: Colors.grey.shade500)),
                          ),
                          const SizedBox(height: 14),
                          Center(
                            child: ElevatedButton.icon(
                              onPressed: () => state.navigateTo('finance'),
                              style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF1B4332),
                                  foregroundColor: Colors.white),
                              icon: const Icon(Icons.add_rounded, size: 16),
                              label: Text(state.tr('applyNow'),
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800)),
                            ),
                          ),
                        ],
                      )
                    : ListView(
                        physics: const AlwaysScrollableScrollPhysics(
                          parent: BouncingScrollPhysics(),
                        ),
                        padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
                        children: [
                          Text(state.tr('loans.myLoans'),
                              style: const TextStyle(
                                  fontSize: 20, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 12),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            physics: const BouncingScrollPhysics(),
                            child: Row(
                              children: [
                                for (final f in _filters)
                                  Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: ChoiceChip(
                                      label: Text(_filterLabel(f)),
                                      selected: _filter == f,
                                      onSelected: (_) =>
                                          setState(() => _filter = f),
                                      selectedColor: const Color(0xFF1B4332),
                                      labelStyle: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        color: _filter == f
                                            ? Colors.white
                                            : Colors.grey.shade700,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                          if (_visible.isEmpty)
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 40),
                              child: Center(
                                child: Text(state.tr('loans.noResults'),
                                    style: const TextStyle(
                                        color: Colors.grey,
                                        fontWeight: FontWeight.w700)),
                              ),
                            )
                          else
                            for (final loan in _visible)
                              LoanApplicationTile(
                                state: state,
                                loan: loan,
                                onTap: () => state.openLoanDetail(
                                    loan.applicationId),
                              ),
                        ],
                      ),
    );
  }
}
