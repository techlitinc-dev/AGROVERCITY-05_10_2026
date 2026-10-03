// Banker loan review queue — status filters, search, pull-to-refresh.

import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/loans_api.dart';
import '../../models/loan_application.dart';
import '../../state/app_state.dart';
import 'loan_widgets.dart';

class LoanQueueView extends StatefulWidget {
  final AppState state;
  final LoansApi? loansApi;
  const LoanQueueView({super.key, required this.state, this.loansApi});

  @override
  State<LoanQueueView> createState() => _LoanQueueViewState();
}

class _LoanQueueViewState extends State<LoanQueueView> {
  late final LoansApi _api = widget.loansApi ?? LoansApi();

  List<LoanApplication> _loans = [];
  bool _loading = true;
  bool _error = false;
  String _status = '';
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  static const _statuses = [
    '',
    LoanStatus.submitted,
    LoanStatus.underReview,
    LoanStatus.infoRequested,
    LoanStatus.approved,
    LoanStatus.rejected,
    LoanStatus.disbursed,
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final res = await _api.getQueue(
        status: _status,
        q: _searchCtrl.text.trim(),
        pageSize: 50,
      );
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

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _load);
  }

  String _statusLabel(String s) =>
      s.isEmpty ? widget.state.tr('loans.filterAll') : loanStatusLabel(widget.state, s);

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    return RefreshIndicator(
      onRefresh: _load,
      color: const Color(0xFF334155),
      child: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF334155)))
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
              : ListView(
                  physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics(),
                  ),
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
                  children: [
                    Text(state.tr('loans.queueTitle'),
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _searchCtrl,
                      onChanged: _onSearchChanged,
                      textInputAction: TextInputAction.search,
                      onSubmitted: (_) => _load(),
                      decoration: InputDecoration(
                        hintText: state.tr('loans.queueSearchHint'),
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: _searchCtrl.text.isEmpty
                            ? null
                            : IconButton(
                                icon: const Icon(Icons.clear_rounded),
                                onPressed: () {
                                  _searchCtrl.clear();
                                  _load();
                                },
                              ),
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding:
                            const EdgeInsets.symmetric(vertical: 0),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide:
                              BorderSide(color: Colors.grey.shade300),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide:
                              BorderSide(color: Colors.grey.shade300),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      physics: const BouncingScrollPhysics(),
                      child: Row(
                        children: [
                          for (final s in _statuses)
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(_statusLabel(s)),
                                selected: _status == s,
                                onSelected: (_) {
                                  setState(() => _status = s);
                                  _load();
                                },
                                selectedColor: const Color(0xFF334155),
                                labelStyle: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: _status == s
                                      ? Colors.white
                                      : Colors.grey.shade700,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    if (_loans.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 40),
                        child: Center(
                          child: Text(state.tr('loans.queueEmpty'),
                              style: const TextStyle(
                                  color: Colors.grey,
                                  fontWeight: FontWeight.w700)),
                        ),
                      )
                    else
                      for (final loan in _loans)
                        LoanApplicationTile(
                          state: state,
                          loan: loan,
                          title: loan.farmerDisplayName,
                          onTap: () =>
                              state.openLoanReview(loan.applicationId),
                        ),
                  ],
                ),
    );
  }
}
