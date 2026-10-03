// Loan detail widgets — section cards, timeline, schedule, dialogs.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/loan_application.dart';
import '../../models/loan_schedule_entry.dart';
import '../../state/app_state.dart';
import 'loan_widgets.dart';

final _inr = NumberFormat('#,##,##0', 'en_IN');

class LoanSectionCard extends StatelessWidget {
  final AppState state;
  final String title;
  final Widget child;
  const LoanSectionCard({
    super.key,
    required this.state,
    required this.title,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
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
          Text(title,
              style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1E293B))),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

Widget loanKvRow(String k, String v, {Color? valueColor}) => Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 128,
            child: Text(k,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          ),
          Expanded(
            child: Text(v,
                style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: valueColor ?? const Color(0xFF1E293B))),
          ),
        ],
      ),
    );

class LoanTermsCard extends StatelessWidget {
  final AppState state;
  final LoanApplication loan;
  const LoanTermsCard({super.key, required this.state, required this.loan});

  @override
  Widget build(BuildContext context) {
    final sanctioned = loan.status == LoanStatus.approved ||
        loan.status == LoanStatus.disbursed;
    return LoanSectionCard(
      state: state,
      title: state.tr('loans.termsTitle'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "₹${_inr.format(loan.amount.toInt())}",
            style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: Color(0xFF1B4332)),
          ),
          const SizedBox(height: 8),
          loanKvRow(state.tr('loans.tenureLabel'),
              "${loan.tenureMonths} ${state.tr('loans.monthsUnit')}"),
          loanKvRow(state.tr('loans.purpose'), loan.purpose),
          if (loan.applicationNumber != null &&
              loan.applicationNumber!.isNotEmpty)
            loanKvRow(
                state.tr('loans.applicationNo'), "#${loan.applicationNumber}"),
          loanKvRow(state.tr('loans.appliedOn'), formatLoanDate(loan.createdAt)),
          if (sanctioned && loan.sanctionedAmount != null) ...[
            const Divider(height: 18),
            Text(state.tr('loans.sanctionedTerms'),
                style: const TextStyle(
                    fontSize: 12.5, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            loanKvRow(state.tr('loans.sanctionedAmountLabel'),
                "₹${_inr.format(loan.sanctionedAmount!)}"),
            if (loan.interestRate != null)
              loanKvRow(state.tr('loans.interestRate'),
                  "${loan.interestRate}%"),
          ],
        ],
      ),
    );
  }
}

class LoanTimelineView extends StatelessWidget {
  final AppState state;
  final List<LoanTimelineEntry> entries;
  const LoanTimelineView({super.key, required this.state, required this.entries});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < entries.length; i++)
          _entryTile(entries[i], isLast: i == entries.length - 1),
      ],
    );
  }

  Widget _entryTile(LoanTimelineEntry e, {required bool isLast}) {
    final color = loanStatusColor(e.status);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              Container(
                width: 12,
                height: 12,
                margin: const EdgeInsets.only(top: 3),
                decoration:
                    BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              if (!isLast)
                Expanded(
                  child: Container(width: 2, color: color.withValues(alpha: 0.3)),
                ),
            ],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(e.statusText,
                      style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w900,
                          color: color)),
                  if (e.note != null && e.note!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(e.note!,
                          style: const TextStyle(
                              fontSize: 11.5, color: Color(0xFF4B5563))),
                    ),
                  Text(formatLoanDate(e.at),
                      style: TextStyle(
                          fontSize: 10.5, color: Colors.grey.shade500)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class LoanScheduleTable extends StatelessWidget {
  final AppState state;
  final List<LoanScheduleEntry> entries;
  const LoanScheduleTable({super.key, required this.state, required this.entries});

  static const _headStyle =
      TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: Color(0xFF6B7280));
  static const _cellStyle =
      TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF1E293B));

  @override
  Widget build(BuildContext context) {
    Widget cell(String text, {bool header = false, bool right = false}) =>
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Text(
            text,
            textAlign: right ? TextAlign.right : TextAlign.left,
            style: header ? _headStyle : _cellStyle,
          ),
        );

    return Column(
      children: [
        Row(children: [
          Expanded(child: cell(state.tr('loans.scheduleNo'), header: true)),
          Expanded(
              flex: 2,
              child: cell(state.tr('loans.scheduleDueDate'), header: true)),
          Expanded(
              child: cell(state.tr('loans.scheduleEmi'),
                  header: true, right: true)),
        ]),
        const Divider(height: 1),
        for (final e in entries)
          Row(children: [
            Expanded(child: cell("${e.installmentNo}")),
            Expanded(flex: 2, child: cell(formatLoanDate(e.dueDate))),
            Expanded(child: cell(_inr.format(e.emi), right: true)),
          ]),
        const Divider(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(state.tr('loans.schedulePrincipal'),
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
            Text(
                _inr.format(entries.fold<int>(0, (s, e) => s + e.principal)),
                style: const TextStyle(
                    fontSize: 11.5, fontWeight: FontWeight.w800)),
          ],
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(state.tr('loans.scheduleInterest'),
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
            Text(
                _inr.format(entries.fold<int>(0, (s, e) => s + e.interest)),
                style: const TextStyle(
                    fontSize: 11.5, fontWeight: FontWeight.w800)),
          ],
        ),
      ],
    );
  }
}

