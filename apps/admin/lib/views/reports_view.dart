import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';

class ReportsView extends StatefulWidget {
  const ReportsView({super.key});

  @override
  State<ReportsView> createState() => _ReportsViewState();
}

class _ReportsViewState extends State<ReportsView> {
  List<Map<String, dynamic>>? _reports;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await context.read<AdminApi>().listReports(status: 'open');
      setState(() {
        _reports = (res['data'] as List? ?? [])
            .map((e) => (e as Map).cast<String, dynamic>())
            .toList();
        _error = null;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.code);
    }
  }

  Future<void> _resolve(Map<String, dynamic> report, String action) async {
    final api = context.read<AdminApi>();
    if (action == 'block') {
      final ok = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('उपयोगकर्ता ब्लॉक करें?'),
          content: Text('${report['reportedId'] ?? ''}'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('रद्द करें'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('ब्लॉक करें'),
            ),
          ],
        ),
      );
      if (ok != true) return;
    }
    try {
      await api.resolveReport(report['id'] as String, action);
      setState(() => _reports!.remove(report));
      _toast(action == 'block' ? 'ब्लॉक किया गया' : 'खारिज किया गया');
    } on ApiException catch (e) {
      _toast(e.code == 'REPORT_NOT_FOUND'
          ? 'रिपोर्ट नहीं मिली'
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
      appBar: AppBar(title: const Text('रिपोर्ट')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_error != null) return Center(child: Text('लोड विफल ($_error)'));
    final reports = _reports;
    if (reports == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (reports.isEmpty) {
      return const Center(child: Text('कोई खुली रिपोर्ट नहीं'));
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: SizedBox(
        width: double.infinity,
        child: DataTable(
          columns: const [
            DataColumn(label: Text('रिपोर्टर')),
            DataColumn(label: Text('रिपोर्टेड')),
            DataColumn(label: Text('कारण')),
            DataColumn(label: Text('समय')),
            DataColumn(label: Text('क्रिया')),
          ],
          rows: [
            for (final r in reports)
              DataRow(cells: [
                DataCell(Text('${r['reporterId'] ?? ''}')),
                DataCell(Text('${r['reportedId'] ?? ''}')),
                DataCell(Text('${r['reason'] ?? ''}')),
                DataCell(Text('${r['createdAt'] ?? ''}')),
                DataCell(Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextButton(
                      onPressed: () => _resolve(r, 'dismiss'),
                      child: const Text('खारिज करें'),
                    ),
                    TextButton(
                      style: TextButton.styleFrom(
                          foregroundColor: Colors.red),
                      onPressed: () => _resolve(r, 'block'),
                      child: const Text('ब्लॉक करें'),
                    ),
                  ],
                )),
              ]),
          ],
        ),
      ),
    );
  }
}
