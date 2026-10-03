import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';

const _roles = {
  '': 'कोई भी',
  'farmer': 'किसान',
  'farmLandlord': 'भूमि मालिक',
  'transport': 'परिवहन',
  'seller': 'विक्रेता',
  'equipmentRental': 'उपकरण किराया',
  'broker': 'दलाल',
};

class BroadcastView extends StatefulWidget {
  const BroadcastView({super.key});

  @override
  State<BroadcastView> createState() => _BroadcastViewState();
}

class _BroadcastViewState extends State<BroadcastView> {
  final _district = TextEditingController();
  final _title = TextEditingController();
  final _body = TextEditingController();
  final _deepLink = TextEditingController();
  String _role = '';
  int? _targeted;
  bool _busy = false;

  @override
  void dispose() {
    _district.dispose();
    _title.dispose();
    _body.dispose();
    _deepLink.dispose();
    super.dispose();
  }

  Map<String, String?> _segment() => {
        'role': _role.isEmpty ? null : _role,
        'district':
            _district.text.trim().isEmpty ? null : _district.text.trim(),
      };

  Future<Map<String, dynamic>?> _call(bool dryRun) async {
    final api = context.read<AdminApi>();
    try {
      return await api.broadcast(
        segment: _segment(),
        title: _title.text.trim(),
        body: _body.text.trim(),
        deepLink:
            _deepLink.text.trim().isEmpty ? null : _deepLink.text.trim(),
        dryRun: dryRun,
      );
    } on ApiException catch (e) {
      _toast(e.code == 'SEGMENT_REQUIRED'
          ? 'प्रोफ़ाइल या जिला चुनें'
          : 'विफल (${e.code})');
      return null;
    }
  }

  Future<void> _count() async {
    setState(() => _busy = true);
    final res = await _call(true);
    if (res != null) {
      setState(() => _targeted = (res['targetedCount'] as num?)?.toInt());
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _send() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('प्रसारण भेजें?'),
        content: Text('लक्षित: ${_targeted ?? '?'}'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('रद्द करें'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('भेजें'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    final res = await _call(false);
    if (res != null) {
      _toast('भेजा गया: ${res['sent']} / ${res['targetedCount']}');
    }
    if (mounted) setState(() => _busy = false);
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('प्रसारण')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          width: 520,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _role,
                      decoration:
                          const InputDecoration(labelText: 'प्रोफ़ाइल'),
                      items: [
                        for (final e in _roles.entries)
                          DropdownMenuItem(
                              value: e.key, child: Text(e.value)),
                      ],
                      onChanged: (v) => setState(() => _role = v ?? ''),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _district,
                      decoration:
                          const InputDecoration(labelText: 'जिला'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _title,
                decoration: const InputDecoration(labelText: 'शीर्षक'),
              ),
              TextField(
                controller: _body,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'संदेश'),
              ),
              TextField(
                controller: _deepLink,
                decoration: const InputDecoration(
                    labelText: 'डीप लिंक (वैकल्पिक)'),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  OutlinedButton(
                    onPressed: _busy ? null : _count,
                    child: const Text('गिनती देखें'),
                  ),
                  const SizedBox(width: 12),
                  FilledButton(
                    onPressed: _busy ? null : _send,
                    child: const Text('भेजें'),
                  ),
                  if (_targeted != null) ...[
                    const SizedBox(width: 16),
                    Text('लक्षित: $_targeted'),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
