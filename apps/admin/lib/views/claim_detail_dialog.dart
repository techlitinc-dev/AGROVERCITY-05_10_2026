import 'package:flutter/material.dart';

import '../core/claim_transitions.dart';

class ClaimAdvanceResult {
  ClaimAdvanceResult({
    required this.newStatus,
    this.approvedAmount,
    this.dbtTransactionId,
    this.note = '',
  });

  final String newStatus;
  final double? approvedAmount;
  final String? dbtTransactionId;
  final String note;
}

class ClaimDetailDialog extends StatefulWidget {
  const ClaimDetailDialog({super.key, required this.claim});

  final Map<String, dynamic> claim;

  @override
  State<ClaimDetailDialog> createState() => _ClaimDetailDialogState();
}

class _ClaimDetailDialogState extends State<ClaimDetailDialog> {
  final _amount = TextEditingController();
  final _dbtId = TextEditingController();
  final _note = TextEditingController();
  String? _nextStatus;

  String get _current => '${widget.claim['status']}';

  List<String> get _options {
    final legal = claimTransitions[_current] ?? const <String>[];
    return [
      ...legal,
      ...claimStatuses.where((s) => s != _current && !legal.contains(s)),
    ];
  }

  @override
  void initState() {
    super.initState();
    _nextStatus = _options.isEmpty ? null : _options.first;
  }

  @override
  void dispose() {
    _amount.dispose();
    _dbtId.dispose();
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final timeline = (widget.claim['timeline'] as List? ?? []);
    return AlertDialog(
      title: Text('दावा ${widget.claim['claimNumber'] ?? widget.claim['id']}'),
      content: SizedBox(
        width: 480,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('टाइमलाइन',
                  style: Theme.of(context).textTheme.titleMedium),
              for (final t in timeline)
                ListTile(
                  dense: true,
                  title: Text(claimStatusLabels['${t['status']}'] ??
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
                  decoration:
                      const InputDecoration(labelText: 'नई स्थिति'),
                  items: [
                    for (final s in _options)
                      DropdownMenuItem(
                        value: s,
                        child: Text(claimStatusLabels[s] ?? s),
                      ),
                  ],
                  onChanged: (v) => setState(() => _nextStatus = v),
                ),
                if (_nextStatus == 'disbursed') ...[
                  TextField(
                    controller: _amount,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'स्वीकृत राशि'),
                  ),
                  TextField(
                    controller: _dbtId,
                    decoration: const InputDecoration(
                        labelText: 'DBT लेनदेन आईडी'),
                  ),
                ],
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
                      ClaimAdvanceResult(
                        newStatus: _nextStatus!,
                        approvedAmount: _nextStatus == 'disbursed'
                            ? double.tryParse(_amount.text.trim())
                            : null,
                        dbtTransactionId: _nextStatus == 'disbursed'
                            ? _dbtId.text.trim()
                            : null,
                        note: _note.text.trim(),
                      ),
                    ),
            child: const Text('आगे बढ़ाएं'),
          ),
      ],
    );
  }
}
