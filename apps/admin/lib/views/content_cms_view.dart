import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';
import 'content_form_dialog.dart';

class ContentCmsView extends StatefulWidget {
  const ContentCmsView({super.key});

  @override
  State<ContentCmsView> createState() => _ContentCmsViewState();
}

class _ContentCmsViewState extends State<ContentCmsView> {
  String _collection = 'news';
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res =
          await context.read<AdminApi>().listContent(_collection);
      _items = (res['data'] as List? ?? [])
          .map((e) => (e as Map).cast<String, dynamic>())
          .toList();
    } on ApiException {
      _items = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  String _titleOf(Map<String, dynamic> item) =>
      '${item['title'] ?? item['name'] ?? ''}';

  Future<void> _openForm([Map<String, dynamic>? existing]) async {
    final api = context.read<AdminApi>();
    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => ContentFormDialog(
        collection: _collection,
        existing: existing,
      ),
    );
    if (body == null) return;
    try {
      if (existing == null) {
        final created = await api.createContent(_collection, body);
        setState(() => _items.add(created.containsKey('id')
            ? created
            : {'id': '', ...body}));
        _toast('सहेजा गया');
      } else {
        await api.updateContent(
            _collection, existing['id'] as String, body);
        setState(() {
          final i = _items.indexOf(existing);
          _items[i] = {...existing, ...body};
        });
        _toast('अपडेट हुआ');
      }
    } on ApiException catch (e) {
      _toast('विफल (${e.code})');
    }
  }

  Future<void> _delete(Map<String, dynamic> item) async {
    final api = context.read<AdminApi>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('हटाएं?'),
        content: Text(_titleOf(item)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('रद्द करें'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('हटाएं'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await api.deleteContent(_collection, item['id'] as String);
      setState(() => _items.remove(item));
      _toast('हटाया गया');
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
        title: const Text('कंटेंट'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: FilledButton.icon(
              onPressed: () => _openForm(),
              icon: const Icon(Icons.add),
              label: const Text('नया'),
            ),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: DropdownButton<String>(
              value: _collection,
              items: const [
                DropdownMenuItem(value: 'news', child: Text('समाचार')),
                DropdownMenuItem(value: 'schemes', child: Text('योजनाएं')),
              ],
              onChanged: (v) {
                if (v == null) return;
                setState(() => _collection = v);
                _load();
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _items.isEmpty
                    ? const Center(child: Text('कोई कंटेंट नहीं'))
                    : SingleChildScrollView(
                        padding: const EdgeInsets.all(16),
                        child: SizedBox(
                          width: double.infinity,
                          child: DataTable(
                            columns: const [
                              DataColumn(label: Text('शीर्षक')),
                              DataColumn(label: Text('क्रिया')),
                            ],
                            rows: [
                              for (final item in _items)
                                DataRow(cells: [
                                  DataCell(Text(_titleOf(item))),
                                  DataCell(Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.edit),
                                        tooltip: 'संपादित करें',
                                        onPressed: () => _openForm(item),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.delete,
                                            color: Colors.red),
                                        tooltip: 'हटाएं',
                                        onPressed: () => _delete(item),
                                      ),
                                    ],
                                  )),
                                ]),
                            ],
                          ),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
