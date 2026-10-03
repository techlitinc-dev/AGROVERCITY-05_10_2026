import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';

class RateApprovalsView extends StatefulWidget {
  const RateApprovalsView({super.key});

  @override
  State<RateApprovalsView> createState() => _RateApprovalsViewState();
}

class _RateApprovalsViewState extends State<RateApprovalsView> {
  List<Map<String, dynamic>>? _rates;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await context.read<AdminApi>().listPendingRates();
      setState(() {
        _rates = (res['data'] as List? ?? [])
            .map((e) => (e as Map).cast<String, dynamic>())
            .toList();
        _error = null;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.code);
    }
  }

  Future<void> _approve(Map<String, dynamic> rate) async {
    final api = context.read<AdminApi>();
    try {
      await api.approveRate(rate['id'] as String);
      setState(() => _rates!.remove(rate));
      _toast('दर स्वीकृत');
    } on ApiException catch (e) {
      _toast('विफल (${e.code})');
    }
  }

  Future<void> _reject(Map<String, dynamic> rate) async {
    final api = context.read<AdminApi>();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => const _ReasonDialog(),
    );
    if (reason == null || reason.isEmpty) return;
    try {
      await api.rejectRate(rate['id'] as String, reason);
      setState(() => _rates!.remove(rate));
      _toast('दर अस्वीकृत');
    } on ApiException catch (e) {
      _toast('विफल (${e.code})');
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('दर अनुमोदन')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_error != null) return Center(child: Text('लोड विफल ($_error)'));
    final rates = _rates;
    if (rates == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (rates.isEmpty) {
      return const Center(child: Text('कोई लंबित दर नहीं'));
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: SizedBox(
        width: double.infinity,
        child: DataTable(
          columns: const [
            DataColumn(label: Text('व्यापारी')),
            DataColumn(label: Text('फसल')),
            DataColumn(label: Text('दर')),
            DataColumn(label: Text('मंडी')),
            DataColumn(label: Text('समय')),
            DataColumn(label: Text('क्रिया')),
          ],
          rows: [
            for (final r in rates)
              DataRow(cells: [
                DataCell(Text('${r['sellerId'] ?? ''}')),
                DataCell(Text('${r['crop'] ?? ''}')),
                DataCell(Text('₹${r['rate'] ?? ''}')),
                DataCell(Text('${r['mandiName'] ?? ''}')),
                DataCell(Text('${r['createdAt'] ?? ''}')),
                DataCell(Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextButton(
                      style: TextButton.styleFrom(
                          foregroundColor: Colors.green),
                      onPressed: () => _approve(r),
                      child: const Text('स्वीकृत'),
                    ),
                    TextButton(
                      style:
                          TextButton.styleFrom(foregroundColor: Colors.red),
                      onPressed: () => _reject(r),
                      child: const Text('अस्वीकार'),
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

class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog();

  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('अस्वीकार का कारण'),
      content: TextField(
        controller: _controller,
        decoration: const InputDecoration(labelText: 'कारण'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('रद्द करें'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _controller.text.trim()),
          child: const Text('अस्वीकार करें'),
        ),
      ],
    );
  }
}
