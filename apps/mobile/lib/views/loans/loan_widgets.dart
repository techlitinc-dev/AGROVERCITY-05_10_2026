// Shared loan widgets — status colors/labels, date formatting, tiles.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/loan_application.dart';
import '../../state/app_state.dart';

final _inr = NumberFormat('#,##,##0', 'en_IN');
final _dayFmt = DateFormat('dd MMM yyyy');

Color loanStatusColor(String status) => switch (status) {
      LoanStatus.submitted => const Color(0xFFD97706),
      LoanStatus.underReview => const Color(0xFF2563EB),
      LoanStatus.infoRequested => const Color(0xFF7C3AED),
      LoanStatus.approved => const Color(0xFF16A34A),
      LoanStatus.rejected => const Color(0xFFDC2626),
      LoanStatus.disbursed => const Color(0xFF0F766E),
      LoanStatus.cancelled => Colors.grey,
      _ => Colors.grey,
    };

String loanStatusLabel(AppState state, String status) => switch (status) {
      LoanStatus.submitted => state.tr('loans.statusSubmitted'),
      LoanStatus.underReview => state.tr('loans.statusUnderReview'),
      LoanStatus.infoRequested => state.tr('loans.statusInfoRequested'),
      LoanStatus.approved => state.tr('loans.statusApproved'),
      LoanStatus.rejected => state.tr('loans.statusRejected'),
      LoanStatus.disbursed => state.tr('loans.statusDisbursed'),
      LoanStatus.cancelled => state.tr('loans.statusCancelled'),
      _ => status,
    };

/// Formats an ISO-8601 backend timestamp as `dd MMM yyyy`; falls back to the
/// raw string when parsing fails.
String formatLoanDate(String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return iso;
  return _dayFmt.format(dt.toLocal());
}

Widget loanStatusChip(AppState state, String status) {
  final color = loanStatusColor(status);
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Text(loanStatusLabel(state, status),
        style:
            TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color)),
  );
}

/// List tile card used by the farmer tracking list and the banker queue.
class LoanApplicationTile extends StatelessWidget {
  final AppState state;
  final LoanApplication loan;
  final VoidCallback? onTap;

  /// Defaults to the loan purpose (farmer view). Pass a farmer name for the
  /// banker queue.
  final String? title;

  const LoanApplicationTile({
    super.key,
    required this.state,
    required this.loan,
    this.onTap,
    this.title,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.03), blurRadius: 8),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title ?? loan.purpose,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1E293B)),
                  ),
                ),
                loanStatusChip(state, loan.status),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              "₹${_inr.format(loan.amount.toInt())}"
              "${loan.applicationNumber != null && loan.applicationNumber!.isNotEmpty ? " • #${loan.applicationNumber}" : ""}",
              style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1B4332)),
            ),
            const SizedBox(height: 2),
            Text(
              "${formatLoanDate(loan.createdAt)} • ${loan.tenureMonths} ${state.tr('loans.monthsUnit')}",
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    );
  }
}
