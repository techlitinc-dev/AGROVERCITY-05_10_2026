// Banker action dialogs — approve, reject, request-info, disburse, action bar.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../models/loan_application.dart';
import '../../state/app_state.dart';
import 'loan_widgets.dart';

class LoanApproveResult {
  final int sanctionedAmount;
  final double interestRate;
  final int tenureMonths;
  final String? note;
  const LoanApproveResult({
    required this.sanctionedAmount,
    required this.interestRate,
    required this.tenureMonths,
    this.note,
  });
}

class LoanDisburseResult {
  final String disbursementRef;
  final int? disbursedAmount;
  const LoanDisburseResult({required this.disbursementRef, this.disbursedAmount});
}

InputDecoration _fieldDeco(AppState state, String label) => InputDecoration(
      labelText: label,
      border: const OutlineInputBorder(),
      isDense: true,
    );

// Banker action bar — status-dependent review actions.

class LoanReviewActionBar extends StatelessWidget {
  final AppState state;
  final LoanApplication loan;
  final VoidCallback onStartReview;
  final VoidCallback onApprove;
  final VoidCallback onRequestInfo;
  final VoidCallback onReject;
  final VoidCallback onDisburse;

  const LoanReviewActionBar({
    super.key,
    required this.state,
    required this.loan,
    required this.onStartReview,
    required this.onApprove,
    required this.onRequestInfo,
    required this.onReject,
    required this.onDisburse,
  });

  static const _navy = Color(0xFF334155);

  Widget _btn({
    required String label,
    required Color color,
    required VoidCallback onPressed,
    IconData? icon,
  }) {
    return Expanded(
      child: ElevatedButton.icon(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 42),
        ),
        icon: Icon(icon ?? Icons.chevron_right_rounded, size: 16),
        label: Text(label,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = loanStatusColor(loan.status);
    switch (loan.status) {
      case LoanStatus.submitted:
        return Row(children: [
          _btn(
            label: state.tr('loans.startReview'),
            color: _navy,
            icon: Icons.play_arrow_rounded,
            onPressed: onStartReview,
          ),
        ]);
      case LoanStatus.underReview:
        return Column(children: [
          Row(children: [
            _btn(
              label: state.tr('loans.approve'),
              color: const Color(0xFF16A34A),
              icon: Icons.check_rounded,
              onPressed: onApprove,
            ),
            const SizedBox(width: 8),
            _btn(
              label: state.tr('loans.requestInfo'),
              color: const Color(0xFF7C3AED),
              icon: Icons.contact_mail_outlined,
              onPressed: onRequestInfo,
            ),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            _btn(
              label: state.tr('loans.reject'),
              color: const Color(0xFFDC2626),
              icon: Icons.close_rounded,
              onPressed: onReject,
            ),
          ]),
        ]);
      case LoanStatus.approved:
        return Row(children: [
          _btn(
            label: state.tr('loans.disburse'),
            color: const Color(0xFF0F766E),
            icon: Icons.payments_outlined,
            onPressed: onDisburse,
          ),
          const SizedBox(width: 8),
          _btn(
            label: state.tr('loans.reject'),
            color: const Color(0xFFDC2626),
            icon: Icons.close_rounded,
            onPressed: onReject,
          ),
        ]);
      case LoanStatus.infoRequested:
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF3E8FF),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Icon(Icons.hourglass_top_rounded,
                  size: 18, color: statusColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(state.tr('loans.waitingInfoHint'),
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: statusColor)),
              ),
            ],
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}

