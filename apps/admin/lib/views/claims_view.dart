import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';
import '../core/claim_transitions.dart';
import 'claim_detail_dialog.dart';

class ClaimsView extends StatefulWidget {
  const ClaimsView({super.key});

  @override
  State<ClaimsView> createState() => _ClaimsViewState();
}

class _ClaimsViewState extends State<ClaimsView> {
  String _status = '';
  List<Map<String, dynamic>>? _claims;
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
          .listClaims(status: _status.isEmpty ? null : _status);
      setState(() {
        _claims = (res['data'] as List? ?? [])
            .map((e) => (e as Map).cast<String, dynamic>())
            .toList();
        _error = null;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.code);
    }
  }

  Future<void> _openDetail(Map<String, dynamic> claim) async {
    final api = context.read<AdminApi>();
    final result = await showDialog<ClaimAdvanceResult>(
      context: context,
      builder: (context) => ClaimDetailDialog(claim: claim),
    );
    if (result == null) return;
    try {
      await api.advanceClaim(
        claim['userId'] as String,
        claim['id'] as String,
        result.newStatus,
        approvedAmount: result.approvedAmount,
        dbtTransactionId: result.dbtTransactionId,
        note: result.note,
      );
      _toast('स्थिति अपडेट हुई');
      _load();
    } on ApiException catch (e) {
      _toast(e.code == 'ILLEGAL_STATUS_TRANSITION'
          ? 'अमान्य स्थिति परिवर्तन'
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
      appBar: AppBar(title: const Text('दावे')),
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
                for (final s in claimStatuses)
                  ChoiceChip(
                    label: Text(claimStatusLabels[s] ?? s),
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
    final claims = _claims;
    if (claims == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (claims.isEmpty) {
      return const Center(child: Text('कोई दावा नहीं'));
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: SizedBox(
        width: double.infinity,
        child: DataTable(
          columns: const [
            DataColumn(label: Text('दावा क्रमांक')),
            DataColumn(label: Text('फसल')),
            DataColumn(label: Text('गांव')),
            DataColumn(label: Text('स्थिति')),
            DataColumn(label: Text('राशि')),
            DataColumn(label: Text('क्रिया')),
          ],
          rows: [
            for (final c in claims)
              DataRow(cells: [
                DataCell(Text('${c['claimNumber'] ?? c['id'] ?? ''}')),
                DataCell(Text('${c['cropName'] ?? ''}')),
                DataCell(Text('${c['village'] ?? ''}')),
                DataCell(Text(claimStatusLabels['${c['status']}'] ??
                    '${c['status']}')),
                DataCell(Text('₹${c['requestedAmount'] ?? ''}')),
                DataCell(TextButton(
                  onPressed: () => _openDetail(c),
                  child: const Text('विवरण'),
                )),
              ]),
          ],
        ),
      ),
    );
  }
}
