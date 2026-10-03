// Banker loan review detail — farmer profile, terms, documents, timeline and
// the review/approve/reject/request-info/disburse action bar.

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/loans_api.dart';
import '../../models/loan_application.dart';
import '../../state/app_state.dart';
import 'loan_detail_widgets.dart';
import 'loan_review_sheets.dart';
import 'loan_widgets.dart';

class LoanReviewView extends StatefulWidget {
  final AppState state;
  final LoansApi? loansApi;
  const LoanReviewView({super.key, required this.state, this.loansApi});

  @override
  State<LoanReviewView> createState() => _LoanReviewViewState();
}

class _LoanReviewViewState extends State<LoanReviewView> {
  static const _navy = Color(0xFF334155);

  late final LoansApi _api = widget.loansApi ?? LoansApi();

  LoanApplication? _loan;
  bool _loading = true;
  bool _error = false;

  String? get _loanId => widget.state.selectedLoanId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final id = _loanId;
    if (id == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final loan = await _api.getLoan(id);
      if (!mounted) return;
      setState(() {
        _loan = loan;
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

  void _handleError(ApiException e) {
    _snack(e.message.isNotEmpty ? e.message : e.code);
    if (e.code == 'LOAN_INVALID_TRANSITION') _load();
  }

  Future<void> _startReview() async {
    final loan = _loan;
    if (loan == null) return;
    try {
      final updated = await _api.review(loan.applicationId);
      if (!mounted) return;
      setState(() => _loan = updated);
      _snack(widget.state.tr('loans.reviewStarted'));
    } on ApiException catch (e) {
      _handleError(e);
    }
  }

  Future<void> _approve() async {
    final loan = _loan;
    if (loan == null) return;
    final result = await showLoanApproveDialog(context,
        state: widget.state, loan: loan);
    if (result == null || !mounted) return;
    try {
      final updated = await _api.approve(
        loan.applicationId,
        sanctionedAmount: result.sanctionedAmount,
        interestRate: result.interestRate,
        tenureMonths: result.tenureMonths,
        note: result.note,
      );
      if (!mounted) return;
      setState(() => _loan = updated);
      _snack(widget.state.tr('loans.approvedMsg'));
    } on ApiException catch (e) {
      _handleError(e);
    }
  }

  Future<void> _reject() async {
    final loan = _loan;
    if (loan == null) return;
    final reason = await showLoanRejectDialog(context, state: widget.state);
    if (reason == null || !mounted) return;
    try {
      final updated = await _api.reject(loan.applicationId, reason);
      if (!mounted) return;
      setState(() => _loan = updated);
      _snack(widget.state.tr('loans.rejectedMsg'));
    } on ApiException catch (e) {
      _handleError(e);
    }
  }

  Future<void> _requestInfo() async {
    final loan = _loan;
    if (loan == null) return;
    final message =
        await showLoanInfoRequestDialog(context, state: widget.state);
    if (message == null || !mounted) return;
    try {
      final updated = await _api.requestInfo(loan.applicationId, message);
      if (!mounted) return;
      setState(() => _loan = updated);
      _snack(widget.state.tr('loans.infoRequestedMsg'));
    } on ApiException catch (e) {
      _handleError(e);
    }
  }

  Future<void> _disburse() async {
    final loan = _loan;
    if (loan == null) return;
    final result = await showLoanDisburseDialog(context,
        state: widget.state, loan: loan);
    if (result == null || !mounted) return;
    try {
      final updated = await _api.disburse(
        loan.applicationId,
        disbursementRef: result.disbursementRef,
        disbursedAmount: result.disbursedAmount,
      );
      if (!mounted) return;
      setState(() => _loan = updated);
      _snack(widget.state.tr('loans.disbursedMsg'));
    } on ApiException catch (e) {
      _handleError(e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: _navy));
    }
    final loan = _loan;
    if (_error || loan == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(state.tr('bank.loadFailed'),
                style: const TextStyle(
                    color: Colors.grey, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            ElevatedButton(onPressed: _load, child: Text(state.tr('retry'))),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(loan.farmerDisplayName,
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w900)),
                    if (loan.farmerName != null &&
                        loan.farmerName!.isNotEmpty &&
                        loan.farmerPhone != null)
                      Text(loan.farmerPhone!,
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade600)),
                  ],
                ),
              ),
              loanStatusChip(state, loan.status),
            ],
          ),
          const SizedBox(height: 12),

          // Farmer profile + credit
          LoanSectionCard(
            state: state,
            title: state.tr('loans.creditScore'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (loan.farmerCreditScore != null)
                      Text("${loan.farmerCreditScore}",
                          style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: _navy)),
                    if (loan.farmerCreditTier != null) ...[
                      const SizedBox(width: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: _navy.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(loan.farmerCreditTier!,
                            style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: _navy)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  "${state.tr('loans.assignedOfficer')}: ${loan.assignedOfficerName ?? state.tr('loans.unassigned')}",
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),

          // Requested terms + payout account
          LoanTermsCard(state: state, loan: loan),
          if (loan.bankAccountLast4 != null)
            LoanSectionCard(
              state: state,
              title: state.tr('loans.bankAccount'),
              child: Text(
                "•••• ${loan.bankAccountLast4}${loan.bankIfsc != null ? " • IFSC ${loan.bankIfsc}" : ""}",
                style:
                    const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
              ),
            ),

          // Documents (read-only)
          LoanSectionCard(
            state: state,
            title: state.tr('loans.documentsTitle'),
            child: loan.documents.isEmpty
                ? Text(state.tr('loans.documentsEmpty'),
                    style: TextStyle(
                        fontSize: 12, color: Colors.grey.shade600))
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final doc in loan.documents)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              const Icon(Icons.description_outlined,
                                  size: 16, color: _navy),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(doc.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700)),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
          ),

          if (loan.timeline.isNotEmpty)
            LoanSectionCard(
              state: state,
              title: state.tr('loans.timelineTitle'),
              child: LoanTimelineView(state: state, entries: loan.timeline),
            ),

          const SizedBox(height: 4),
          LoanReviewActionBar(
            state: state,
            loan: loan,
            onStartReview: _startReview,
            onApprove: _approve,
            onRequestInfo: _requestInfo,
            onReject: _reject,
            onDisburse: _disburse,
          ),
        ],
      ),
    );
  }
}
