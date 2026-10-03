import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';

const _kindLabels = {
  'vehicle': 'वाहन',
  'equipment': 'उपकरण',
  'seller': 'विक्रेता',
  'broker': 'दलाल',
};

class KycQueueView extends StatefulWidget {
  const KycQueueView({super.key});

  @override
  State<KycQueueView> createState() => _KycQueueViewState();
}

class _KycQueueViewState extends State<KycQueueView> {
  List<Map<String, dynamic>>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await context.read<AdminApi>().listKycPending();
      setState(() {
        _items = (res['data'] as List? ?? [])
            .map((e) => (e as Map).cast<String, dynamic>())
            .toList();
        _error = null;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.code);
    }
  }

  Future<void> _verify(Map<String, dynamic> item) async {
    final api = context.read<AdminApi>();
    try {
      await api.verifyKyc(item['entityId'] as String);
      setState(() => _items!.remove(item));
      _toast('KYC सत्यापित');
    } on ApiException catch (e) {
      _toast(e.code == 'KYC_ENTITY_NOT_FOUND'
          ? 'एंटिटी नहीं मिली'
          : 'विफल (${e.code})');
    }
  }

  Future<void> _reject(Map<String, dynamic> item) async {
    final api = context.read<AdminApi>();
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('अस्वीकार का कारण'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: 'कारण'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('रद्द करें'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(context, controller.text.trim()),
            child: const Text('अस्वीकारें'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || reason.isEmpty) return;
    try {
      await api.rejectKyc(item['entityId'] as String, reason);
      setState(() => _items!.remove(item));
      _toast('KYC अस्वीकृत');
    } on ApiException catch (e) {
      _toast('विफल (${e.code})');
    }
  }

  void _viewDoc(Map<String, dynamic> doc) {
    final url = '${doc['url'] ?? ''}';
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${doc['docType'] ?? 'दस्तावेज़'}'),
        content: SizedBox(
          width: 480,
          child: url.isEmpty
              ? const Text('कोई URL नहीं')
              : Image.network(
                  url,
                  errorBuilder: (_, _, _) =>
                      const Text('छवि लोड नहीं हुई'),
                ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              final uri = Uri.tryParse(url);
              if (uri != null) launchUrl(uri);
            },
            child: const Text('नए टैब में खोलें'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('बंद करें'),
          ),
        ],
      ),
    );
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('KYC कतार')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_error != null) return Center(child: Text('लोड विफल ($_error)'));
    final items = _items;
    if (items == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (items.isEmpty) {
      return const Center(child: Text('कोई लंबित KYC नहीं'));
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: SizedBox(
        width: double.infinity,
        child: DataTable(
          columns: const [
            DataColumn(label: Text('प्रकार')),
            DataColumn(label: Text('मालिक')),
            DataColumn(label: Text('दस्तावेज़')),
            DataColumn(label: Text('क्रिया')),
          ],
          rows: [
            for (final item in items)
              DataRow(cells: [
                DataCell(Text(_kindLabels['${item['entityKind']}'] ??
                    '${item['entityKind']}')),
                DataCell(Text(
                    '${item['ownerName'] ?? item['ownerId'] ?? ''}')),
                DataCell(Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final doc
                        in (item['docs'] as List? ?? []))
                      TextButton(
                        onPressed: () => _viewDoc(
                            (doc as Map).cast<String, dynamic>()),
                        child: Text('${doc['docType'] ?? 'दस्तावेज़'}'),
                      ),
                  ],
                )),
                DataCell(Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextButton(
                      style: TextButton.styleFrom(
                          foregroundColor: Colors.green),
                      onPressed: () => _verify(item),
                      child: const Text('सत्यापित करें'),
                    ),
                    TextButton(
                      style: TextButton.styleFrom(
                          foregroundColor: Colors.red),
                      onPressed: () => _reject(item),
                      child: const Text('अस्वीकारें'),
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
