import 'package:flutter/material.dart';

class ContentFormDialog extends StatefulWidget {
  const ContentFormDialog({super.key, required this.collection, this.existing});

  final String collection;
  final Map<String, dynamic>? existing;

  @override
  State<ContentFormDialog> createState() => _ContentFormDialogState();
}

class _ContentFormDialogState extends State<ContentFormDialog> {
  final _title = TextEditingController();
  final _vernacularTitle = TextEditingController();
  final _summary = TextEditingController();
  final _content = TextEditingController();
  final _benefitAmount = TextEditingController();
  final _description = TextEditingController();
  final _documentsRequired = TextEditingController();
  String _category = 'general';
  bool _isBreaking = false;
  DateTime? _nextDeadline;

  bool get _isNews => widget.collection == 'news';

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e == null) return;
    _title.text = '${e['title'] ?? e['name'] ?? ''}';
    _vernacularTitle.text = '${e['vernacularTitle'] ?? ''}';
    _summary.text = '${e['summary'] ?? ''}';
    _content.text = '${e['content'] ?? ''}';
    _benefitAmount.text = '${e['benefitAmount'] ?? ''}';
    _description.text = '${e['description'] ?? ''}';
    _documentsRequired.text =
        (e['documentsRequired'] as List?)?.join(', ') ?? '';
    final rawCategory = '${e['category'] ?? 'general'}';
    const known = {
      'general', 'weather', 'mandi', 'scheme', 'subsidy', 'loan', 'insurance',
    };
    _category = known.contains(rawCategory) ? rawCategory : 'general';
    _isBreaking = e['isBreaking'] == true;
    _nextDeadline = DateTime.tryParse('${e['nextDeadline'] ?? ''}');
  }

  @override
  void dispose() {
    for (final c in [
      _title, _vernacularTitle, _summary, _content,
      _benefitAmount, _description, _documentsRequired,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> _body() {
    if (_isNews) {
      return {
        'title': _title.text.trim(),
        'vernacularTitle': _vernacularTitle.text.trim(),
        'category': _category,
        'summary': _summary.text.trim(),
        'content': _content.text.trim(),
        'isBreaking': _isBreaking,
      };
    }
    return {
      'name': _title.text.trim(),
      'category': _category,
      'benefitAmount': num.tryParse(_benefitAmount.text.trim()) ?? 0,
      'description': _description.text.trim(),
      'nextDeadline': _nextDeadline?.toIso8601String().substring(0, 10),
      'documentsRequired': _documentsRequired.text
          .split(',')
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty)
          .toList(),
    };
  }

  InputDecoration _dec(String label) => InputDecoration(labelText: label);

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_isNews ? 'समाचार' : 'योजना'),
      content: SizedBox(
        width: 480,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _title,
                decoration: _dec(_isNews ? 'शीर्षक' : 'नाम'),
              ),
              if (_isNews) ...[
                TextField(
                  controller: _vernacularTitle,
                  decoration: _dec('देशी शीर्षक'),
                ),
                DropdownButtonFormField<String>(
                  initialValue: _category,
                  decoration: _dec('श्रेणी'),
                  items: const [
                    DropdownMenuItem(value: 'general', child: Text('सामान्य')),
                    DropdownMenuItem(value: 'weather', child: Text('मौसम')),
                    DropdownMenuItem(value: 'mandi', child: Text('मंडी')),
                    DropdownMenuItem(value: 'scheme', child: Text('योजना')),
                  ],
                  onChanged: (v) => setState(() => _category = v ?? 'general'),
                ),
                TextField(controller: _summary, decoration: _dec('सारांश')),
                TextField(
                  controller: _content,
                  maxLines: 5,
                  decoration: _dec('विवरण'),
                ),
                CheckboxListTile(
                  value: _isBreaking,
                  title: const Text('ब्रेकिंग न्यूज़'),
                  onChanged: (v) => setState(() => _isBreaking = v ?? false),
                ),
              ] else ...[
                DropdownButtonFormField<String>(
                  initialValue: _category,
                  decoration: _dec('श्रेणी'),
                  items: const [
                    DropdownMenuItem(value: 'general', child: Text('सामान्य')),
                    DropdownMenuItem(value: 'subsidy', child: Text('सब्सिडी')),
                    DropdownMenuItem(value: 'loan', child: Text('ऋण')),
                    DropdownMenuItem(value: 'insurance', child: Text('बीमा')),
                  ],
                  onChanged: (v) => setState(() => _category = v ?? 'general'),
                ),
                TextField(
                  controller: _benefitAmount,
                  keyboardType: TextInputType.number,
                  decoration: _dec('लाभ राशि'),
                ),
                TextField(
                  controller: _description,
                  maxLines: 3,
                  decoration: _dec('विवरण'),
                ),
                ListTile(
                  title: Text(_nextDeadline == null
                      ? 'अगली तिथि चुनें'
                      : 'तिथि: ${_nextDeadline!.toIso8601String().substring(0, 10)}'),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _nextDeadline ?? DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2035),
                    );
                    if (picked != null) setState(() => _nextDeadline = picked);
                  },
                ),
                TextField(
                  controller: _documentsRequired,
                  decoration: _dec('आवश्यक दस्तावेज़ (कॉमा से अलग)'),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('रद्द करें'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _body()),
          child: const Text('सहेजें'),
        ),
      ],
    );
  }
}
