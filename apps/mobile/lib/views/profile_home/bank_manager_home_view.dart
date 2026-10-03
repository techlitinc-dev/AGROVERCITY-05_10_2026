// Bank Manager home dashboard (11th persona) — review KPIs, status
// breakdown and a preview of the pending loan review queue.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../api/loans_api.dart';
import '../../models/loan_application.dart';
import '../../models/user_profile_type.dart';
import '../../state/app_state.dart';
import '../loans/loan_widgets.dart';

final _inr = NumberFormat('#,##,##0', 'en_IN');

class BankManagerHomeView extends StatefulWidget {
  final AppState state;
  final LoansApi? loansApi;

  const BankManagerHomeView({super.key, required this.state, this.loansApi});

  @override
  State<BankManagerHomeView> createState() => _BankManagerHomeViewState();
}

class _BankManagerHomeViewState extends State<BankManagerHomeView> {
  late final LoansApi _api = widget.loansApi ?? LoansApi();

  Map<String, dynamic>? _stats;
  List<LoanApplication> _pending = [];
  bool _loading = true;
  bool _error = false;

  Color get _primary =>
      UserProfileRegistry.meta(UserProfileType.bankManager).primaryColor;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final results = await Future.wait([
        _api.getStats(),
        _api.getQueue(status: LoanStatus.submitted, pageSize: 3),
      ]);
      if (!mounted) return;
      setState(() {
        _stats = results[0];
        _pending = ((results[1]['data'] as List?) ?? const <dynamic>[])
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

  int _byStatus(String s) =>
      (_stats?['byStatus'] as Map?)?[s] as int? ?? 0;

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final pendingReview = _stats?['pendingReview'] as int? ?? 0;
    final totalApplications = _stats?['totalApplications'] as int? ?? 0;
    final totalSanctioned = _stats?['totalSanctionedAmount'] as num? ?? 0;

    return RefreshIndicator(
      onRefresh: _refresh,
      color: _primary,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
        children: [
          // Greeting header
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [_primary, const Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: _primary.withValues(alpha: 0.35),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.account_balance_rounded,
                        color: Colors.white, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      state.tr('persona.bankManager.label'),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  state.profile.name.isNotEmpty
                      ? state.profile.name
                      : state.tr('persona.bankManager.label'),
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 19,
                      fontWeight: FontWeight.w900),
                ),
                Text(
                  state.tr('persona.bankManager.tagline'),
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.9),
                      fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error)
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(state.tr('bank.loadFailed'),
                      style: const TextStyle(
                          color: Colors.grey, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  ElevatedButton(
                      onPressed: _refresh,
                      child: Text(state.tr('retry'))),
                ],
              ),
            )
          else ...[
            // Stats row
            Row(
              children: [
                _statCard(
                  state.tr('loans.pendingReview'),
                  "$pendingReview",
                  const Color(0xFFD97706),
                ),
                const SizedBox(width: 8),
                _statCard(
                  state.tr('loans.totalApplications'),
                  "$totalApplications",
                  _primary,
                ),
                const SizedBox(width: 8),
                _statCard(
                  state.tr('loans.totalSanctioned'),
                  "₹${_inr.format(totalSanctioned.toInt())}",
                  const Color(0xFF16A34A),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Review queue preview
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(state.tr('loans.reviewQueue'),
                            style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1E293B))),
                      ),
                      GestureDetector(
                        onTap: () => state.navigateTo('loanDashboard'),
                        child: Text(
                          state.tr('loans.viewAll'),
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF334155),
                              decoration: TextDecoration.underline),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (_pending.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(state.tr('loans.queueEmpty'),
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade600)),
                    )
                  else
                    for (final loan in _pending)
                      LoanApplicationTile(
                        state: state,
                        loan: loan,
                        title: loan.farmerDisplayName,
                        onTap: () => state.openLoanReview(loan.applicationId),
                      ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // By-status mini breakdown
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final s in const [
                    LoanStatus.submitted,
                    LoanStatus.underReview,
                    LoanStatus.infoRequested,
                    LoanStatus.approved,
                    LoanStatus.rejected,
                    LoanStatus.disbursed,
                  ])
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              color: loanStatusColor(s),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(loanStatusLabel(state, s),
                                style: const TextStyle(fontSize: 12)),
                          ),
                          Text("${_byStatus(s)}",
                              style: const TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.w900)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.35)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                maxLines: 2,
                style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: Colors.grey.shade600)),
            const SizedBox(height: 4),
            Text(value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w900, color: color)),
          ],
        ),
      ),
    );
  }
}
