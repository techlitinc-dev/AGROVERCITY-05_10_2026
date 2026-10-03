import 'package:flutter/material.dart';

import '../core/loan_transitions.dart';

class LoanAdvanceResult {
  LoanAdvanceResult({required this.newStatus, this.note = ''});

  final String newStatus;
  final String note;
}

class LoanDetailDialog extends StatefulWidget {
  const LoanDetailDialog({super.key, required this.loan});

  final Map<String, dynamic> loan;

  @override
  State<LoanDetailDialog> createState() => _LoanDetailDialogState();
}

class _LoanDetailDialogState extends State<LoanDetailDialog> {
  final _note = TextEditingController();
  String? _nextStatus;

  String get _current => '${widget.loan['status']}';

  List<String> get _options {
    final legal = loanTransitions[_current] ?? const <String>[];
    return [
      ...legal,
      ...loanStatuses.where((s) => s != _current && !legal.contains(s)),
    ];
  }

  @override
  void initState() {
    super.initState();
    _nextStatus = _options.isEmpty ? null : _options.first;
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final loan = widget.loan;
    final timeline = (loan['timeline'] as List? ?? []);
    return AlertDialog(
      title: Text('ऋण ${loan['applicationNumber'] ?? loan['applicationId']}'),
      content: SizedBox(
        width: 480,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('विवरण', style: Theme.of(context).textTheme.titleMedium),
              ListTile(
                dense: true,
                title: Text('${loan['farmerName'] ?? ''}'),
                subtitle: Text(
                  '${loan['farmerPhone'] ?? ''} · ${loan['purpose'] ?? ''}',
                ),
              ),
              ListTile(
                dense: true,
                title: Text('₹${loan['amount'] ?? ''} · ${loan['tenureMonths'] ?? ''} माह'),
                subtitle: Text(
                  'स्कोर: ${loan['farmerCreditScore'] ?? '-'} (${loan['farmerCreditTier'] ?? '-'})',
                ),
              ),
              if (loan['sanctionedAmount'] != null)
                ListTile(
                  dense: true,
                  title: Text('स्वीकृत राशि: ₹${loan['sanctionedAmount']}'),
                  subtitle: Text(
                    'ब्याज दर: ${loan['interestRate'] ?? '-'}%',
                  ),
                ),
              if (loan['bankAccountLast4'] != null)
                ListTile(
                  dense: true,
                  title: Text('खाता: XXXX${loan['bankAccountLast4']}'),
                  subtitle: Text('IFSC: ${loan['bankIfsc'] ?? '-'}'),
                ),
              if (loan['rejectionReason'] != null)
                ListTile(
                  dense: true,
                  title: Text('अस्वीकृति कारण'),
                  subtitle: Text('${loan['rejectionReason']}'),
                ),
              const Divider(),
              Text('टाइमलाइन', style: Theme.of(context).textTheme.titleMedium),
              for (final t in timeline)
                ListTile(
                  dense: true,
                  title: Text(loanStatusLabels['${t['status']}'] ??
                      '${t['status']}'),
                  subtitle: Text('${t['at'] ?? ''} ${t['note'] ?? ''}'),
                ),
              const Divider(),
              Text('स्थिति आगे बढ़ाएं',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (_options.isEmpty)
                const Text('इस स्थिति से आगे कोई परिवर्तन नहीं')
              else ...[
                DropdownButtonFormField<String>(
                  initialValue: _nextStatus,
                  decoration: const InputDecoration(labelText: 'नई स्थिति'),
                  items: [
                    for (final s in _options)
                      DropdownMenuItem(
                        value: s,
                        child: Text(loanStatusLabels[s] ?? s),
                      ),
                  ],
                  onChanged: (v) => setState(() => _nextStatus = v),
                ),
                TextField(
                  controller: _note,
                  decoration: const InputDecoration(labelText: 'टिप्पणी'),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('बंद करें'),
        ),
        if (_options.isNotEmpty)
          FilledButton(
            onPressed: _nextStatus == null
                ? null
                : () => Navigator.pop(
                      context,
                      LoanAdvanceResult(
                        newStatus: _nextStatus!,
                        note: _note.text.trim(),
                      ),
                    ),
            child: const Text('आगे बढ़ाएं'),
          ),
      ],
    );
  }
}
