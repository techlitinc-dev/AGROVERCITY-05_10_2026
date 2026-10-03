import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';

final _coins = NumberFormat('#,##,###', 'en_IN');

const _personas = {
  '': 'सभी',
  'farmer': 'किसान',
  'farmLandlord': 'भूमि मालिक',
  'transport': 'परिवहन',
  'seller': 'विक्रेता',
  'equipmentRental': 'उपकरण किराया',
  'broker': 'दलाल',
};

class UsersView extends StatefulWidget {
  const UsersView({super.key});

  @override
  State<UsersView> createState() => _UsersViewState();
}

class _UsersViewState extends State<UsersView> {
  String _persona = '';
  int _page = 1;
  List<Map<String, dynamic>> _users = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load([int? page]) async {
    if (page != null) _page = page;
    setState(() => _loading = true);
    try {
      final res = await context
          .read<AdminApi>()
          .listUsers(persona: _persona, page: _page);
      _users = (res['data'] as List? ?? [])
          .map((e) => (e as Map).cast<String, dynamic>())
          .toList();
      _error = null;
    } on ApiException catch (e) {
      _error = e.code;
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _toggleStatus(Map<String, dynamic> user) async {
    final api = context.read<AdminApi>();
    final next = user['status'] == 'blocked' ? 'active' : 'blocked';
    try {
      await api.setUserStatus(user['id'] as String, next);
      setState(() => user['status'] = next);
      _toast(next == 'blocked' ? 'उपयोगकर्ता ब्लॉक हुआ' : 'उपयोगकर्ता सक्रिय हुआ');
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
      appBar: AppBar(
        title: const Text('उपयोगकर्ता'),
        actions: [
          DropdownButton<String>(
            value: _persona,
            underline: const SizedBox(),
            items: [
              for (final e in _personas.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: (v) {
              setState(() => _persona = v ?? '');
              _load(1);
            },
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('लोड विफल ($_error)'))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: SizedBox(
                    width: double.infinity,
                    child: PaginatedDataTable(
                      header: const Text('उपयोगकर्ता सूची'),
                      rowsPerPage: _users.isEmpty ? 1 : _users.length,
                      columns: const [
                        DataColumn(label: Text('नाम')),
                        DataColumn(label: Text('फ़ोन')),
                        DataColumn(label: Text('जिला')),
                        DataColumn(label: Text('प्रोफ़ाइल')),
                        DataColumn(label: Text('कॉइन')),
                        DataColumn(label: Text('स्थिति')),
                        DataColumn(label: Text('क्रिया')),
                      ],
                      source: _UsersSource(_users, _toggleStatus),
                      onPageChanged: (firstRowIndex) {
                        final pageSize =
                            _users.isEmpty ? 20 : _users.length;
                        _load(firstRowIndex ~/ pageSize + 1);
                      },
                    ),
                  ),
                ),
    );
  }
}

class _UsersSource extends DataTableSource {
  _UsersSource(this.users, this.onToggle);

  final List<Map<String, dynamic>> users;
  final Future<void> Function(Map<String, dynamic>) onToggle;

  @override
  DataRow? getRow(int index) {
    if (index >= users.length) return null;
    final u = users[index];
    final blocked = u['status'] == 'blocked';
    return DataRow(cells: [
      DataCell(Text('${u['name'] ?? ''}')),
      DataCell(Text('${u['phone'] ?? ''}')),
      DataCell(Text('${u['district'] ?? ''}')),
      DataCell(Text(
          (u['linkedProfiles'] as List?)?.join(', ') ?? '')),
      DataCell(Text(_coins.format((u['agriCoins'] as num?)?.toInt() ?? 0))),
      DataCell(Text(blocked ? 'ब्लॉक्ड' : 'सक्रिय')),
      DataCell(TextButton(
        onPressed: () => onToggle(u),
        child: Text(blocked ? 'सक्रिय करें' : 'ब्लॉक करें'),
      )),
    ]);
  }

  @override
  bool get isRowCountApproximate => false;

  @override
  int get rowCount => users.length;

  @override
  int get selectedRowCount => 0;
}