/// Approve/sanction dialog. Returns the sanction terms, or null when cancelled.
Future<LoanApproveResult?> showLoanApproveDialog(
  BuildContext context, {
  required AppState state,
  required LoanApplication loan,
}) async {
  final amountCtrl = TextEditingController(
      text: loan.sanctionedAmount?.toString() ?? loan.amount.toInt().toString());
  final rateCtrl = TextEditingController(
      text: (loan.interestRate ?? 7).toStringAsFixed(1));
  final tenureCtrl =
      TextEditingController(text: loan.tenureMonths.toString());
  final noteCtrl = TextEditingController();
  final formKey = GlobalKey<FormState>();

  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(state.tr('loans.approveTitle'),
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      content: Form(
        key: formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration:
                    _fieldDeco(state, state.tr('loans.sanctionedAmountLabel')),
                validator: (v) => (v == null || v.trim().isEmpty)
                    ? state.tr('loans.sanctionedAmountLabel')
                    : null,
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: rateCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                ],
                decoration:
                    _fieldDeco(state, "${state.tr('loans.interestRate')} %"),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: tenureCtrl,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: _fieldDeco(state,
                    "${state.tr('loans.tenureLabel')} (${state.tr('loans.monthsUnit')})"),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: noteCtrl,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: state.tr('loans.messageLabel'),
                  border: const OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(state.tr('cancel'))),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A),
              foregroundColor: Colors.white),
          onPressed: () {
            if (formKey.currentState?.validate() != true) return;
            Navigator.pop(ctx, true);
          },
          child: Text(state.tr('loans.approve'),
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
      ],
    ),
  );
  if (ok != true) return null;
  return LoanApproveResult(
    sanctionedAmount: int.tryParse(amountCtrl.text.trim()) ??
        loan.amount.toInt(),
    interestRate: double.tryParse(rateCtrl.text.trim()) ?? 7,
    tenureMonths: int.tryParse(tenureCtrl.text.trim()) ?? loan.tenureMonths,
    note: noteCtrl.text.trim().isEmpty ? null : noteCtrl.text.trim(),
  );
}

/// Reject dialog. Returns the reason, or null when cancelled.
Future<String?> showLoanRejectDialog(
  BuildContext context, {
  required AppState state,
}) async {
  final ctrl = TextEditingController();
  final formKey = GlobalKey<FormState>();
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(state.tr('loans.rejectTitle'),
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      content: Form(
        key: formKey,
        child: TextFormField(
          controller: ctrl,
          maxLines: 3,
          decoration: _fieldDeco(state, state.tr('loans.rejectionReason')),
          validator: (v) => (v == null || v.trim().isEmpty)
              ? state.tr('loans.rejectionReason')
              : null,
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(state.tr('cancel'))),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white),
          onPressed: () {
            if (formKey.currentState?.validate() != true) return;
            Navigator.pop(ctx, true);
          },
          child: Text(state.tr('loans.reject'),
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
      ],
    ),
  );
  if (ok != true) return null;
  return ctrl.text.trim();
}

/// Request-info dialog. Returns the message, or null when cancelled.
Future<String?> showLoanInfoRequestDialog(
  BuildContext context, {
  required AppState state,
}) async {
  final ctrl = TextEditingController();
  final formKey = GlobalKey<FormState>();
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(state.tr('loans.requestInfoTitle'),
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      content: Form(
        key: formKey,
        child: TextFormField(
          controller: ctrl,
          maxLines: 3,
          decoration: _fieldDeco(state, state.tr('loans.messageLabel')),
          validator: (v) =>
              (v == null || v.trim().isEmpty) ? state.tr('loans.messageLabel') : null,
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(state.tr('cancel'))),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF7C3AED),
              foregroundColor: Colors.white),
          onPressed: () {
            if (formKey.currentState?.validate() != true) return;
            Navigator.pop(ctx, true);
          },
          child: Text(state.tr('loans.requestInfo'),
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
      ],
    ),
  );
  if (ok != true) return null;
  return ctrl.text.trim();
}

/// Disburse dialog. Returns the disbursement details, or null when cancelled.
Future<LoanDisburseResult?> showLoanDisburseDialog(
  BuildContext context, {
  required AppState state,
  required LoanApplication loan,
}) async {
  final refCtrl = TextEditingController();
  final amountCtrl = TextEditingController(
      text: loan.sanctionedAmount?.toString() ?? '');
  final formKey = GlobalKey<FormState>();
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(state.tr('loans.disburseTitle'),
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      content: Form(
        key: formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: refCtrl,
              decoration:
                  _fieldDeco(state, state.tr('loans.disbursementRefLabel')),
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? state.tr('loans.disbursementRefLabel')
                  : null,
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: amountCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration:
                  _fieldDeco(state, state.tr('loans.disbursedAmountLabel')),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(state.tr('cancel'))),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0F766E),
              foregroundColor: Colors.white),
          onPressed: () {
            if (formKey.currentState?.validate() != true) return;
            Navigator.pop(ctx, true);
          },
          child: Text(state.tr('loans.disburse'),
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
      ],
    ),
  );
  if (ok != true) return null;
  final amountText = amountCtrl.text.trim();
  return LoanDisburseResult(
    disbursementRef: refCtrl.text.trim(),
    disbursedAmount: amountText.isEmpty ? null : int.tryParse(amountText),
  );
}
