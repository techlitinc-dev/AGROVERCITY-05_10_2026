import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';

final _inr = NumberFormat('#,##,###', 'en_IN');

const _filters = {
  'pending': 'लंबित',
  'approved': 'स्वीकृत',
  'paid': 'भुगतान हुआ',
};

const _statusLabels = {
  'pending': 'लंबित',
  'approved': 'स्वीकृत',
  'paid': 'भुगतान हुआ',
};

class SettlementsView extends StatefulWidget {
  const SettlementsView({super.key});

  @override
  State<SettlementsView> createState() => _SettlementsViewState();
}

class _SettlementsViewState extends State<SettlementsView> {
  String _status = 'pending';
  List<Map<String, dynamic>>? _rows;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _rows = null);
    try {
      final res =
          await context.read<AdminApi>().listSettlements(status: _status);
      setState(() {
        _rows = (res['data'] as List? ?? [])
            .map((e) => (e as Map).cast<String, dynamic>())
            .toList();
        _error = null;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.code);
    }
  }

  Future<void> _act(Map<String, dynamic> row, String action) async {
    final api = context.read<AdminApi>();
    try {
      await api.settleAction(row['id'] as String, action);
      setState(() => _rows!.remove(row));
      _toast(action == 'approve' ? 'स्वीकृत हुआ' : 'भुगतान चिह्नित');
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

  String _money(Map<String, dynamic> row, String key) =>
      '₹${_inr.format((row[key] as num?)?.toInt() ?? 0)}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('निपटान')),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Wrap(
              spacing: 8,
              children: [
                for (final f in _filters.entries)
                  ChoiceChip(
                    label: Text(f.value),
                    selected: _status == f.key,
                    onSelected: (_) {
                      setState(() => _status = f.key);
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
    final rows = _rows;
    if (rows == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (rows.isEmpty) {
      return const Center(child: Text('कोई निपटान नहीं'));
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: SizedBox(
        width: double.infinity,
        child: DataTable(
          columns: const [
            DataColumn(label: Text('भूमिका')),
            DataColumn(label: Text('अवधि')),
            DataColumn(label: Text('सकल')),
            DataColumn(label: Text('कमीशन')),
            DataColumn(label: Text('शुद्ध')),
            DataColumn(label: Text('स्थिति')),
            DataColumn(label: Text('क्रिया')),
          ],
          rows: [
            for (final r in rows)
              DataRow(cells: [
                DataCell(Text('${r['role'] ?? ''}')),
                DataCell(Text(
                    '${r['periodStart'] ?? ''} — ${r['periodEnd'] ?? ''}')),
                DataCell(Text(_money(r, 'grossRupees'))),
                DataCell(Text(_money(r, 'commissionRupees'))),
                DataCell(Text(_money(r, 'netRupees'))),
                DataCell(Text(
                    _statusLabels['${r['status']}'] ?? '${r['status']}')),
                DataCell(_actionFor(r)),
              ]),
          ],
        ),
      ),
    );
  }

  Widget _actionFor(Map<String, dynamic> row) {
    final status = '${row['status']}';
    if (status == 'pending') {
      return TextButton(
        onPressed: () => _act(row, 'approve'),
        child: const Text('स्वीकृत करें'),
      );
    }
    if (status == 'approved') {
      return TextButton(
        onPressed: () => _act(row, 'mark_paid'),
        child: const Text('भुगतान चिह्नित करें'),
      );
    }
    return const SizedBox();
  }
}
