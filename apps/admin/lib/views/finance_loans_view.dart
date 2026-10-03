import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';
import '../core/loan_transitions.dart';
import 'loan_detail_dialog.dart';

class FinanceLoansView extends StatefulWidget {
  const FinanceLoansView({super.key});

  @override
  State<FinanceLoansView> createState() => _FinanceLoansViewState();
}

class _FinanceLoansViewState extends State<FinanceLoansView> {
  String _status = '';
  List<Map<String, dynamic>>? _loans;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await context
          .read<AdminApi>()
          .getFinanceLoans(status: _status.isEmpty ? null : _status);
      setState(() {
        _loans = (res['data'] as List? ?? [])
            .map((e) => (e as Map).cast<String, dynamic>())
            .toList();
        _error = null;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.code);
    }
  }

  Future<void> _openDetail(Map<String, dynamic> loan) async {
    final api = context.read<AdminApi>();
    final result = await showDialog<LoanAdvanceResult>(
      context: context,
      builder: (context) => LoanDetailDialog(loan: loan),
    );
    if (result == null) return;
    try {
      await api.updateFinanceLoanStatus(
        loan['applicationId'] as String,
        result.newStatus,
        note: result.note.isEmpty ? null : result.note,
      );
      _toast('स्थिति अपडेट हुई');
      _load();
    } on ApiException catch (e) {
      _toast(e.code == 'LOAN_INVALID_TRANSITION'
          ? 'अमान्य स्थिति परिवर्तन (${e.code})'
          : 'विफल (${e.code})');
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ऋण / वित्त')),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('सभी'),
                  selected: _status.isEmpty,
                  onSelected: (_) {
                    setState(() => _status = '');
                    _load();
                  },
                ),
                for (final s in loanStatuses)
                  ChoiceChip(
                    label: Text(loanStatusLabels[s] ?? s),
                    selected: _status == s,
                    onSelected: (_) {
                      setState(() => _status = s);
                      _load();
                    },
                  ),
              ],
            ),
          ),
          Expanded(child: _buildTable()),
        ],
      ),
    );
  }

  Widget _buildTable() {
    if (_error != null) return Center(child: Text('लोड विफल ($_error)'));
    final loans = _loans;
    if (loans == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (loans.isEmpty) {
      return const Center(child: Text('कोई ऋण आवेदन नहीं'));
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: ConstrainedBox(
            constraints: BoxConstraints(minWidth: constraints.maxWidth),
            child: DataTable(
              columns: const [
                DataColumn(label: Text('आवेदन क्रमांक')),
                DataColumn(label: Text('किसान')),
                DataColumn(label: Text('फोन')),
                DataColumn(label: Text('राशि')),
                DataColumn(label: Text('उद्देश्य')),
                DataColumn(label: Text('स्थिति')),
                DataColumn(label: Text('बनाया गया')),
                DataColumn(label: Text('क्रिया')),
              ],
              rows: [
                for (final l in loans)
                  DataRow(cells: [
                    DataCell(Text(
                        '${l['applicationNumber'] ?? l['applicationId'] ?? ''}')),
                    DataCell(Text('${l['farmerName'] ?? ''}')),
                    DataCell(Text('${l['farmerPhone'] ?? ''}')),
                    DataCell(Text('₹${l['amount'] ?? ''}')),
                    DataCell(Text('${l['purpose'] ?? ''}')),
                    DataCell(Chip(
                      label: Text(loanStatusLabels['${l['status']}'] ??
                          '${l['status']}'),
                    )),
                    DataCell(Text(_createdDate(l))),
                    DataCell(TextButton(
                      onPressed: () => _openDetail(l),
                      child: const Text('विवरण'),
                    )),
                  ]),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _createdDate(Map<String, dynamic> loan) {
    final createdAt = '${loan['createdAt'] ?? ''}';
    return createdAt.length >= 10 ? createdAt.substring(0, 10) : createdAt;
  }
}