/// Document list + upload entry points for the farmer loan detail screen.
class LoanDocumentsSection extends StatelessWidget {
  final AppState state;
  final List<LoanDocument> documents;
  final bool uploading;
  final VoidCallback onUploadImages;
  final VoidCallback onUploadPdf;

  const LoanDocumentsSection({
    super.key,
    required this.state,
    required this.documents,
    required this.uploading,
    required this.onUploadImages,
    required this.onUploadPdf,
  });

  @override
  Widget build(BuildContext context) {
    return LoanSectionCard(
      state: state,
      title: state.tr('loans.documentsTitle'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (documents.isEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(state.tr('loans.documentsEmpty'),
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            )
          else
            for (final doc in documents)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    const Icon(Icons.description_outlined,
                        size: 16, color: Color(0xFF1B4332)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(doc.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700)),
                          Text(formatLoanDate(doc.uploadedAt),
                              style: TextStyle(
                                  fontSize: 10.5,
                                  color: Colors.grey.shade500)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: uploading ? null : onUploadImages,
                  icon: const Icon(Icons.photo_library_outlined, size: 16),
                  label: Text(state.tr('loans.uploadPickImage'),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: uploading ? null : onUploadPdf,
                  icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
                  label: Text(state.tr('loans.uploadPickPdf'),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
          if (uploading)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Center(
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Color(0xFF43A047)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Dialog with a single multi-line message field; returns the message when
/// confirmed, null when cancelled.
Future<String?> showLoanMessageDialog(
  BuildContext context, {
  required AppState state,
  required String title,
}) async {
  final ctrl = TextEditingController();
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(title,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      content: TextField(
        controller: ctrl,
        maxLines: 4,
        decoration: InputDecoration(
          labelText: state.tr('loans.messageLabel'),
          border: const OutlineInputBorder(),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(state.tr('cancel'))),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1B4332),
              foregroundColor: Colors.white),
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(state.tr('loans.respond'),
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
      ],
    ),
  );
  if (result != true) return null;
  final message = ctrl.text.trim();
  return message.isEmpty ? null : message;
}

/// Destructive-action confirm dialog mirroring the lease-requests pattern.
Future<bool> showLoanConfirmDialog(
  BuildContext context, {
  required AppState state,
  required String title,
  required String confirmLabel,
  String? body,
  Color confirmColor = const Color(0xFFDC2626),
}) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(title,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      content: body == null ? null : Text(body),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(state.tr('back'))),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
              backgroundColor: confirmColor, foregroundColor: Colors.white),
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(confirmLabel,
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
      ],
    ),
  );
  return confirmed == true;
}
